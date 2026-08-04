import { describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async (hostname: string) =>
    hostname === "private.example.com"
      ? [{ address: "10.0.0.5", family: 4 }]
      : [{ address: "203.0.113.10", family: 4 }]
  ),
}));

import {
  assertSafeRemoteMediaUrl,
  assertSafeRemoteMediaUrlResolved,
  detectSupportedImageType,
} from "./storage";

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

describe("assertSafeRemoteMediaUrlResolved", () => {
  it("rejects a public-looking hostname that resolves to a private address", async () => {
    await expect(
      assertSafeRemoteMediaUrlResolved("https://private.example.com/video.mp4")
    ).rejects.toThrow(/private network/i);
  });

  it("allows a hostname when every resolved address is public", async () => {
    await expect(
      assertSafeRemoteMediaUrlResolved("https://cdn.example.com/video.mp4")
    ).resolves.toMatchObject({ hostname: "cdn.example.com" });
  });
});

describe("detectSupportedImageType", () => {
  it("detects supported image magic bytes", () => {
    expect(detectSupportedImageType(Uint8Array.from([0xff, 0xd8, 0xff]))).toBe(
      "image/jpeg"
    );
    expect(
      detectSupportedImageType(
        Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      )
    ).toBe("image/png");
  });

  it("rejects HTML disguised as an image", () => {
    expect(detectSupportedImageType(Buffer.from("<script>alert(1)</script>"))).toBeNull();
  });
});
