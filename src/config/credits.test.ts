import { describe, expect, it } from "vitest";

import { calculateModelCredits } from "./credits";

describe("linear video credit pricing", () => {
  it("uses the configured Seedance 2.0 Mini quality rates", () => {
    expect(
      calculateModelCredits("seedance-2.0-mini", {
        duration: 5,
        quality: "480P",
      })
    ).toBe(35);
    expect(
      calculateModelCredits("seedance-2.0-mini", {
        duration: 5,
        quality: "720P",
      })
    ).toBe(70);
  });

  it("keeps every model price strictly proportional to duration", () => {
    const oneSecond = calculateModelCredits("seedance-1.5-pro", {
      duration: 1,
      quality: "1080P",
    });
    const twelveSeconds = calculateModelCredits("seedance-1.5-pro", {
      duration: 12,
      quality: "1080P",
    });

    expect(twelveSeconds).toBe(oneSecond * 12);
  });
});
