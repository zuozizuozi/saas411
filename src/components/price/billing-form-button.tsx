"use client";

import { useAction } from "next-safe-action/hooks";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import * as Icons from "@/components/ui/icons";

import { createStripeSessionAction } from "@/actions/stripe";
import type { UserSubscriptionPlan } from "@/types";
import type { SubscriptionPlanTranslation } from "@/config/price/price-data";

interface BillingFormButtonProps {
  offer: SubscriptionPlanTranslation;
  subscriptionPlan: UserSubscriptionPlan;
  year: boolean;
}

export function BillingFormButton({
  year,
  offer,
  subscriptionPlan,
}: BillingFormButtonProps) {
  const t = useTranslations('PricingCards');
  const { executeAsync, status } = useAction(createStripeSessionAction);
  const isPending = status === "executing";

  async function createSession(planId: string) {
    const res = await executeAsync({ planId });
    if (res?.data?.url) window.location.href = res.data.url;
  }

  const stripePlanId = year
    ? offer?.stripeIds?.yearly
    : offer?.stripeIds?.monthly;

  const stripeSessionAction = () => createSession(stripePlanId!);
  const isFreeOffer = !stripePlanId;

  return (
    <Button
      variant="default"
      className="w-full"
      disabled={isPending || isFreeOffer}
      onClick={stripeSessionAction}
    >
      {isPending ? (
        <>
          <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" /> Loading...
        </>
      ) : (
        <>
          {isFreeOffer
            ? subscriptionPlan.isPaid ? t('upgrade') : "Current plan"
            : subscriptionPlan.stripePriceId
            ? t('manage_subscription')
            : t('upgrade')}
        </>
      )}
    </Button>
  );
}
