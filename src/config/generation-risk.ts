export const GENERATION_RISK_POLICY = {
  minimumConsumedCredits: 1_000,
  warning: {
    windowHours: 24,
    consumptionBasisPoints: 2_500,
  },
  pauses: [
    { windowHours: 24, consumptionBasisPoints: 5_000 },
    { windowHours: 48, consumptionBasisPoints: 8_000 },
  ],
  manualRecoveryExemptionHours: 72,
} as const;

export type CreditVelocityAssessment =
  | { level: "NONE" }
  | {
      level: "LOW" | "HIGH";
      consumptionBasisPoints: number;
      windowHours: number;
    };

export function assessAnnualCreditVelocity(input: {
  consumedCredits: number;
  grantedCredits: number;
  elapsedHours: number;
}): CreditVelocityAssessment {
  if (
    !Number.isFinite(input.elapsedHours) ||
    input.elapsedHours < 0 ||
    input.grantedCredits <= 0 ||
    input.consumedCredits < GENERATION_RISK_POLICY.minimumConsumedCredits
  ) {
    return { level: "NONE" };
  }

  const consumptionBasisPoints = Math.floor(
    (input.consumedCredits * 10_000) / input.grantedCredits
  );
  const pauseRule = GENERATION_RISK_POLICY.pauses.find(
    (rule) =>
      input.elapsedHours <= rule.windowHours &&
      consumptionBasisPoints >= rule.consumptionBasisPoints
  );
  if (pauseRule) {
    return {
      level: "HIGH",
      consumptionBasisPoints,
      windowHours: pauseRule.windowHours,
    };
  }

  if (
    input.elapsedHours <= GENERATION_RISK_POLICY.warning.windowHours &&
    consumptionBasisPoints >=
      GENERATION_RISK_POLICY.warning.consumptionBasisPoints
  ) {
    return {
      level: "LOW",
      consumptionBasisPoints,
      windowHours: GENERATION_RISK_POLICY.warning.windowHours,
    };
  }

  return { level: "NONE" };
}
