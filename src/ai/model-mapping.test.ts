import { describe, expect, it } from "vitest";

import {
  getProviderModelId,
  transformParamsForProvider,
} from "./model-mapping";

describe("EvoLink Seedance model mapping", () => {
  it("selects text and image routes from the actual input", () => {
    expect(
      getProviderModelId("seedance-2.0-mini", "evolink", {})
    ).toBe("seedance-2.0-mini-text-to-video");
    expect(
      getProviderModelId("seedance-2.0-mini", "evolink", {
        imageUrls: ["https://example.com/first.png"],
      })
    ).toBe("seedance-2.0-mini-image-to-video");
    expect(
      getProviderModelId("seedance-2.0", "evolink", {
        imageUrl: "https://example.com/first.png",
      })
    ).toBe("seedance-2.0-image-to-video");
  });

  it("sends EvoLink's native Seedance parameter names", () => {
    const result = transformParamsForProvider("seedance-2.0", "evolink", {
      prompt: "A cinematic sunrise",
      duration: 15,
      aspectRatio: "16:9",
      quality: "1080P",
      generateAudio: true,
      removeWatermark: true,
      callbackUrl: "https://seedance.co/api/v1/video/callback/evolink",
    });

    expect(result).toMatchObject({
      prompt: "A cinematic sunrise",
      duration: 15,
      aspect_ratio: "16:9",
      quality: "1080p",
      generate_audio: true,
      content_filter: true,
      callback_url: "https://seedance.co/api/v1/video/callback/evolink",
    });
    expect(result).not.toHaveProperty("remove_watermark");
    expect(result).not.toHaveProperty("generateAudio");
  });

  it("uses the official five-second default without sending 2.0-only fields to 1.5 Pro", () => {
    const result = transformParamsForProvider("seedance-1.5-pro", "evolink", {
      prompt: "A product shot",
      quality: "720P",
    });

    expect(result).toMatchObject({
      prompt: "A product shot",
      duration: 5,
      aspect_ratio: "16:9",
      quality: "720p",
    });
    expect(result).not.toHaveProperty("content_filter");
    expect(result).not.toHaveProperty("remove_watermark");
  });
});
