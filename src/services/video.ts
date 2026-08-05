import { VideoStatus, db, users, videos } from "@/db";
import { and, asc, desc, eq, gt, inArray, lt } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getStorage } from "@/lib/storage";
import { calculateModelCredits } from "../config/credits";
import { getProvider, type ProviderType, type VideoTaskResponse } from "../ai";
import {
  getProviderCandidates,
  isRetryableProviderError,
} from "../ai/routing";
import { creditService } from "./credit";
import { generationQuotaService } from "./generation-quota";
import { providerHealthService } from "./provider-health";
import { generateSignedCallbackUrl } from "@/ai/utils/callback-signature";
import { emitVideoEvent } from "@/lib/video-events";
import { ApiError } from "@/lib/api/error";
import { scheduleVideoReconciliation } from "@/lib/upstash";
import { validateGenerationParams } from "./video-validation";
import { generationPausedDetails } from "./generation-risk";

export { validateGenerationParams } from "./video-validation";

export interface GenerateVideoParams {
  userId: string;
  prompt: string;
  model: string; // "sora-2"
  duration?: number;
  aspectRatio?: string; // "16:9" | "9:16"
  quality?: string; // "standard" | "high"
  imageUrl?: string; // image-to-video
  imageUrls?: string[]; // image-to-video (multi-image)
  mode?: string;
  outputNumber?: number;
  generateAudio?: boolean;
  removeWatermark?: boolean;
  /** Internal grouping key used when one request creates multiple tasks. */
  batchUuid?: string;
  /** Internal reservation created atomically by generateBatch. */
  reservedVideoUuid?: string;
}

export interface VideoGenerationResult {
  batchUuid?: string;
  videoUuid: string;
  taskId: string;
  provider: ProviderType;
  status: string;
  estimatedTime?: number;
  creditsUsed: number;
  outputs?: VideoGenerationResult[];
}

export class VideoService {
  private callbackBaseUrl: string;

  constructor() {
    this.callbackBaseUrl = process.env.AI_CALLBACK_URL || "";
  }

  private async assertGenerationAllowed(userId: string) {
    const [account] = await db
      .select({
        billingStatus: users.billingStatus,
        creditDebt: users.creditDebt,
        generationStatus: users.generationStatus,
        generationPauseSource: users.generationPauseSource,
        generationPauseReason: users.generationPauseReason,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!account) throw new ApiError("User not found", 404);
    if (account.generationStatus === "PAUSED") {
      throw new ApiError(
        "Video generation is temporarily paused. Please contact support.",
        423,
        generationPausedDetails({
          source: account.generationPauseSource,
          reason: account.generationPauseReason,
        })
      );
    }
    if (account.billingStatus === "ACTIVE") return;

    const isDebt = account.billingStatus === "PAYMENT_REQUIRED";
    throw new ApiError(
      isDebt
        ? "Payment reversal must be resolved before generating new videos"
        : "Billing account is temporarily under dispute review",
      isDebt ? 402 : 423,
      { code: account.billingStatus, creditDebt: account.creditDebt }
    );
  }

  /**
   * Parse insufficient credits error and convert to structured ApiError
   */
  private toInsufficientCreditsApiError(
    error: unknown,
    fallbackRequiredCredits: number
  ): ApiError | null {
    const message = error instanceof Error ? error.message : String(error);
    const match = message.match(
      /Insufficient credits\.\s*Required:\s*(\d+)(?:,\s*Available:\s*(\d+))?/i
    );
    if (!match) return null;

    const requiredCredits =
      Number.parseInt(match[1] || "", 10) || fallbackRequiredCredits;
    const availableCredits = match[2]
      ? Number.parseInt(match[2], 10)
      : undefined;

    return new ApiError("Insufficient credits", 402, {
      code: "INSUFFICIENT_CREDITS",
      requiredCredits,
      availableCredits,
    });
  }

  /**
   * Create video generation task
   */
  async generate(params: GenerateVideoParams): Promise<VideoGenerationResult> {
    await this.assertGenerationAllowed(params.userId);
    const validated = validateGenerationParams(params);
    const requestedOutputs = validated.outputNumber;
    if (requestedOutputs > 1 && !params.batchUuid) {
      return this.generateBatch(params, requestedOutputs);
    }

    const modelConfig = validated.modelConfig;
    const effectiveDuration = validated.duration;

    const outputNumber = 1;
    const creditsRequired = calculateModelCredits(params.model, {
      duration: effectiveDuration,
      quality: params.quality,
    }) * outputNumber;

    const hasImageInput = validated.imageUrls.length > 0;
    const resolvedMode = validated.mode;

    if (hasImageInput && !modelConfig.supportImageToVideo) {
      throw new ApiError(
        `Model ${params.model} does not support image-to-video`,
        400,
        {
          code: "IMAGE_TO_VIDEO_NOT_SUPPORTED",
          model: params.model,
        }
      );
    }

    let providerCandidates = getProviderCandidates(
      params.model,
      resolvedMode,
      effectiveDuration
    );
    if (providerCandidates.length === 0) {
      throw new ApiError(
        `No configured provider can run ${params.model} in ${resolvedMode} mode`,
        400,
        {
          code: "MODEL_ROUTE_UNAVAILABLE",
          model: params.model,
          mode: resolvedMode,
          configuredProvider: modelConfig.provider,
        }
      );
    }
    providerCandidates = await providerHealthService.prioritize(providerCandidates);

    const initialProvider = providerCandidates[0]!;

    const videoUuid = params.reservedVideoUuid ?? `vid_${nanoid(21)}`;
    const reservationValues = {
        uuid: videoUuid,
        batchUuid: params.batchUuid,
        userId: params.userId,
        prompt: params.prompt,
        model: params.model,
        parameters: {
          duration: params.duration,
          aspectRatio: params.aspectRatio,
          quality: params.quality,
          outputNumber,
          mode: resolvedMode,
          imageUrl: params.imageUrl,
          imageUrls: params.imageUrls,
          generateAudio: params.generateAudio,
          removeWatermark: params.removeWatermark,
        },
        status: VideoStatus.PENDING,
        startImageUrl: params.imageUrls?.[0] || params.imageUrl || null,
        creditsUsed: creditsRequired,
        duration: effectiveDuration,
        aspectRatio: params.aspectRatio || null,
        provider: initialProvider,
        updatedAt: new Date(),
      } satisfies typeof videos.$inferInsert;

    let videoResult: { uuid: string; id: number };
    if (params.reservedVideoUuid) {
      const [reserved] = await db
        .select({ uuid: videos.uuid, id: videos.id })
        .from(videos)
        .where(
          and(
            eq(videos.uuid, params.reservedVideoUuid),
            eq(videos.userId, params.userId),
            eq(videos.status, VideoStatus.PENDING)
          )
        )
        .limit(1);
      if (!reserved) throw new Error("Reserved video task is unavailable");
      videoResult = reserved;
    } else {
      videoResult = await generationQuotaService.reserveVideo(
        params.userId,
        params.model,
        reservationValues
      );

      try {
        await creditService.freeze({
          userId: params.userId,
          credits: creditsRequired,
          videoUuid: videoResult.uuid,
        });
      } catch (error) {
        await db
          .update(videos)
          .set({
            status: VideoStatus.FAILED,
            errorMessage: String(error),
            updatedAt: new Date(),
          })
          .where(eq(videos.uuid, videoResult.uuid));

        const insufficientCreditsError = this.toInsufficientCreditsApiError(
          error,
          creditsRequired
        );
        if (insufficientCreditsError) throw insufficientCreditsError;
        throw error;
      }
    }

    try {
      let result: VideoTaskResponse | undefined;
      let selectedProvider: ProviderType | undefined;
      const routingErrors: string[] = [];

      for (const providerType of providerCandidates) {
        const startedAt = Date.now();
        const callbackUrl = this.callbackBaseUrl
          ? generateSignedCallbackUrl(
            `${this.callbackBaseUrl}/${providerType}`,
            videoResult.uuid
          )
          : undefined;

        try {
          result = await getProvider(providerType).createTask({
            model: params.model,
            prompt: params.prompt,
            duration: effectiveDuration,
            aspectRatio: params.aspectRatio,
            quality: params.quality,
            imageUrl: params.imageUrl,
            imageUrls: params.imageUrls,
            mode: resolvedMode,
            outputNumber,
            generateAudio: params.generateAudio,
            removeWatermark: params.removeWatermark,
            callbackUrl,
          });
          void providerHealthService.record({
            provider: providerType,
            model: params.model,
            videoUuid: videoResult.uuid,
            operation: "submit",
            success: true,
            latencyMs: Date.now() - startedAt,
            creditsQuoted: creditsRequired,
          }).catch((metricsError) => {
            console.error("Failed to record provider success metric", metricsError);
          });
          selectedProvider = providerType;
          break;
        } catch (error) {
          void providerHealthService.record({
            provider: providerType,
            model: params.model,
            videoUuid: videoResult.uuid,
            operation: "submit",
            success: false,
            latencyMs: Date.now() - startedAt,
            creditsQuoted: creditsRequired,
            errorMessage: String(error),
          }).catch((metricsError) => {
            console.error("Failed to record provider failure metric", metricsError);
          });
          routingErrors.push(`${providerType}: ${String(error)}`);
          if (!isRetryableProviderError(error)) throw error;
        }
      }

      if (!result || !selectedProvider) {
        throw new Error(`All provider routes failed. ${routingErrors.join(" | ")}`);
      }

      await db
        .update(videos)
        .set({
          status: VideoStatus.GENERATING,
          externalTaskId: result.taskId,
          provider: selectedProvider,
          updatedAt: new Date(),
        })
        .where(eq(videos.uuid, videoResult.uuid));

      // Optional in development. Production queues a durable fallback poll so
      // a missed provider webhook cannot strand a paid generation forever.
      void scheduleVideoReconciliation({
        videoUuid: videoResult.uuid,
        userId: params.userId,
      }).catch((error) => {
        console.error("Failed to schedule video reconciliation", error);
      });

      return {
        videoUuid: videoResult.uuid,
        taskId: result.taskId,
        provider: selectedProvider,
        status: "GENERATING",
        estimatedTime: result.estimatedTime,
        creditsUsed: creditsRequired,
      };
    } catch (error) {
      await creditService.release(videoResult.uuid);

      await db
        .update(videos)
        .set({
          status: VideoStatus.FAILED,
          errorMessage: String(error),
          updatedAt: new Date(),
        })
        .where(eq(videos.uuid, videoResult.uuid));
      throw error;
    }
  }

  /**
   * Handle AI Callback
   */
  async handleCallback(
    providerType: ProviderType,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: any,
    videoUuid: string
  ): Promise<void> {
    const provider = getProvider(providerType);
    const result = provider.parseCallback(payload);

    const [video] = await db
      .select()
      .from(videos)
      .where(eq(videos.uuid, videoUuid))
      .limit(1);

    if (!video) {
      console.error(`Video not found: ${videoUuid}`);
      return;
    }

    if (video.provider && video.provider !== providerType) {
      throw new Error(
        `Provider mismatch: expected ${video.provider}, got ${providerType}`
      );
    }

    if (!video.externalTaskId) {
      throw new Error(`Callback arrived before task binding: ${videoUuid}`);
    }
    if (video.externalTaskId !== result.taskId) {
      throw new Error(
        `Task ID mismatch: expected ${video.externalTaskId}, got ${result.taskId}`
      );
    }

    if (result.status === "completed" && result.videoUrl) {
      await this.tryCompleteGeneration(video.uuid, result);
    } else if (result.status === "failed") {
      await this.failGeneration(video.uuid, result.error?.message);
    }
  }

  /**
   * Get task status (for frontend polling)
   */
  async refreshStatus(
    videoUuid: string,
    userId: string
  ): Promise<{
    status: string;
    videoUrl?: string;
    error?: string;
  }> {
    const [video] = await db
      .select()
      .from(videos)
      .where(and(eq(videos.uuid, videoUuid), eq(videos.userId, userId)))
      .limit(1);

    if (!video) {
      throw new Error("Video not found");
    }

    if (video.status === VideoStatus.COMPLETED || video.status === VideoStatus.FAILED) {
      return {
        status: video.status,
        videoUrl: video.videoUrl || undefined,
        error: video.errorMessage || undefined,
      };
    }

    // UPLOADING is a short lease, not a terminal state. If a function crashed
    // after claiming it, a later poll or recovery pass must be able to resume.
    if (video.status === VideoStatus.UPLOADING) {
      if (video.updatedAt.getTime() >= Date.now() - 5 * 60 * 1000) {
        return { status: VideoStatus.UPLOADING };
      }
      const [releasedLease] = await db
        .update(videos)
        .set({ status: VideoStatus.GENERATING, updatedAt: new Date() })
        .where(
          and(
            eq(videos.uuid, video.uuid),
            eq(videos.status, VideoStatus.UPLOADING),
            eq(videos.updatedAt, video.updatedAt)
          )
        )
        .returning({ uuid: videos.uuid });
      if (!releasedLease) return { status: VideoStatus.UPLOADING };
      video.status = VideoStatus.GENERATING;
    }

    if (video.externalTaskId && video.provider) {
      try {
        const provider = getProvider(video.provider as ProviderType);
        const result = await provider.getTaskStatus(video.externalTaskId);

        if (result.status === "completed" && result.videoUrl) {
          const updated = await this.tryCompleteGeneration(video.uuid, result);
          return {
            status: updated.status,
            videoUrl: updated.videoUrl || undefined,
          };
        }

        if (result.status === "failed") {
          const updated = await this.failGeneration(
            video.uuid,
            result.error?.message
          );
          return {
            status: updated.status,
            error: updated.errorMessage || undefined,
          };
        }
        if (result.status === "processing" && video.status === VideoStatus.PENDING) {
          await db
            .update(videos)
            .set({
              status: VideoStatus.GENERATING,
              updatedAt: new Date(),
            })
            .where(eq(videos.uuid, video.uuid));
          return { status: VideoStatus.GENERATING };
        }
      } catch (error) {
        console.error("Failed to refresh status from provider:", error);
        const message = error instanceof Error ? error.message : String(error);
        const isFinalizationRetry =
          Boolean(video.originalVideoUrl) ||
          message.includes("Failed to download") ||
          message.includes("Failed to upload");
        return {
          status: "RETRYING",
          error: isFinalizationRetry
            ? "Your video is ready and is being finalized. We will retry automatically."
            : "Video status is temporarily unavailable. We will retry automatically.",
        };
      }
    }

    return { status: video.status };
  }

  /**
   * Refresh status by external task id
   */
  async refreshStatusByTaskId(taskId: string, userId: string) {
    const [video] = await db
      .select()
      .from(videos)
      .where(and(eq(videos.externalTaskId, taskId), eq(videos.userId, userId)))
      .limit(1);

    if (!video) {
      throw new Error("Video not found");
    }

    return this.refreshStatus(video.uuid, userId);
  }

  /**
   * Try to complete generation (transaction + optimistic lock)
   */
  async tryCompleteGeneration(
    videoUuid: string,
    result: VideoTaskResponse
  ): Promise<{ status: string; videoUrl?: string | null }> {
    const [video] = await db
      .select()
      .from(videos)
      .where(eq(videos.uuid, videoUuid))
      .limit(1);
    if (!video) throw new Error("Video not found");
    if (video.status === VideoStatus.COMPLETED) {
      return { status: video.status, videoUrl: video.videoUrl };
    }
    if (video.status === VideoStatus.FAILED) {
      return { status: video.status, videoUrl: null };
    }
    if (video.status === VideoStatus.UPLOADING) {
      return { status: video.status, videoUrl: video.videoUrl };
    }
    if (video.status !== VideoStatus.GENERATING) {
      return { status: video.status, videoUrl: video.videoUrl };
    }

    const [claimed] = await db
      .update(videos)
      .set({
        status: VideoStatus.UPLOADING,
        originalVideoUrl: result.videoUrl,
        updatedAt: new Date(),
      })
      .where(and(eq(videos.uuid, videoUuid), eq(videos.status, VideoStatus.GENERATING)))
      .returning({ uuid: videos.uuid });
    if (!claimed) return { status: VideoStatus.UPLOADING };

    try {
      const storage = getStorage();
      const key = `videos/${videoUuid}/${Date.now()}.mp4`;
      const uploaded = await storage.downloadAndUpload({
        sourceUrl: result.videoUrl!,
        key,
        contentType: "video/mp4",
      });

      await creditService.settle(videoUuid);

      await db
        .update(videos)
        .set({
          status: VideoStatus.COMPLETED,
          videoUrl: uploaded.url,
          thumbnailUrl: result.thumbnailUrl || null,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(videos.uuid, videoUuid));

      emitVideoEvent({
        userId: video.userId,
        videoUuid,
        status: "COMPLETED",
        videoUrl: uploaded.url,
        thumbnailUrl: result.thumbnailUrl || null,
      });

      return { status: VideoStatus.COMPLETED, videoUrl: uploaded.url };
    } catch (error) {
      // Let the durable workflow retry completion. Credits remain frozen until
      // storage and settlement both succeed.
      await db
        .update(videos)
        .set({
          status: VideoStatus.GENERATING,
          errorMessage: `Completion retry required: ${String(error)}`,
          updatedAt: new Date(),
        })
        .where(and(eq(videos.uuid, videoUuid), eq(videos.status, VideoStatus.UPLOADING)));
      throw error;
    }
  }

  private async generateBatch(
    params: GenerateVideoParams,
    outputNumber: number
  ): Promise<VideoGenerationResult> {
    const validated = validateGenerationParams(params);
    const balance = await creditService.getBalance(params.userId);
    const plan = (balance.plan ?? "FREE") as "FREE" | "BASIC" | "PRO" | "BUSINESS";
    const policy = generationQuotaService.getPolicy(plan);
    if (outputNumber > policy.maxConcurrent) {
      throw new ApiError("Multiple outputs require a higher concurrency plan", 429, {
        code: "BATCH_OUTPUT_PLAN_LIMIT",
        requested: outputNumber,
        limit: policy.maxConcurrent,
      });
    }

    let providerCandidates = getProviderCandidates(
      params.model,
      validated.mode,
      validated.duration
    );
    if (providerCandidates.length === 0) {
      throw new ApiError(
        `No configured provider can run ${params.model} in ${validated.mode} mode`,
        400,
        { code: "MODEL_ROUTE_UNAVAILABLE" }
      );
    }
    providerCandidates = await providerHealthService.prioritize(providerCandidates);
    const initialProvider = providerCandidates[0]!;
    const creditsPerOutput = calculateModelCredits(params.model, {
      duration: validated.duration,
      quality: params.quality,
    });
    const requiredCredits = creditsPerOutput * outputNumber;
    if (balance.availableCredits < requiredCredits) {
      throw new ApiError("Insufficient credits", 402, {
        code: "INSUFFICIENT_CREDITS",
        requiredCredits,
        availableCredits: balance.availableCredits,
      });
    }

    const batchUuid = `batch_${nanoid(21)}`;
    const reservations = await generationQuotaService.reserveVideos(
      params.userId,
      params.model,
      Array.from({ length: outputNumber }, () => ({
        uuid: `vid_${nanoid(21)}`,
        batchUuid,
        userId: params.userId,
        prompt: params.prompt,
        model: params.model,
        parameters: {
          duration: validated.duration,
          aspectRatio: params.aspectRatio,
          quality: params.quality,
          outputNumber: 1,
          mode: validated.mode,
          imageUrl: validated.imageUrls[0],
          imageUrls: validated.imageUrls,
          generateAudio: params.generateAudio,
          removeWatermark: params.removeWatermark,
        },
        status: VideoStatus.PENDING,
        startImageUrl: validated.imageUrls[0] ?? null,
        creditsUsed: creditsPerOutput,
        duration: validated.duration,
        aspectRatio: params.aspectRatio ?? null,
        provider: initialProvider,
        updatedAt: new Date(),
      }))
    );

    try {
      await creditService.freezeMany(
        reservations.map((reservation) => ({
          userId: params.userId,
          credits: creditsPerOutput,
          videoUuid: reservation.uuid,
        }))
      );
    } catch (error) {
      await db
        .update(videos)
        .set({
          status: VideoStatus.FAILED,
          errorMessage: String(error),
          updatedAt: new Date(),
        })
        .where(eq(videos.batchUuid, batchUuid));
      const insufficientCreditsError = this.toInsufficientCreditsApiError(
        error,
        requiredCredits
      );
      if (insufficientCreditsError) throw insufficientCreditsError;
      throw error;
    }

    const settled = await Promise.allSettled(
      reservations.map((reservation) =>
        this.generate({
          ...params,
          outputNumber: 1,
          batchUuid,
          reservedVideoUuid: reservation.uuid,
        })
      )
    );
    const outputs = settled
      .filter((result): result is PromiseFulfilledResult<VideoGenerationResult> => result.status === "fulfilled")
      .map((result) => result.value);

    if (outputs.length === 0) {
      const firstFailure = settled.find(
        (result): result is PromiseRejectedResult => result.status === "rejected"
      );
      throw firstFailure?.reason ?? new Error("Every batch output failed to submit");
    }

    const primary = outputs[0]!;
    return {
      ...primary,
      batchUuid,
      creditsUsed: outputs.reduce((sum, output) => sum + output.creditsUsed, 0),
      outputs,
    };
  }

  /**
   * Try to mark as failed (transaction + optimistic lock)
   */
  async failGeneration(
    videoUuid: string,
    errorMessage?: string
  ): Promise<{ status: string; errorMessage?: string | null }> {
    const [video] = await db
        .select()
        .from(videos)
        .where(eq(videos.uuid, videoUuid))
        .limit(1);

      if (!video) {
        throw new Error("Video not found");
      }

      if (video.status === VideoStatus.COMPLETED) {
        return { status: video.status, errorMessage: video.errorMessage };
      }

      if (video.status === VideoStatus.FAILED) {
        await creditService.release(videoUuid);
        return { status: video.status, errorMessage: video.errorMessage };
      }

      // Completion owns the UPLOADING lease. A timeout or late provider failure
      // must not release the hold while storage and credit settlement are active.
      if (video.status === VideoStatus.UPLOADING) {
        return { status: video.status, errorMessage: video.errorMessage };
      }

      const [claimed] = await db
        .update(videos)
        .set({
          status: VideoStatus.FAILED,
          errorMessage: errorMessage || "Generation failed",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(videos.uuid, videoUuid),
            eq(videos.status, video.status)
          )
        )
        .returning({ uuid: videos.uuid });
      if (!claimed) {
        const [current] = await db
          .select({
            status: videos.status,
            errorMessage: videos.errorMessage,
          })
          .from(videos)
          .where(eq(videos.uuid, videoUuid))
          .limit(1);
        return {
          status: current?.status ?? video.status,
          errorMessage: current?.errorMessage ?? video.errorMessage,
        };
      }

      await creditService.release(videoUuid);

      emitVideoEvent({
        userId: video.userId,
        videoUuid,
        status: "FAILED",
        error: errorMessage || "Generation failed",
      });

      return {
        status: VideoStatus.FAILED,
        errorMessage: errorMessage || "Generation failed",
      };
  }

  /**
   * Get video details
   */
  async getVideo(uuid: string, userId: string) {
    const [video] = await db
      .select()
      .from(videos)
      .where(
        and(
          eq(videos.uuid, uuid),
          eq(videos.userId, userId),
          eq(videos.isDeleted, false)
        )
      )
      .limit(1);
    return video ?? null;
  }

  async retryVideo(uuid: string, userId: string) {
    const video = await this.getVideo(uuid, userId);
    if (!video) throw new ApiError("Video not found", 404);
    if (video.status !== VideoStatus.FAILED) {
      throw new ApiError("Only failed generations can be retried", 409);
    }
    const parameters = (video.parameters ?? {}) as {
      duration?: number;
      aspectRatio?: string;
      quality?: string;
      mode?: string;
      imageUrl?: string;
      imageUrls?: string[];
      generateAudio?: boolean;
      removeWatermark?: boolean;
    };
    return this.generate({
      userId,
      prompt: video.prompt,
      model: video.model,
      duration: parameters.duration ?? video.duration ?? undefined,
      aspectRatio: parameters.aspectRatio ?? video.aspectRatio ?? undefined,
      quality: parameters.quality,
      mode: parameters.mode,
      imageUrl: parameters.imageUrl ?? video.startImageUrl ?? undefined,
      imageUrls: parameters.imageUrls,
      generateAudio: parameters.generateAudio,
      removeWatermark: parameters.removeWatermark,
      outputNumber: 1,
    });
  }

  /**
   * Get user video list
   */
  async listVideos(
    userId: string,
    options?: {
      limit?: number;
      cursor?: string;
      status?: string;
      model?: string;
      sortBy?: "newest" | "oldest";
    }
  ) {
    const requestedLimit = options?.limit ?? 20;
    const limit = Number.isSafeInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 100)
      : 20;

    const conditions = [
      eq(videos.userId, userId),
      eq(videos.isDeleted, false),
    ];

    if (options?.status) {
      const status = options.status.toUpperCase();
      if (
        !Object.values(VideoStatus).includes(
          status as (typeof VideoStatus)[keyof typeof VideoStatus]
        )
      ) {
        throw new ApiError("Invalid video status", 400);
      }
      conditions.push(
        eq(
          videos.status,
          status as (typeof VideoStatus)[keyof typeof VideoStatus]
        )
      );
    }
    if (options?.model) conditions.push(eq(videos.model, options.model));

    if (options?.cursor) {
      const [cursorVideo] = await db
        .select({ createdAt: videos.createdAt })
        .from(videos)
        .where(
          and(
            eq(videos.uuid, options.cursor),
            eq(videos.userId, userId),
            eq(videos.isDeleted, false)
          )
        )
        .limit(1);

      if (cursorVideo) {
        conditions.push(
          options?.sortBy === "oldest"
            ? gt(videos.createdAt, cursorVideo.createdAt)
            : lt(videos.createdAt, cursorVideo.createdAt)
        );
      }
    }

    const list = await db
      .select()
      .from(videos)
      .where(and(...conditions))
      .orderBy(
        options?.sortBy === "oldest"
          ? asc(videos.createdAt)
          : desc(videos.createdAt)
      )
      .limit(limit + 1);

    const hasMore = list.length > limit;
    if (hasMore) list.pop();

    return {
      videos: list,
      nextCursor: hasMore ? list[list.length - 1]?.uuid : undefined,
      hasMore,
    };
  }

  /**
   * Delete video (soft delete)
   */
  async deleteVideo(uuid: string, userId: string): Promise<void> {
    const [deleted] = await db
      .update(videos)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(
        and(
          eq(videos.uuid, uuid),
          eq(videos.userId, userId),
          inArray(videos.status, [VideoStatus.COMPLETED, VideoStatus.FAILED])
        )
      )
      .returning({ uuid: videos.uuid });
    if (!deleted) {
      throw new ApiError("Only completed or failed videos can be deleted", 409);
    }
  }
}

export const videoService = new VideoService();
