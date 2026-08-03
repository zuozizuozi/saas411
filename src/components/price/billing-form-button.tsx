"use client";

import { useTranslations } from "next-intl";

import { StripeSubscriptionButton } from "@/components/price/stripe-subscription-button";
import type { UserSubscriptionPlan } from "@/types";
import type { SubscriptionPlanTranslation } from "@/config/price/price-data";
import type { BillingPeriod } from "@/config/price/price-data";

interface BillingFormButtonProps {
  offer: SubscriptionPlanTranslation;
  subscriptionPlan: UserSubscriptionPlan;
  period: BillingPeriod;
}

export function BillingFormButton({
  period,
  offer,
  subscriptionPlan,
}: BillingFormButtonProps) {
  const t = useTranslations('PricingCards');

  const stripePlanId = offer.stripeIds[period];
  const isFreeOffer = !stripePlanId;

  return (
    <StripeSubscriptionButton
      planId={stripePlanId ?? ""}
      className="w-full"
      disabled={isFreeOffer}
      label={
        isFreeOffer
          ? subscriptionPlan.isPaid
            ? t('upgrade')
            : "Current plan"
          : subscriptionPlan.stripePriceId === stripePlanId
            ? t('manage_subscription')
            : t('upgrade')
      }
    />
  );
}
