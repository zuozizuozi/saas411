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

type BailianPayload = {
  request_id?: string;
  code?: string;
  message?: string;
  output?: {
    task_id?: string;
    task_status?: string;
    video_url?: string;
    code?: string;
    message?: string;
  };
};

const DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/api/v1";

export class BailianProvider implements AIVideoProvider {
  name = "bailian";
  supportImageToVideo = true;

  private readonly baseUrl: string;

  constructor(private readonly apiKey: string) {
    this.baseUrl = (process.env.BAILIAN_BASE_URL || DEFAULT_BASE_URL).replace(
      /\/+$/,
      ""
    );
  }

  async createTask(params: VideoGenerationParams): Promise<VideoTaskResponse> {
    const internalModelId = params.model || "zhipu-video";
    const providerModelId = getProviderModelId(
      internalModelId,
      "bailian",
      params
    );
    const transformedParams = transformParamsForProvider(
      internalModelId,
      "bailian",
      params
    );

    const response = await providerFetch(
      `${this.baseUrl}/services/aigc/video-generation/video-synthesis`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey.trim()}`,
          "Content-Type": "application/json",
          "X-DashScope-Async": "enable",
        },
        body: JSON.stringify({
          model: providerModelId,
          ...transformedParams,
        }),
      }
    );

    const data = await this.readResponse(response, "create video task");
    return this.toTaskResponse(data);
  }

  async getTaskStatus(taskId: string): Promise<VideoTaskResponse> {
    const response = await providerFetch(
      `${this.baseUrl}/tasks/${encodeURIComponent(taskId)}`,
      {
        headers: { Authorization: `Bearer ${this.apiKey.trim()}` },
      }
    );

    const data = await this.readResponse(response, "get video task status");
    return this.toTaskResponse(data, taskId);
  }

  parseCallback(payload: BailianPayload): VideoTaskResponse {
    return this.toTaskResponse(payload);
  }

  private toTaskResponse(
    data: BailianPayload,
    fallbackTaskId?: string
  ): VideoTaskResponse {
    const output = data.output;
    const taskId = requireProviderTaskId(
      output?.task_id || fallbackTaskId,
      "Bailian"
    );
    const status = this.mapStatus(output?.task_status);

    return {
      taskId,
      provider: "bailian",
      status,
      videoUrl: output?.video_url,
      error:
        status === "failed"
          ? {
              code: output?.code || data.code || "GENERATION_FAILED",
              message:
                output?.message ||
                data.message ||
                "Video generation failed",
            }
          : undefined,
      raw: data,
    };
  }

  private mapStatus(status?: string): VideoTaskResponse["status"] {
    switch (status?.toUpperCase()) {
      case "SUCCEEDED":
        return "completed";
      case "FAILED":
      case "CANCELED":
      case "UNKNOWN":
        return "failed";
      case "RUNNING":
        return "processing";
      default:
        return "pending";
    }
  }

  private async readResponse(
    response: Response,
    operation: string
  ): Promise<BailianPayload> {
    const data = (await response.json().catch(() => ({}))) as BailianPayload;
    if (response.ok && !data.code) return data;

    const code = data.code || `HTTP_${response.status}`;
    const message = data.message || `Failed to ${operation}`;
    if (
      response.status === 401 ||
      response.status === 403 ||
      /invalid.*api.*key|unauthorized/i.test(`${code} ${message}`)
    ) {
      throw new Error(
        `Bailian authentication failed (${code}). Check BAILIAN_API_KEY and endpoint region.`
      );
    }
    if (
      response.status === 429 ||
      /throttl|rate.?limit|quota/i.test(`${code} ${message}`)
    ) {
      throw new Error(`Bailian rate limit exceeded (${code}). Please retry later.`);
    }

    throw new Error(`Bailian ${operation} failed (${code}): ${message}`);
  }
}
