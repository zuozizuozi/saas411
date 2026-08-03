import type {
  AIVideoProvider,
  VideoGenerationParams,
  VideoTaskResponse,
} from "../types";
import {
  getProviderModelId,
  transformParamsForProvider,
} from "../model-mapping";
import { providerFetch, requireProviderTaskId } from "../provider-http";

type EvolinkError = {
  code?: string;
  message?: string;
  type?: string;
};

type EvolinkTask = {
  id?: unknown;
  status?: unknown;
  progress?: unknown;
  results?: unknown;
  task_info?: { estimated_time?: unknown };
  data?: { video_url?: unknown; thumbnail_url?: unknown };
  error?: EvolinkError | string | null;
};

function normalizeError(error: EvolinkTask["error"], fallback: string) {
  if (typeof error === "string" && error.trim()) {
    return { code: "EVOLINK_TASK_FAILED", message: error };
  }
  if (error && typeof error === "object") {
    return {
      code: error.code || error.type || "EVOLINK_TASK_FAILED",
      message: error.message || fallback,
    };
  }
  return { code: "EVOLINK_TASK_FAILED", message: fallback };
}

async function readErrorResponse(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: EvolinkError | string;
      message?: string;
    };
    if (typeof body.error === "string") return body.error;
    const error = body.error;
    const message =
      (error && typeof error === "object" && error.message) || body.message;
    const code = error && typeof error === "object" ? error.code : undefined;
    return [code, message].filter(Boolean).join(": ") || response.statusText;
  } catch {
    return (await response.text().catch(() => "")) || response.statusText;
  }
}

export class EvolinkProvider implements AIVideoProvider {
  name = "evolink";
  supportImageToVideo = true; // evolink supports image-to-video
  private apiKey: string;
  private baseUrl = (
    process.env.EVOLINK_BASE_URL || "https://api.evolink.ai/v1"
  ).replace(/\/$/, "");

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async createTask(params: VideoGenerationParams): Promise<VideoTaskResponse> {
    const internalModelId = params.model || "sora-2";
    const providerModelId = getProviderModelId(
      internalModelId,
      "evolink",
      params
    );
    const transformedParams = transformParamsForProvider(
      internalModelId,
      "evolink",
      params
    );

    const response = await providerFetch(`${this.baseUrl}/videos/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...transformedParams,
        model: providerModelId,
      }),
    });

    if (!response.ok) {
      const detail = await readErrorResponse(response);
      throw new Error(
        `EvoLink task creation failed (${response.status}): ${detail}`
      );
    }

    const data = (await response.json()) as EvolinkTask;
    return this.toTaskResponse(data);
  }

  async getTaskStatus(taskId: string): Promise<VideoTaskResponse> {
    const response = await providerFetch(
      `${this.baseUrl}/tasks/${taskId}`,
      {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      }
    );

    if (!response.ok) {
      const errorText = await readErrorResponse(response);
      // Handle task not found (404) or gone (410)
      if (response.status === 404 || response.status === 410) {
        return {
          taskId,
          provider: "evolink",
          status: "failed",
          error: {
            code: "TASK_NOT_FOUND",
            message: errorText || "Task not found or expired",
          },
        };
      }
      // Handle rate limiting (429)
      if (response.status === 429) {
        throw new Error(
          `Rate limit exceeded. Please retry later. ${errorText}`
        );
      }
      // Handle unauthorized (401) or forbidden (403)
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          `Authentication failed. Check your API key. ${errorText}`
        );
      }
      // Generic error
      throw new Error(
        `Failed to get task status (${response.status}): ${errorText}`
      );
    }

    const data = (await response.json()) as EvolinkTask;
    return this.toTaskResponse(data, taskId);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parseCallback(payload: any): VideoTaskResponse {
    // EvoLink documents callbacks as the same shape as task status responses.
    return this.toTaskResponse(payload as EvolinkTask);
  }

  private toTaskResponse(
    data: EvolinkTask,
    fallbackTaskId?: string
  ): VideoTaskResponse {
    const taskId = requireProviderTaskId(
      typeof data.id === "string" ? data.id : fallbackTaskId,
      "EvoLink"
    );
    const status = this.mapStatus(data.status);
    const videoUrl = Array.isArray(data.results)
      ? data.results.find(
          (result): result is string =>
            typeof result === "string" && result.length > 0
        )
      : typeof data.data?.video_url === "string"
        ? data.data.video_url
        : undefined;
    const thumbnailUrl =
      typeof data.data?.thumbnail_url === "string"
        ? data.data.thumbnail_url
        : undefined;

    if (status === "completed" && !videoUrl) {
      return {
        taskId,
        provider: "evolink",
        status: "failed",
        progress: typeof data.progress === "number" ? data.progress : undefined,
        error: {
          code: "EVOLINK_RESULT_MISSING",
          message: "EvoLink completed the task without returning a video URL",
        },
        raw: data,
      };
    }

    return {
      taskId,
      provider: "evolink",
      status,
      progress: typeof data.progress === "number" ? data.progress : undefined,
      estimatedTime:
        typeof data.task_info?.estimated_time === "number"
          ? data.task_info.estimated_time
          : undefined,
      videoUrl,
      thumbnailUrl,
      error:
        status === "failed"
          ? normalizeError(data.error, "EvoLink video generation failed")
          : undefined,
      raw: data,
    };
  }

  private mapStatus(status: unknown): VideoTaskResponse["status"] {
    const map: Record<string, VideoTaskResponse["status"]> = {
      pending: "pending",
      processing: "processing",
      completed: "completed",
      failed: "failed",
      cancelled: "failed",
    };
    return typeof status === "string" ? map[status] || "pending" : "pending";
  }
}
