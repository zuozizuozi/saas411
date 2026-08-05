export type StripeRiskLevel =
  | "normal"
  | "elevated"
  | "highest"
  | "not_assessed"
  | "unknown"
  | string;

export type PaymentRiskDecision = "CLEAR" | "REVIEW";

export interface PaymentRiskSignals {
  reviewId?: string | null;
  riskLevel?: StripeRiskLevel | null;
  riskScore?: number | null;
}

export interface PaymentRiskAssessment extends PaymentRiskSignals {
  decision: PaymentRiskDecision;
  reason: string;
}

function configuredHoldLevels() {
  const configured = process.env.PAYMENT_RISK_HOLD_LEVELS ?? "elevated,highest";
  return new Set(
    configured
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
}

function configuredHoldScore() {
  const value = Number.parseInt(process.env.PAYMENT_RISK_HOLD_SCORE ?? "65", 10);
  return Number.isInteger(value) && value >= 0 && value <= 99 ? value : 65;
}

/**
 * Instant digital credits are irreversible once consumed. Hold only explicit
 * Radar review/elevated signals; a missing score alone is not treated as fraud
 * because standard Radar accounts don't expose every numeric score.
 */
export function assessPaymentRisk(signals: PaymentRiskSignals): PaymentRiskAssessment {
  if (signals.reviewId) {
    return {
      ...signals,
      decision: "REVIEW",
      reason: `Stripe Radar review ${signals.reviewId} is open`,
    };
  }

  const normalizedLevel = signals.riskLevel?.toLowerCase();
  if (normalizedLevel && configuredHoldLevels().has(normalizedLevel)) {
    return {
      ...signals,
      decision: "REVIEW",
      reason: `Stripe Radar risk level is ${normalizedLevel}`,
    };
  }

  const threshold = configuredHoldScore();
  if (signals.riskScore !== null && signals.riskScore !== undefined) {
    if (signals.riskScore >= threshold) {
      return {
        ...signals,
        decision: "REVIEW",
        reason: `Stripe Radar risk score ${signals.riskScore} meets hold threshold ${threshold}`,
      };
    }
  }

  return {
    ...signals,
    decision: "CLEAR",
    reason: "No elevated Stripe Radar signal",
  };
}

