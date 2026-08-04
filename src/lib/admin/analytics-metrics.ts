export interface AnalyticsTrendCounts {
  registeredUsers: number;
  firstVideoUsers: number;
  successfulFirstVideoUsers: number;
}

export function toPercentage(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function summarizeTrend(data: AnalyticsTrendCounts[]) {
  const totals = data.reduce(
    (result, point) => ({
      registeredUsers: result.registeredUsers + point.registeredUsers,
      firstVideoUsers: result.firstVideoUsers + point.firstVideoUsers,
      successfulFirstVideoUsers:
        result.successfulFirstVideoUsers + point.successfulFirstVideoUsers,
    }),
    {
      registeredUsers: 0,
      firstVideoUsers: 0,
      successfulFirstVideoUsers: 0,
    },
  );

  return {
    ...totals,
    firstVideoConversionRate: toPercentage(
      totals.firstVideoUsers,
      totals.registeredUsers,
    ),
    firstVideoSuccessRate: toPercentage(
      totals.successfulFirstVideoUsers,
      totals.firstVideoUsers,
    ),
  };
}
