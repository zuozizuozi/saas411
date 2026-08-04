import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  generateSignedCallbackUrl,
  verifyCallbackSignature,
} from "./callback-signature";

describe("callback signatures", () => {
  beforeEach(() => {
    process.env.CALLBACK_HMAC_SECRET = "test-callback-secret-at-least-32-bytes";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-04T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.CALLBACK_HMAC_SECRET = undefined;
  });

  it("accepts a freshly generated signature", () => {
    const url = new URL(
      generateSignedCallbackUrl("https://example.com/callback", "video-1")
    );
    expect(
      verifyCallbackSignature(
        "video-1",
        url.searchParams.get("ts")!,
        url.searchParams.get("sig")!
      )
    ).toEqual({ valid: true });
  });

  it("rejects timestamps too far in the future even with a valid HMAC", () => {
    const timestamp = String(Date.now() + 6 * 60 * 1000);
    const signature = crypto
      .createHmac("sha256", process.env.CALLBACK_HMAC_SECRET!)
      .update(`video-1:${timestamp}`)
      .digest("hex");
    expect(
      verifyCallbackSignature("video-1", timestamp, signature)
    ).toEqual({ valid: false, error: "Signature timestamp is in the future" });
  });

  it("rejects tampering", () => {
    const url = new URL(
      generateSignedCallbackUrl("https://example.com/callback", "video-1")
    );
    expect(
      verifyCallbackSignature(
        "video-2",
        url.searchParams.get("ts")!,
        url.searchParams.get("sig")!
      ).valid
    ).toBe(false);
  });

  it("rejects weak callback secrets", () => {
    process.env.CALLBACK_HMAC_SECRET = "too-short";
    expect(() =>
      generateSignedCallbackUrl("https://example.com/callback", "video-1")
    ).toThrow(/at least 32 bytes/i);
  });
});
