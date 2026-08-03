import {
  priceDataMap,
  type BillingPeriod,
} from "@/config/price/price-data";

export interface SubscriptionPlan {
  title: string;
  description: string;
  benefits: string[];
  limitations: string[];
  prices: Record<BillingPeriod, number>;
  stripeIds: Record<BillingPeriod, string | null>;
}

const freePlan: SubscriptionPlan = {
  title: "Free",
  description: "Create an account, then subscribe or purchase credits",
  benefits: ["Account access", "Pricing and model cost preview"],
  limitations: ["Video generation requires paid credits"],
  prices: { month: 0, quarter: 0, year: 0 },
  stripeIds: { month: null, quarter: null, year: null },
};

/** Billing and UI now share the same product catalogue and Stripe price IDs. */
export const pricingData: SubscriptionPlan[] = [
  freePlan,
  ...priceDataMap.en.map((plan) => ({
    title: plan.title,
    description: plan.description,
    benefits: plan.benefits,
    limitations: plan.limitations,
    prices: plan.prices,
    stripeIds: plan.stripeIds,
  })),
];
