import { getSubscriptionCreditGrant } from "./plans";

export type ProrationLine = {
  amount: number;
  proration: boolean;
  period?: { start: number } | null;
  price?: {
    id: string;
    unit_amount?: number | null;
    unit_amount_decimal?: string | null;
  } | null;
  quantity?: number | null;
};

function getUnitAmount(line: ProrationLine): number {
  if (line.price?.unit_amount_decimal) {
    const parsed = Number(line.price.unit_amount_decimal);
    if (Number.isFinite(parsed)) return parsed;
  }
  return line.price?.unit_amount ?? 0;
}

/**
 * Mirrors Stripe's time-based proration in site credits. Positive lines add the
 * unused share of the new plan and negative lines remove the unused share of
 * the old plan. The final floor prevents granting fractional credits.
 */
export function calculateProratedUpgradeCredits(
  lines: ProrationLine[],
  prorationDate?: number
): number {
  const creditDelta = lines.reduce((total, line) => {
    if (!line.proration || !line.price?.id) return total;
    if (prorationDate && line.period?.start !== prorationDate) return total;

    const grant = getSubscriptionCreditGrant(line.price.id);
    const unitAmount = getUnitAmount(line);
    const quantity = line.quantity ?? 1;
    const fullPeriodAmount = unitAmount * quantity;
    if (!grant || fullPeriodAmount <= 0) return total;

    return total + (grant.credits * line.amount) / fullPeriodAmount;
  }, 0);

  return Math.max(0, Math.floor(creditDelta + Number.EPSILON));
}

export function calculateProrationCharge(
  lines: ProrationLine[],
  prorationDate?: number
): number {
  return Math.max(
    0,
    lines.reduce((total, line) => {
      if (!line.proration) return total;
      if (prorationDate && line.period?.start !== prorationDate) return total;
      return total + line.amount;
    }, 0)
  );
}
