import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createZhipuAuthorization,
  createZhipuToken,
  ZhipuProvider,
} from "./zhipu";

describe("ZhipuProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates the short-lived JWT required by Zhipu", () => {
    const token = createZhipuToken("key-id.test-secret", 1_700_000_000_000);
    const [header, payload, signature] = token.split(".");

    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({
      alg: "HS256",
      sign_type: "SIGN",
    });
    expect(JSON.parse(Buffer.from(payload, "base64url").toString())).toEqual({
      api_key: "key-id",
      exp: 1_700_000_210_000,
      timestamp: 1_700_000_000_000,
    });
    expect(signature).toBeTruthy();
  });

  it("passes newer direct Bearer keys through without modification", () => {
    expect(createZhipuAuthorization("  direct-api-key  ")).toBe(
      "direct-api-key"
    );
  });

  it("creates a free CogVideoX Flash task with transformed parameters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "task_123",
          task_status: "PROCESSING",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new ZhipuProvider("test-key.test-secret");
    const result = await provider.createTask({
      model: "zhipu-video",
      prompt: "A cinematic product shot",
      aspectRatio: "9:16",
      duration: 5,
      quality: "quality",
      imageUrl: "https://example.com/frame.jpg",
      generateAudio: true,
    });

    expect(result).toMatchObject({
      taskId: "task_123",
      provider: "zhipu",
      status: "processing",
    });
    expect(fetchMock).toHaveBeenCalledOnce();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({
      Authorization: expect.stringMatching(/^Bearer [^.]+\.[^.]+\.[^.]+$/),
    });
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: "cogvideox-flash",
      prompt: "A cinematic product shot",
      quality: "quality",
      with_audio: true,
      watermark_enabled: true,
      size: "720x1280",
      duration: 5,
      image_url: "https://example.com/frame.jpg",
    });
  });

  it("maps a successful async result to the unified response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "task_123",
            task_status: "SUCCESS",
            video_result: [
              {
                url: "https://example.com/video.mp4",
                cover_image_url: "https://example.com/cover.jpg",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    const provider = new ZhipuProvider("test-key.test-secret");
    await expect(provider.getTaskStatus("task_123")).resolves.toMatchObject({
      taskId: "task_123",
      provider: "zhipu",
      status: "completed",
      videoUrl: "https://example.com/video.mp4",
      thumbnailUrl: "https://example.com/cover.jpg",
    });
  });
});
