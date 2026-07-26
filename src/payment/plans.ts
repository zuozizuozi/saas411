import { SubscriptionPlan } from "@/db";
import { SUBSCRIPTION_PRODUCTS } from "@/config/pricing-user";

import { env } from "./env.mjs";

type PlanType = (typeof SubscriptionPlan)[keyof typeof SubscriptionPlan];

const planMap: Record<string, PlanType> = {};
const registerPlan = (priceId: string | undefined, plan: PlanType) => {
  if (priceId) {
    planMap[priceId] = plan;
  }
};

registerPlan(env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID, SubscriptionPlan.PRO);
registerPlan(env.NEXT_PUBLIC_STRIPE_PRO_YEARLY_PRICE_ID, SubscriptionPlan.PRO);
registerPlan(env.NEXT_PUBLIC_STRIPE_BASIC_MONTHLY_PRICE_ID, SubscriptionPlan.BASIC);
registerPlan(env.NEXT_PUBLIC_STRIPE_BASIC_YEARLY_PRICE_ID, SubscriptionPlan.BASIC);
registerPlan(
  env.NEXT_PUBLIC_STRIPE_BUSINESS_MONTHLY_PRICE_ID,
  SubscriptionPlan.BUSINESS
);
registerPlan(
  env.NEXT_PUBLIC_STRIPE_BUSINESS_YEARLY_PRICE_ID,
  SubscriptionPlan.BUSINESS
);

export const PLANS = planMap;

export function isSubscriptionCreditInvoiceReason(reason: string | null) {
  return reason === "subscription_create" || reason === "subscription_cycle";
}

type SubscriptionCreditGrant = {
  credits: number;
  expiryDays: number;
  name: string;
};

const subscriptionCreditMap: Record<string, SubscriptionCreditGrant> = {};

function registerCreditGrant(
  priceId: string | undefined,
  planName: "Basic Plan" | "Pro Plan" | "Ultimate Plan",
  period: "month" | "year"
) {
  if (!priceId) return;
  const product = SUBSCRIPTION_PRODUCTS.find(
    (item) => item.name === `${planName}${period === "year" ? " (Yearly)" : ""}`
  );
  if (!product) return;

  subscriptionCreditMap[priceId] = {
    credits: product.credits,
    expiryDays: period === "year" ? 366 : 31,
    name: product.name,
  };
}

registerCreditGrant(env.NEXT_PUBLIC_STRIPE_BASIC_MONTHLY_PRICE_ID, "Basic Plan", "month");
registerCreditGrant(env.NEXT_PUBLIC_STRIPE_BASIC_YEARLY_PRICE_ID, "Basic Plan", "year");
registerCreditGrant(env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID, "Pro Plan", "month");
registerCreditGrant(env.NEXT_PUBLIC_STRIPE_PRO_YEARLY_PRICE_ID, "Pro Plan", "year");
registerCreditGrant(
  env.NEXT_PUBLIC_STRIPE_BUSINESS_MONTHLY_PRICE_ID,
  "Ultimate Plan",
  "month"
);
registerCreditGrant(
  env.NEXT_PUBLIC_STRIPE_BUSINESS_YEARLY_PRICE_ID,
  "Ultimate Plan",
  "year"
);

export function getSubscriptionPlan(priceId: string | undefined): PlanType {
  return priceId && PLANS[priceId] ? PLANS[priceId]! : SubscriptionPlan.FREE;
}

export function getSubscriptionCreditGrant(
  priceId: string | undefined
): SubscriptionCreditGrant | undefined {
  return priceId ? subscriptionCreditMap[priceId] : undefined;
}
