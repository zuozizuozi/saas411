import { describe, expect, it } from "vitest";

import { getAvailableModels } from "@/config/credits";
import { validateGenerationParams } from "./video-validation";

const model = getAvailableModels()[0];

describe("validateGenerationParams", () => {
  it("accepts valid text-to-video input", () => {
    expect(
      validateGenerationParams({
        model: model!.id,
        mode: "text-to-video",
        duration: model!.durations[0],
        aspectRatio: model!.aspectRatios[0],
      }).mode
    ).toBe("text-to-video");
  });

  it("requires one owned image URL for image-to-video input", () => {
    expect(() =>
      validateGenerationParams({ model: model!.id, mode: "image-to-video" })
    ).toThrow("requires one uploaded image");
  });

  it("rejects a source image in text-to-video mode", () => {
    expect(() =>
      validateGenerationParams({
        model: model!.id,
        mode: "text-to-video",
        imageUrl: "https://cdn.example.com/source.webp",
      })
    ).toThrow("does not accept an input image");
  });

  it.each([0, 3, 1.5])("rejects invalid output count %s", (outputNumber) => {
    expect(() =>
      validateGenerationParams({ model: model!.id, outputNumber })
    ).toThrow();
  });
});
