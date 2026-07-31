import { priceDataMap } from "@/config/price/price-data";

export interface SubscriptionPlan {
  title: string;
  description: string;
  benefits: string[];
  limitations: string[];
  prices: { monthly: number; yearly: number };
  stripeIds: { monthly: string | null; yearly: string | null };
}

const freePlan: SubscriptionPlan = {
  title: "Free",
  description: "Try seedance.co",
  benefits: ["Free starter credits", "Standard queue"],
  limitations: ["One concurrent generation", "No batch output"],
  prices: { monthly: 0, yearly: 0 },
  stripeIds: { monthly: null, yearly: null },
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
