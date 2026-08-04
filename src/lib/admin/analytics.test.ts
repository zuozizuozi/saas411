import { describe, expect, it } from "vitest";

import { getTimeRangeStart, normalizeTimeRange } from "./analytics";

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

  it.each([
    ["today", "2026-08-04T00:00:00.000Z"],
    ["7d", "2026-07-29T00:00:00.000Z"],
    ["30d", "2026-07-06T00:00:00.000Z"],
    ["90d", "2026-05-07T00:00:00.000Z"],
  ] as const)("uses an inclusive UTC boundary for %s", (range, expected) => {
    expect(
      getTimeRangeStart(range, new Date("2026-08-04T15:30:00.000Z"))?.toISOString(),
    ).toBe(expected);
  });

  it("does not add a lower boundary to the all-time range", () => {
    expect(getTimeRangeStart("all")).toBeNull();
  });
});
