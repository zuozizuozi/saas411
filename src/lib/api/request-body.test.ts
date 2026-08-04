import { describe, expect, it } from "vitest";

import { readRequestTextWithLimit } from "./request-body";

describe("readRequestTextWithLimit", () => {
  it("returns a body that is within the limit", async () => {
    const request = new Request("https://example.com/webhook", {
      method: "POST",
      body: "stripe-payload",
    });

    await expect(readRequestTextWithLimit(request, 32)).resolves.toBe(
      "stripe-payload"
    );
  });

  it("rejects a declared body larger than the limit", async () => {
    const request = new Request("https://example.com/webhook", {
      method: "POST",
      headers: { "content-length": "1025" },
      body: "small",
    });

    await expect(readRequestTextWithLimit(request, 1024)).rejects.toMatchObject({
      status: 413,
    });
  });

  it("rejects a streamed body that grows beyond the limit", async () => {
    const request = new Request("https://example.com/webhook", {
      method: "POST",
      body: "123456",
    });

    await expect(readRequestTextWithLimit(request, 5)).rejects.toMatchObject({
      status: 413,
    });
  });
});
