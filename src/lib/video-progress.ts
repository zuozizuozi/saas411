const ACTIVE_PROGRESS_MAX = 98;

function clampProgress(progress: number, max = 100) {
  return Math.min(max, Math.max(0, Math.round(progress)));
}

/**
 * Convert provider and local lifecycle state into a user-facing percentage.
 * Provider progress wins while generation is active; local finalization stays
 * at 99% until storage and credit settlement have both completed.
 */
export function getVideoProgress(
  status: string,
  providerProgress?: number
): number {
  const normalizedStatus = status.toUpperCase();

  if (normalizedStatus === "COMPLETED") return 100;
  if (normalizedStatus === "UPLOADING" || normalizedStatus === "RETRYING") {
    return 99;
  }
  if (normalizedStatus === "FAILED") return 0;

  if (Number.isFinite(providerProgress)) {
    return clampProgress(providerProgress as number, ACTIVE_PROGRESS_MAX);
  }

  return 0;
}

