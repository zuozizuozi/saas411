import { getCurrentUser } from "@/lib/auth";
import { getLocale, getTranslations } from "next-intl/server";

import { DarkPricing } from "@/components/price/dark-pricing";
import { PricingCards } from "@/components/price/pricing-cards";
import { billingProvider } from "@/config/billing-provider";
import { getUserPlans } from "@/services/billing";
import type { CreditsDictionary } from "@/hooks/use-credit-packages";
import type { UserSubscriptionPlan } from "@/types";

export async function PricingSection() {
  const user = await getCurrentUser();
  const locale = await getLocale();
  let subscriptionPlan: UserSubscriptionPlan | undefined;
  const isCreem = billingProvider === "creem";

  if (user && !isCreem) {
    subscriptionPlan = await getUserPlans(user.id);
  }

  const t = await getTranslations("PricingCards");
  const dictPrice = (await getTranslations()).raw("PricingCards") as Record<string, string>;
  const dictCredits = (await getTranslations()).raw("Credits") as CreditsDictionary;
  const isZh = locale === "zh";

  return (
    <section id="pricing" className="relative py-24 md:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white/65">
            {t("pricing")}
          </span>
          <h2 className="mt-6 text-4xl font-semibold tracking-[-0.03em] text-white md:text-5xl">
            {isZh ? "选择适合你的套餐" : "Choose Your Plan"}
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
            {isZh
              ? `${t("slogan")} 可按月、按年订阅，也可以先购买一次性积分。`
              : `${t("slogan")} Pay monthly, yearly, or start with one-time credits.`}
          </p>
        </div>

        <div className="mx-auto max-w-6xl">
          {isCreem ? (
            <DarkPricing
              userId={user?.id}
              dictPrice={dictPrice}
              dictCredits={dictCredits}
            />
          ) : (
            <PricingCards
              userId={user?.id}
              subscriptionPlan={subscriptionPlan}
            />
          )}
        </div>
      </div>
    </section>
  );
}
