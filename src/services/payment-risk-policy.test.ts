import { afterEach, describe, expect, it } from "vitest";

import { assessPaymentRisk } from "./payment-risk-policy";

afterEach(() => {
  Reflect.deleteProperty(process.env, "PAYMENT_RISK_HOLD_LEVELS");
  Reflect.deleteProperty(process.env, "PAYMENT_RISK_HOLD_SCORE");
});

describe("assessPaymentRisk", () => {
  it("holds an open Radar review", () => {
    expect(assessPaymentRisk({ reviewId: "prv_123", riskLevel: "normal" })).toMatchObject({
      decision: "REVIEW",
      reviewId: "prv_123",
    });
  });

  it.each(["elevated", "highest"])("holds %s Radar risk", (riskLevel) => {
    expect(assessPaymentRisk({ riskLevel }).decision).toBe("REVIEW");
  });

  it("holds scores at the configured threshold", () => {
    process.env.PAYMENT_RISK_HOLD_SCORE = "72";
    expect(assessPaymentRisk({ riskLevel: "normal", riskScore: 72 }).decision).toBe(
      "REVIEW"
    );
  });

  it("allows a normal payment without a Radar for Fraud Teams score", () => {
    expect(assessPaymentRisk({ riskLevel: "normal" })).toMatchObject({
      decision: "CLEAR",
    });
  });

  it("allows operators to change held levels without code changes", () => {
    process.env.PAYMENT_RISK_HOLD_LEVELS = "highest";
    expect(assessPaymentRisk({ riskLevel: "elevated" }).decision).toBe("CLEAR");
  });
});
