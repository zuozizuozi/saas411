import { describe, expect, it } from "vitest";

import { calculateCreditReversal } from "./payment-reversal";

describe("calculateCreditReversal", () => {
  it("reverses credits proportionally for a partial refund", () => {
    expect(
      calculateCreditReversal({
        amountPaid: 1000,
        amountReversed: 250,
        creditsGranted: 100,
        creditsAlreadyRevoked: 0,
      })
    ).toEqual({ targetCredits: 25, deltaCredits: 25 });
  });

  it("is cumulative and does not revoke the same refund twice", () => {
    expect(
      calculateCreditReversal({
        amountPaid: 1000,
        amountReversed: 500,
        creditsGranted: 100,
        creditsAlreadyRevoked: 25,
      })
    ).toEqual({ targetCredits: 50, deltaCredits: 25 });
  });

  it("caps full reversals at the original grant", () => {
    expect(
      calculateCreditReversal({
        amountPaid: 1000,
        amountReversed: 5000,
        creditsGranted: 100,
        creditsAlreadyRevoked: 0,
      })
    ).toEqual({ targetCredits: 100, deltaCredits: 100 });
  });
});
