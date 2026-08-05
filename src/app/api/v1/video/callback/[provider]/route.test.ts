import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  handleCallback: vi.fn(),
  verifyCallbackSignature: vi.fn(() => ({ valid: true })),
}));

vi.mock("@/services/video", () => ({
  videoService: { handleCallback: mocks.handleCallback },
}));

vi.mock("@/ai/utils/callback-signature", () => ({
  verifyCallbackSignature: mocks.verifyCallbackSignature,
}));

import { POST } from "./route";

const callbackUrl =
  "https://example.com/api/v1/video/callback/evolink" +
  "?videoUuid=vid_123&ts=123&sig=signature";

describe("AI callback request body", () => {
  beforeEach(() => {
    mocks.handleCallback.mockReset();
    mocks.verifyCallbackSignature.mockReturnValue({ valid: true });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 413 before parsing a callback larger than one MiB", async () => {
    const request = new Request(callbackUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(1024 * 1024 + 1),
      },
      body: "{}",
    });

    const response = await POST(request as never, {
      params: Promise.resolve({ provider: "evolink" }),
    });

    expect(response.status).toBe(413);
    expect(mocks.handleCallback).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON", async () => {
    const request = new Request(callbackUrl, {
      method: "POST",
      body: "not-json",
    });

    const response = await POST(request as never, {
      params: Promise.resolve({ provider: "evolink" }),
    });

    expect(response.status).toBe(400);
    expect(mocks.handleCallback).not.toHaveBeenCalled();
  });

  it("passes a valid bounded payload to the video service", async () => {
    const request = new Request(callbackUrl, {
      method: "POST",
      body: JSON.stringify({ task_id: "provider-task" }),
    });

    const response = await POST(request as never, {
      params: Promise.resolve({ provider: "evolink" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.handleCallback).toHaveBeenCalledWith(
      "evolink",
      { task_id: "provider-task" },
      "vid_123"
    );
  });
});
