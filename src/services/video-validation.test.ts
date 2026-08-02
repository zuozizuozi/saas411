import { describe, expect, it } from "vitest";

import { validateGenerationParams } from "./video-validation";

describe("video duration validation", () => {
  it("accepts every currently enabled native AI Video duration", () => {
    for (let duration = 5; duration <= 15; duration += 1) {
      expect(
        validateGenerationParams({
          model: "zhipu-video",
          duration,
          mode: "text-to-video",
        }).duration
      ).toBe(duration);
    }
  });

  it("rejects the visible but unavailable long-video range", () => {
    expect(() =>
      validateGenerationParams({
        model: "zhipu-video",
        duration: 30,
        mode: "text-to-video",
      })
    ).toThrow(/Unsupported duration/);
  });
});
