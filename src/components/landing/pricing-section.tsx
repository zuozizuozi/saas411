import { getCurrentUser } from "@/lib/auth";
import { getTranslations } from "next-intl/server";

import { PricingCards } from "@/components/price/pricing-cards";
import { StripeCreditPacks } from "@/components/price/stripe-credit-packs";
import { getUserPlans } from "@/services/billing";
import type { UserSubscriptionPlan } from "@/types";

export async function PricingSection() {
  const user = await getCurrentUser();
  let subscriptionPlan: UserSubscriptionPlan | undefined;
  if (user) {
    subscriptionPlan = await getUserPlans(user.id);
  }

  const t = await getTranslations("PricingCards");

  return (
    <section id="pricing" className="relative py-24 md:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white/65">
            {t("pricing")}
          </span>
          <h2 className="mt-6 text-4xl font-semibold tracking-[-0.03em] text-white md:text-5xl">
            {t("slogan")}
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
            {`${t("monthly")} · ${t("quarterly")} · ${t("yearly")} · ${t("onetime")}`}
          </p>
        </div>

        <div className="mx-auto max-w-6xl">
          <PricingCards
            userId={user?.id}
            subscriptionPlan={subscriptionPlan}
          />
          <StripeCreditPacks userId={user?.id} />
        </div>
      </div>
    </section>
  );
}
