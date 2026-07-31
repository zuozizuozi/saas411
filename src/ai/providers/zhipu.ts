import { createHmac } from "node:crypto";

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

type ZhipuPayload = {
  id?: string;
  task_status?: string;
  video_result?: Array<{
    url?: string;
    cover_image_url?: string;
  }>;
  error?: {
    code?: string | number;
    message?: string;
  };
  message?: string;
};

const ZHIPU_TOKEN_TTL_MS = 210_000;

/** Create the short-lived HS256 token required by the Zhipu API. */
export function createZhipuToken(apiKey: string, now = Date.now()): string {
  const separator = apiKey.indexOf(".");
  if (separator <= 0 || separator === apiKey.length - 1) {
    throw new Error("Invalid ZHIPU_API_KEY format. Expected id.secret.");
  }

  const keyId = apiKey.slice(0, separator);
  const secret = apiKey.slice(separator + 1);
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", sign_type: "SIGN" })
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      api_key: keyId,
      exp: now + ZHIPU_TOKEN_TTL_MS,
      timestamp: now,
    })
  ).toString("base64url");
  const unsignedToken = `${header}.${payload}`;
  const signature = createHmac("sha256", secret)
    .update(unsignedToken)
    .digest("base64url");

  return `${unsignedToken}.${signature}`;
}

/** Support both legacy id.secret keys and newer direct Bearer API keys. */
export function createZhipuAuthorization(apiKey: string): string {
  const normalized = apiKey.trim().replace(/^Bearer\s+/i, "");
  if (!normalized) {
    throw new Error("ZHIPU_API_KEY is empty.");
  }

  return normalized.includes(".") ? createZhipuToken(normalized) : normalized;
}

/**
 * Zhipu BigModel video provider.
 *
 * Official API:
 * - POST /api/paas/v4/videos/generations
 * - GET  /api/paas/v4/async-result/{id}
 */
export class ZhipuProvider implements AIVideoProvider {
  name = "zhipu";
  supportImageToVideo = true;

  private readonly baseUrl = "https://open.bigmodel.cn/api/paas/v4";

  constructor(private readonly apiKey: string) {}

  async createTask(params: VideoGenerationParams): Promise<VideoTaskResponse> {
    const internalModelId = params.model || "zhipu-video";
    if (params.prompt.length > 512) {
      throw new Error("Zhipu video prompts must be 512 characters or fewer");
    }

    const providerModelId = getProviderModelId(
      internalModelId,
      "zhipu",
      params
    );
    const transformedParams = transformParamsForProvider(
      internalModelId,
      "zhipu",
      params
    );

    const response = await providerFetch(`${this.baseUrl}/videos/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${createZhipuAuthorization(this.apiKey)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...transformedParams,
        model: providerModelId,
      }),
    });

    const data = await this.readResponse(response, "create video task");
    return this.toTaskResponse(data);
  }

  async getTaskStatus(taskId: string): Promise<VideoTaskResponse> {
    const response = await providerFetch(
      `${this.baseUrl}/async-result/${encodeURIComponent(taskId)}`,
      {
        headers: {
          Authorization: `Bearer ${createZhipuAuthorization(this.apiKey)}`,
        },
      }
    );

    const data = await this.readResponse(response, "get video task status");
    return this.toTaskResponse(data, taskId);
  }

  parseCallback(payload: ZhipuPayload): VideoTaskResponse {
    return this.toTaskResponse(payload);
  }

  private toTaskResponse(
    data: ZhipuPayload,
    fallbackTaskId?: string
  ): VideoTaskResponse {
    const taskId = requireProviderTaskId(
      data.id || fallbackTaskId,
      "Zhipu"
    );
    const result = data.video_result?.[0];
    const status = this.mapStatus(data.task_status);

    return {
      taskId,
      provider: "zhipu",
      status,
      videoUrl: result?.url,
      thumbnailUrl: result?.cover_image_url,
      error:
        status === "failed"
          ? {
              code: String(data.error?.code || "GENERATION_FAILED"),
              message:
                data.error?.message || data.message || "Video generation failed",
            }
          : undefined,
      raw: data,
    };
  }

  private mapStatus(status?: string): VideoTaskResponse["status"] {
    switch (status?.toUpperCase()) {
      case "SUCCESS":
      case "COMPLETED":
        return "completed";
      case "FAIL":
      case "FAILED":
        return "failed";
      case "PROCESSING":
      case "RUNNING":
        return "processing";
      default:
        return "pending";
    }
  }

  private async readResponse(
    response: Response,
    operation: string
  ): Promise<ZhipuPayload> {
    const data = (await response.json().catch(() => ({}))) as ZhipuPayload;
    if (response.ok && !data.error) return data;

    if (response.status === 401 || response.status === 403) {
      throw new Error("Zhipu authentication failed. Check ZHIPU_API_KEY.");
    }
    if (response.status === 429) {
      throw new Error("Zhipu rate limit exceeded. Please retry later.");
    }

    throw new Error(
      data.error?.message ||
        data.message ||
        `Failed to ${operation} (${response.status})`
    );
  }
}
