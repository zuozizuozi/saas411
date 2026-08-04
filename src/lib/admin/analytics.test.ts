import { describe, expect, it } from "vitest";

import { normalizeTimeRange } from "./analytics";

describe("admin analytics range", () => {
  it.each(["today", "7d", "30d", "90d", "all"])(
    "keeps supported range %s",
    (range) => {
      expect(normalizeTimeRange(range)).toBe(range);
    },
  );

  it.each([undefined, "", "invalid", "365d"])(
    "falls back to 30d for %s",
    (range) => {
      expect(normalizeTimeRange(range)).toBe("30d");
    },
  );
});
