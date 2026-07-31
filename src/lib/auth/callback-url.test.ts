import { describe, expect, it } from "vitest";

import { getSafeAuthCallbackURL } from "./callback-url";

describe("getSafeAuthCallbackURL", () => {
  const fallback = "/zh/my-creations";

  it("keeps local paths, query strings, and hashes", () => {
    expect(getSafeAuthCallbackURL("/zh/text-to-video?id=1#result", fallback)).toBe(
      "/zh/text-to-video?id=1#result",
    );
  });

  it.each([
    "https://attacker.example/path",
    "//attacker.example/path",
    "javascript:alert(1)",
    "data:text/html,hello",
  ])("rejects unsafe callback %s", (candidate) => {
    expect(getSafeAuthCallbackURL(candidate, fallback)).toBe(fallback);
  });

  it("uses the fallback for empty input", () => {
    expect(getSafeAuthCallbackURL(null, fallback)).toBe(fallback);
  });
});
