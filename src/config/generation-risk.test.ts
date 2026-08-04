import { describe, expect, it } from "vitest";

import { assessAnnualCreditVelocity } from "./generation-risk";

describe("assessAnnualCreditVelocity", () => {
  it("ignores small absolute consumption", () => {
    expect(
      assessAnnualCreditVelocity({
        consumedCredits: 900,
        grantedCredits: 3_360,
        elapsedHours: 12,
      })
    ).toEqual({ level: "NONE" });
  });

  it("warns after 25 percent is consumed in 24 hours", () => {
    expect(
      assessAnnualCreditVelocity({
        consumedCredits: 2_700,
        grantedCredits: 10_800,
        elapsedHours: 20,
      })
    ).toMatchObject({ level: "LOW", windowHours: 24 });
  });

  it("pauses after 50 percent is consumed in 24 hours", () => {
    expect(
      assessAnnualCreditVelocity({
        consumedCredits: 5_400,
        grantedCredits: 10_800,
        elapsedHours: 18,
      })
    ).toMatchObject({ level: "HIGH", windowHours: 24 });
  });

  it("pauses after 80 percent is consumed in 48 hours", () => {
    expect(
      assessAnnualCreditVelocity({
        consumedCredits: 8_640,
        grantedCredits: 10_800,
        elapsedHours: 36,
      })
    ).toMatchObject({ level: "HIGH", windowHours: 48 });
  });

  it("does not flag the same consumption outside the configured window", () => {
    expect(
      assessAnnualCreditVelocity({
        consumedCredits: 8_640,
        grantedCredits: 10_800,
        elapsedHours: 49,
      })
    ).toEqual({ level: "NONE" });
  });
});
