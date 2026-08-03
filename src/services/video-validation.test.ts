import { describe, expect, it } from "vitest";

import { validateGenerationParams } from "./video-validation";

describe("video duration validation", () => {
  it("accepts every native Seedance 2.0 Mini duration", () => {
    for (let duration = 4; duration <= 15; duration += 1) {
      expect(
        validateGenerationParams({
          model: "seedance-2.0-mini",
          duration,
          mode: "text-to-video",
        }).duration
      ).toBe(duration);
    }
  });

  it("keeps Seedance 1.5 Pro within its native 4-12 second range", () => {
    expect(
      validateGenerationParams({
        model: "seedance-1.5-pro",
        duration: 12,
        mode: "text-to-video",
      }).duration
    ).toBe(12);

    expect(() =>
      validateGenerationParams({
        model: "seedance-1.5-pro",
        duration: 13,
        mode: "text-to-video",
      })
    ).toThrow(/Unsupported duration/);
  });

  it("rejects the Seedance 2.5 catalog placeholder", () => {
    expect(() =>
      validateGenerationParams({
        model: "seedance-2.5",
        duration: 5,
        mode: "text-to-video",
      })
    ).toThrow(/Unsupported model/);
  });
});
