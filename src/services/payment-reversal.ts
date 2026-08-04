export function calculateCreditReversal(input: {
  amountPaid: number;
  amountReversed: number;
  creditsGranted: number;
  creditsAlreadyRevoked: number;
}) {
  if (
    input.amountPaid <= 0 ||
    input.amountReversed <= 0 ||
    input.creditsGranted <= 0
  ) {
    return { targetCredits: 0, deltaCredits: 0 };
  }
  const targetCredits = Math.min(
    input.creditsGranted,
    Math.ceil(
      (input.creditsGranted * input.amountReversed) / input.amountPaid
    )
  );
  return {
    targetCredits,
    deltaCredits: Math.max(0, targetCredits - input.creditsAlreadyRevoked),
  };
}
