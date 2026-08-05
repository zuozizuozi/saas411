import { createHash, randomUUID } from "node:crypto";

import { contentModerationEvents, db } from "@/db";
import { ApiError } from "@/lib/api/error";
import {
  assessLocalContentSafety,
  parseExternalModerationDecision,
  type ExternalModerationDecision,
} from "./content-safety-policy";

export type ContentSafetyMode = "provider" | "observe" | "enforce";
export type ContentModerationStatus =
  | "ALLOWED"
  | "PROVIDER_ONLY"
  | "BLOCKED"
  | "ERROR";

export interface ContentSafetyResult {
  status: ContentModerationStatus;
  reason: string;
  mode: ContentSafetyMode;
}

interface ModerateInput {
  userId: string;
  model: string;
  prompt: string;
  imageUrls: string[];
}

interface ModerateOutputInput {
  userId: string;
  videoUuid: string;
  model: string;
  prompt: string;
  thumbnailUrl?: string;
}

interface WaveSpeedResult extends ExternalModerationDecision {
  requestId: string | null;
}

function contentSafetyMode(): ContentSafetyMode {
  const configured = process.env.CONTENT_SAFETY_MODE?.trim().toLowerCase();
  return configured === "observe" || configured === "enforce"
    ? configured
    : "provider";
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function timeoutMs() {
  const configured = Number(process.env.CONTENT_SAFETY_TIMEOUT_MS ?? 12_000);
  return Number.isFinite(configured)
    ? Math.min(Math.max(Math.round(configured), 2_000), 30_000)
    : 12_000;
}

async function requestJson(url: string, init: RequestInit, deadline: number) {
  const controller = new AbortController();
  const remaining = Math.max(1, deadline - Date.now());
  const timer = setTimeout(() => controller.abort(), remaining);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`WaveSpeed moderation failed (${response.status})`);
    }
    return (await response.json()) as Record<string, unknown>;
  } finally {
    clearTimeout(timer);
  }
}

function predictionData(body: Record<string, unknown>) {
  return body.data && typeof body.data === "object"
    ? (body.data as Record<string, unknown>)
    : body;
}

function safePredictionUrl(value: unknown, requestId: string) {
  const fallback = `https://api.wavespeed.ai/api/v3/predictions/${encodeURIComponent(
    requestId
  )}/result`;
  if (typeof value !== "string") return fallback;
  const parsed = new URL(value);
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== "api.wavespeed.ai" ||
    !parsed.pathname.startsWith("/api/v3/predictions/")
  ) {
    throw new Error("WaveSpeed returned an unexpected prediction URL");
  }
  return parsed.toString();
}

function moderationPayload(outputs: unknown) {
  const first = Array.isArray(outputs) ? outputs[0] : outputs;
  if (typeof first !== "string") return first;
  const trimmed = first.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return first;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return first;
  }
}

async function runWaveSpeedModerator(
  kind: "text" | "image",
  input: { text: string; image?: string }
): Promise<WaveSpeedResult> {
  const apiKey = process.env.WAVESPEED_API_KEY?.trim();
  if (!apiKey) throw new Error("WAVESPEED_API_KEY is not configured");

  const deadline = Date.now() + timeoutMs();
  const body = await requestJson(
    `https://api.wavespeed.ai/api/v3/wavespeed-ai/content-moderator/${kind}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: input.text,
        ...(input.image ? { image: input.image } : {}),
        enable_sync_mode: true,
      }),
    },
    deadline
  );
  let task = predictionData(body);
  const requestId = typeof task.id === "string" ? task.id : null;

  while (task.status === "created" || task.status === "processing") {
    if (!requestId || Date.now() >= deadline) {
      throw new Error("WaveSpeed moderation timed out");
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
    const urls =
      task.urls && typeof task.urls === "object"
        ? (task.urls as Record<string, unknown>)
        : undefined;
    const resultUrl = safePredictionUrl(urls?.get, requestId);
    task = predictionData(
      await requestJson(
        resultUrl,
        { headers: { Authorization: `Bearer ${apiKey}` } },
        deadline
      )
    );
  }

  if (task.status === "failed" || task.status === "cancelled" || task.status === "timeout") {
    throw new Error("WaveSpeed moderation did not complete successfully");
  }
  const decision = parseExternalModerationDecision(
    moderationPayload(task.outputs ?? task.output ?? task.result)
  );
  if (!decision) throw new Error("WaveSpeed returned an ambiguous moderation result");
  return { ...decision, requestId };
}

async function recordModerationEvent(input: {
  userId: string;
  videoUuid?: string;
  stage: string;
  provider: string;
  decision: string;
  model: string;
  promptHash: string;
  assetHash?: string;
  categories?: string[];
  reason: string;
  externalRequestId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(contentModerationEvents).values({
    eventKey: `moderation:${randomUUID()}`,
    userId: input.userId,
    videoUuid: input.videoUuid,
    stage: input.stage,
    provider: input.provider,
    decision: input.decision,
    model: input.model,
    promptHash: input.promptHash,
    assetHash: input.assetHash,
    categories: input.categories ?? [],
    reason: input.reason,
    externalRequestId: input.externalRequestId,
    metadata: input.metadata,
  });
}

function blockedError(categories: string[]) {
  return new ApiError(
    "This request cannot be processed because it violates the content policy.",
    400,
    { code: "CONTENT_MODERATION_BLOCKED", categories }
  );
}

function unavailableError() {
  return new ApiError(
    "Content safety verification is temporarily unavailable. Please try again later.",
    503,
    { code: "CONTENT_MODERATION_UNAVAILABLE" }
  );
}

export const contentSafetyService = {
  async moderateGenerationInput(input: ModerateInput): Promise<ContentSafetyResult> {
    const mode = contentSafetyMode();
    const promptHash = sha256(input.prompt);
    const local = assessLocalContentSafety(input.prompt);
    await recordModerationEvent({
      userId: input.userId,
      stage: "INPUT_TEXT",
      provider: "LOCAL_POLICY",
      decision: local.allowed ? "ALLOW" : "BLOCK",
      model: input.model,
      promptHash,
      categories: local.categories,
      reason: local.reason,
      metadata: { mode },
    });
    if (!local.allowed) throw blockedError(local.categories);

    const apiKeyConfigured = Boolean(process.env.WAVESPEED_API_KEY?.trim());
    if (mode === "provider" || !apiKeyConfigured) {
      if (mode === "enforce") {
        await recordModerationEvent({
          userId: input.userId,
          stage: "INPUT",
          provider: "WAVESPEED",
          decision: "ERROR",
          model: input.model,
          promptHash,
          reason: "External moderator is required but not configured.",
          metadata: { mode },
        });
        throw unavailableError();
      }
      return {
        status: "PROVIDER_ONLY",
        reason: "Local policy passed; provider-native safety checks remain enabled.",
        mode,
      };
    }

    const checks: Array<{
      stage: string;
      assetHash?: string;
      run: () => Promise<WaveSpeedResult>;
    }> = [
      {
        stage: "INPUT_TEXT",
        run: () => runWaveSpeedModerator("text", { text: input.prompt }),
      },
      ...input.imageUrls.map((imageUrl) => ({
        stage: "INPUT_IMAGE",
        assetHash: sha256(imageUrl),
        run: () =>
          runWaveSpeedModerator("image", {
            text: input.prompt,
            image: imageUrl,
          }),
      })),
    ];

    for (const [index, check] of checks.entries()) {
      try {
        const external = await check.run();
        await recordModerationEvent({
          userId: input.userId,
          stage: check.stage,
          provider: "WAVESPEED",
          decision: external.allowed ? "ALLOW" : mode === "observe" ? "OBSERVE" : "BLOCK",
          model: input.model,
          promptHash,
          assetHash: check.assetHash,
          categories: external.categories,
          reason: external.reason,
          externalRequestId: external.requestId,
          metadata: { mode, checkIndex: index },
        });
        if (!external.allowed && mode === "enforce") {
          throw blockedError(external.categories);
        }
      } catch (error) {
        if (error instanceof ApiError) throw error;
        await recordModerationEvent({
          userId: input.userId,
          stage: check.stage,
          provider: "WAVESPEED",
          decision: "ERROR",
          model: input.model,
          promptHash,
          assetHash: check.assetHash,
          reason: error instanceof Error ? error.message : "External moderation failed",
          metadata: { mode, checkIndex: index },
        });
        if (mode === "enforce") throw unavailableError();
      }
    }

    return {
      status: mode === "enforce" ? "ALLOWED" : "PROVIDER_ONLY",
      reason:
        mode === "enforce"
          ? "Local and external input moderation passed."
          : "External moderation ran in observation mode; provider safety remains enforced.",
      mode,
    };
  },

  async moderateGenerationOutput(
    input: ModerateOutputInput
  ): Promise<ContentSafetyResult> {
    const mode = contentSafetyMode();
    const promptHash = sha256(input.prompt);
    const apiKeyConfigured = Boolean(process.env.WAVESPEED_API_KEY?.trim());
    if (mode === "provider" || !apiKeyConfigured || !input.thumbnailUrl) {
      if (
        mode === "enforce" &&
        process.env.CONTENT_SAFETY_REQUIRE_OUTPUT_SCAN === "true" &&
        (!apiKeyConfigured || !input.thumbnailUrl)
      ) {
        await recordModerationEvent({
          userId: input.userId,
          videoUuid: input.videoUuid,
          stage: "OUTPUT_THUMBNAIL",
          provider: "WAVESPEED",
          decision: "ERROR",
          model: input.model,
          promptHash,
          reason: "Required output thumbnail moderation could not run.",
          metadata: { mode, thumbnailPresent: Boolean(input.thumbnailUrl) },
        });
        throw unavailableError();
      }
      return {
        status: "PROVIDER_ONLY",
        reason: "Provider-native output safety applied; no external thumbnail decision was required.",
        mode,
      };
    }

    try {
      const external = await runWaveSpeedModerator("image", {
        text: input.prompt,
        image: input.thumbnailUrl,
      });
      await recordModerationEvent({
        userId: input.userId,
        videoUuid: input.videoUuid,
        stage: "OUTPUT_THUMBNAIL",
        provider: "WAVESPEED",
        decision: external.allowed ? "ALLOW" : mode === "observe" ? "OBSERVE" : "BLOCK",
        model: input.model,
        promptHash,
        assetHash: sha256(input.thumbnailUrl),
        categories: external.categories,
        reason: external.reason,
        externalRequestId: external.requestId,
        metadata: { mode },
      });
      if (!external.allowed && mode === "enforce") {
        throw blockedError(external.categories);
      }
      return {
        status: mode === "enforce" ? "ALLOWED" : "PROVIDER_ONLY",
        reason: external.reason,
        mode,
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      await recordModerationEvent({
        userId: input.userId,
        videoUuid: input.videoUuid,
        stage: "OUTPUT_THUMBNAIL",
        provider: "WAVESPEED",
        decision: "ERROR",
        model: input.model,
        promptHash,
        assetHash: sha256(input.thumbnailUrl),
        reason: error instanceof Error ? error.message : "External moderation failed",
        metadata: { mode },
      });
      if (mode === "enforce") throw unavailableError();
      return {
        status: "PROVIDER_ONLY",
        reason: "External output moderation failed in observation mode.",
        mode,
      };
    }
  },
};
