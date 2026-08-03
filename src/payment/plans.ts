import { SUBSCRIPTION_PRODUCTS, type SubscriptionPeriod } from "@/config/pricing-user";
import { SubscriptionPlan } from "@/db";

import { env } from "./env.mjs";

type PlanType = (typeof SubscriptionPlan)[keyof typeof SubscriptionPlan];
type PlanName = "Go Plan" | "Plus Plan" | "Pro Plan";

type Registration = {
  priceId?: string;
  plan: PlanType;
  name: PlanName;
  period: SubscriptionPeriod;
};

export type SubscriptionPriceDetails = SubscriptionCreditGrant & {
  priceId: string;
  plan: PlanType;
  period: SubscriptionPeriod;
  rank: number;
};

const registrations: Registration[] = [
  {
    priceId: env.NEXT_PUBLIC_STRIPE_BASIC_MONTHLY_PRICE_ID,
    plan: SubscriptionPlan.BASIC,
    name: "Go Plan",
    period: "month",
  },
  {
    priceId: env.NEXT_PUBLIC_STRIPE_BASIC_QUARTERLY_PRICE_ID,
    plan: SubscriptionPlan.BASIC,
    name: "Go Plan",
    period: "quarter",
  },
  {
    priceId: env.NEXT_PUBLIC_STRIPE_BASIC_YEARLY_PRICE_ID,
    plan: SubscriptionPlan.BASIC,
    name: "Go Plan",
    period: "year",
  },
  {
    priceId: env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID,
    plan: SubscriptionPlan.PRO,
    name: "Plus Plan",
    period: "month",
  },
  {
    priceId: env.NEXT_PUBLIC_STRIPE_PRO_QUARTERLY_PRICE_ID,
    plan: SubscriptionPlan.PRO,
    name: "Plus Plan",
    period: "quarter",
  },
  {
    priceId: env.NEXT_PUBLIC_STRIPE_PRO_YEARLY_PRICE_ID,
    plan: SubscriptionPlan.PRO,
    name: "Plus Plan",
    period: "year",
  },
  {
    priceId: env.NEXT_PUBLIC_STRIPE_BUSINESS_MONTHLY_PRICE_ID,
    plan: SubscriptionPlan.BUSINESS,
    name: "Pro Plan",
    period: "month",
  },
  {
    priceId: env.NEXT_PUBLIC_STRIPE_BUSINESS_QUARTERLY_PRICE_ID,
    plan: SubscriptionPlan.BUSINESS,
    name: "Pro Plan",
    period: "quarter",
  },
  {
    priceId: env.NEXT_PUBLIC_STRIPE_BUSINESS_YEARLY_PRICE_ID,
    plan: SubscriptionPlan.BUSINESS,
    name: "Pro Plan",
    period: "year",
  },
];

const planMap: Record<string, PlanType> = {};

export type SubscriptionCreditGrant = {
  credits: number;
  expiryDays: number;
  name: string;
};

const subscriptionCreditMap: Record<string, SubscriptionCreditGrant> = {};
const subscriptionPriceDetailsMap: Record<string, SubscriptionPriceDetails> = {};

const planRank: Record<PlanType, number> = {
  [SubscriptionPlan.FREE]: 0,
  [SubscriptionPlan.BASIC]: 1,
  [SubscriptionPlan.PRO]: 2,
  [SubscriptionPlan.BUSINESS]: 3,
};

function getProductName(name: PlanName, period: SubscriptionPeriod): string {
  return period === "year"
    ? `${name} (Yearly)`
    : period === "quarter"
      ? `${name} (Quarterly)`
      : name;
}

function getExpiryDays(period: SubscriptionPeriod): number {
  return period === "year" ? 366 : period === "quarter" ? 93 : 31;
}

for (const registration of registrations) {
  if (!registration.priceId) continue;

  planMap[registration.priceId] = registration.plan;
  const product = SUBSCRIPTION_PRODUCTS.find(
    (item) => item.name === getProductName(registration.name, registration.period)
  );
  if (!product) continue;

  subscriptionCreditMap[registration.priceId] = {
    credits: product.credits,
    expiryDays: getExpiryDays(registration.period),
    name: product.name,
  };
  subscriptionPriceDetailsMap[registration.priceId] = {
    priceId: registration.priceId,
    plan: registration.plan,
    period: registration.period,
    rank: planRank[registration.plan],
    credits: product.credits,
    expiryDays: getExpiryDays(registration.period),
    name: product.name,
  };
}

export const PLANS = planMap;

export function isSubscriptionCreditInvoiceReason(reason: string | null) {
  return (
    reason === "subscription_create" ||
    reason === "subscription_cycle" ||
    reason === "subscription_update"
  );
}

export function getSubscriptionPlan(priceId: string | undefined): PlanType {
  return priceId && PLANS[priceId] ? PLANS[priceId]! : SubscriptionPlan.FREE;
}

export function getSubscriptionCreditGrant(
  priceId: string | undefined
): SubscriptionCreditGrant | undefined {
  return priceId ? subscriptionCreditMap[priceId] : undefined;
}

export function getSubscriptionPriceDetails(
  priceId: string | undefined
): SubscriptionPriceDetails | undefined {
  return priceId ? subscriptionPriceDetailsMap[priceId] : undefined;
}
