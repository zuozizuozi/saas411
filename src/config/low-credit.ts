export const LOW_CREDIT_FIXED_THRESHOLD = 100;

export type LowCreditState = {
  canGenerate: boolean;
  remainingAfterGeneration: number;
  warningThreshold: number;
  shouldWarn: boolean;
};

export function getLowCreditState(
  availableCredits: number,
  requiredCredits: number
): LowCreditState {
  const safeAvailable = Math.max(0, Math.floor(availableCredits));
  const safeRequired = Math.max(0, Math.ceil(requiredCredits));
  const canGenerate = safeAvailable >= safeRequired;
  const remainingAfterGeneration = Math.max(0, safeAvailable - safeRequired);
  const warningThreshold = Math.max(
    LOW_CREDIT_FIXED_THRESHOLD,
    safeRequired
  );

  return {
    canGenerate,
    remainingAfterGeneration,
    warningThreshold,
    shouldWarn:
      safeRequired > 0 &&
      canGenerate &&
      remainingAfterGeneration < warningThreshold,
  };
}
