import { describe, expect, it } from "vitest";

import { summarizeTrend, toPercentage } from "./analytics-metrics";

describe("admin analytics metrics", () => {
  it("returns a safe percentage for an empty denominator", () => {
    expect(toPercentage(5, 0)).toBe(0);
  });

  it("rounds percentages to one decimal place", () => {
    expect(toPercentage(2, 3)).toBe(66.7);
  });

  it("weights the trend summary by users rather than averaging daily rates", () => {
    expect(
      summarizeTrend([
        {
          registeredUsers: 100,
          firstVideoUsers: 50,
          successfulFirstVideoUsers: 25,
        },
        {
          registeredUsers: 1,
          firstVideoUsers: 1,
          successfulFirstVideoUsers: 1,
        },
      ]),
    ).toEqual({
      registeredUsers: 101,
      firstVideoUsers: 51,
      successfulFirstVideoUsers: 26,
      firstVideoConversionRate: 50.5,
      firstVideoSuccessRate: 51,
    });
  });
});
