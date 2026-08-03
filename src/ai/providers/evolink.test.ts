import { afterEach, describe, expect, it, vi } from "vitest";

import { EvolinkProvider } from "./evolink";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("EvolinkProvider", () => {
  it("creates a Seedance task with the documented endpoint and payload", async () => {
    vi.stubEnv("EVOLINK_BASE_URL", "https://evolink.test/v1/");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "task-unified-123",
          status: "pending",
          progress: 0,
          task_info: { estimated_time: 165 },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const provider = new EvolinkProvider("secret-key");
    const task = await provider.createTask({
      model: "seedance-2.0-mini",
      prompt: "A cinematic sunrise",
      duration: 5,
      quality: "720P",
      aspectRatio: "16:9",
      generateAudio: true,
      callbackUrl: "https://seedance.co.com/api/v1/video/callback/evolink?sig=test",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://evolink.test/v1/videos/generations");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer secret-key",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: "seedance-2.0-mini-text-to-video",
      prompt: "A cinematic sunrise",
      duration: 5,
      quality: "720p",
      aspect_ratio: "16:9",
      generate_audio: true,
      content_filter: true,
      callback_url:
        "https://seedance.co.com/api/v1/video/callback/evolink?sig=test",
    });
    expect(task).toMatchObject({
      taskId: "task-unified-123",
      provider: "evolink",
      status: "pending",
      progress: 0,
      estimatedTime: 165,
    });
  });

  it("maps completed task results to the generated video URL", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "task-unified-456",
          status: "completed",
          progress: 100,
          results: ["https://files.evolink.ai/video.mp4"],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const task = await new EvolinkProvider("secret-key").getTaskStatus(
      "task-unified-456"
    );

    expect(task).toMatchObject({
      taskId: "task-unified-456",
      status: "completed",
      progress: 100,
      videoUrl: "https://files.evolink.ai/video.mp4",
    });
  });

  it("fails safely when EvoLink marks a task complete without a result", () => {
    const task = new EvolinkProvider("secret-key").parseCallback({
      id: "task-unified-789",
      status: "completed",
      progress: 100,
      results: [],
    });

    expect(task).toMatchObject({
      status: "failed",
      error: { code: "EVOLINK_RESULT_MISSING" },
    });
  });

  it("preserves structured EvoLink error details", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "insufficient_quota",
            message: "Please top up your account",
          },
        }),
        { status: 402, headers: { "content-type": "application/json" } }
      )
    );

    await expect(
      new EvolinkProvider("secret-key").createTask({
        model: "seedance-2.0-mini",
        prompt: "test",
      })
    ).rejects.toThrow(
      "EvoLink task creation failed (402): insufficient_quota: Please top up your account"
    );
  });
});
