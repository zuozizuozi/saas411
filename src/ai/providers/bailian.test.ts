import { afterEach, describe, expect, it, vi } from "vitest";

import { BailianProvider } from "./bailian";

describe("BailianProvider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("creates a Wan 2.7 text-to-video task with the async API contract", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output: { task_id: "task_t2v", task_status: "PENDING" },
          request_id: "request_1",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubEnv("BAILIAN_T2V_MODEL", "wan2.7-t2v");
    vi.stubGlobal("fetch", fetchMock);

    const provider = new BailianProvider("sk-test-key");
    const result = await provider.createTask({
      model: "zhipu-video",
      prompt: "A paper boat sailing through a rainy neon city",
      aspectRatio: "9:16",
      duration: 5,
      quality: "speed",
    });

    expect(result).toMatchObject({
      taskId: "task_t2v",
      provider: "bailian",
      status: "pending",
    });
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis"
    );
    expect(init.headers).toMatchObject({
      Authorization: "Bearer sk-test-key",
      "Content-Type": "application/json",
      "X-DashScope-Async": "enable",
    });
    expect(JSON.parse(String(init.body))).toEqual({
      model: "wan2.7-t2v",
      input: { prompt: "A paper boat sailing through a rainy neon city" },
      parameters: {
        resolution: "720P",
        duration: 5,
        prompt_extend: true,
        watermark: false,
        ratio: "9:16",
      },
    });
  });

  it("maps two images to first and last frame without sending a ratio", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output: { task_id: "task_i2v", task_status: "RUNNING" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubEnv("BAILIAN_I2V_MODEL", "wan2.7-i2v");
    vi.stubGlobal("fetch", fetchMock);

    const provider = new BailianProvider("sk-test-key");
    const result = await provider.createTask({
      model: "zhipu-video",
      prompt: "The camera slowly pushes in",
      aspectRatio: "16:9",
      duration: 10,
      quality: "quality",
      imageUrls: [
        "https://example.com/first.png",
        "https://example.com/last.png",
      ],
    });

    expect(result.status).toBe("processing");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      model: "wan2.7-i2v",
      input: {
        prompt: "The camera slowly pushes in",
        media: [
          { type: "first_frame", url: "https://example.com/first.png" },
          { type: "last_frame", url: "https://example.com/last.png" },
        ],
      },
      parameters: {
        resolution: "1080P",
        duration: 10,
        prompt_extend: true,
        watermark: false,
      },
    });
  });

  it("maps a successful task result to the unified response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            output: {
              task_id: "task_123",
              task_status: "SUCCEEDED",
              video_url: "https://example.com/video.mp4",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    const provider = new BailianProvider("sk-test-key");
    await expect(provider.getTaskStatus("task_123")).resolves.toMatchObject({
      taskId: "task_123",
      provider: "bailian",
      status: "completed",
      videoUrl: "https://example.com/video.mp4",
    });
  });

  it("classifies throttling as retryable for the provider router", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "Throttling.RateQuota",
            message: "Requests rate limit exceeded",
          }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    const provider = new BailianProvider("sk-test-key");
    await expect(
      provider.createTask({ model: "zhipu-video", prompt: "Test" })
    ).rejects.toThrow(/Bailian rate limit exceeded.*retry later/i);
  });
});
