import { describe, expect, it } from "vitest";

import { assertSafeRemoteMediaUrl } from "./storage";

describe("assertSafeRemoteMediaUrl", () => {
  it("allows a public HTTPS URL", () => {
    expect(assertSafeRemoteMediaUrl("https://cdn.example.com/video.mp4").hostname).toBe(
      "cdn.example.com"
    );
  });

  it.each([
    "http://cdn.example.com/video.mp4",
    "https://localhost/video.mp4",
    "https://127.0.0.1/video.mp4",
    "https://10.0.0.1/video.mp4",
    "https://192.168.1.1/video.mp4",
    "https://[::1]/video.mp4",
  ])("rejects unsafe provider URL %s", (url) => {
    expect(() => assertSafeRemoteMediaUrl(url)).toThrow();
  });
});
