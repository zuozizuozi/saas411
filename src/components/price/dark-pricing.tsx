"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import {
  createStripeCreditSessionAction,
} from "@/actions/stripe";
import { StripeSubscriptionButton } from "@/components/price/stripe-subscription-button";
import * as Icons from "@/components/ui/icons";
import {
  getPeriodMonths,
  priceDataMap,
  type BillingPeriod,
} from "@/config/price/price-data";
import {
  getLocalizedOnetimePackages,
  getLocalizedSubscriptionPackages,
  type CreditsDictionary,
  type LocalizedPackage,
} from "@/hooks/use-credit-packages";
import { useSigninModal } from "@/hooks/use-signin-modal";
import { cn } from "@/lib/utils";

interface DarkPricingProps {
  userId?: string;
  dictPrice: Record<string, string>;
  dictCredits: CreditsDictionary;
}

type FeatureItem = { text: string; included: boolean };

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function getStandardFeatures(products: LocalizedPackage[]): FeatureItem[] {
  const uniqueFeatures = Array.from(
    new Set(products.flatMap((product) => product.localizedFeatures))
  );
  return uniqueFeatures.map((text) => ({ text, included: false }));
}

export function DarkPricing({ userId, dictPrice, dictCredits }: DarkPricingProps) {
  const t = useTranslations("PricingCards");
  const locale = useLocale();
  const [activePeriod, setActivePeriod] = useState<BillingPeriod>("month");
  const [isPending, startTransition] = useTransition();
  const creditCheckout = useAction(createStripeCreditSessionAction);
  const signInModal = useSigninModal();

  const subscriptions = useMemo(
    () =>
      getLocalizedSubscriptionPackages(dictCredits).sort(
        (a, b) => a.credits - b.credits
      ),
    [dictCredits]
  );
  const onetimeProducts = useMemo(
    () =>
      getLocalizedOnetimePackages(dictCredits).sort(
        (a, b) => a.credits - b.credits
      ),
    [dictCredits]
  );
  const currentSubscriptions = useMemo(
    () => subscriptions.filter((product) => product.billingPeriod === activePeriod),
    [activePeriod, subscriptions]
  );

  const handleCheckout = (product: LocalizedPackage) => {
    if (!userId) {
      signInModal.onOpen();
      return;
    }

    startTransition(async () => {
      const result = await creditCheckout.executeAsync({ packageId: product.id });

      if (!result?.data?.url) {
        toast.error(t("checkout_error"), { description: t("checkout_failed") });
        return;
      }

      window.location.href = result.data.url;
    });
  };

  const subscriptionFeatures = useMemo(
    () => getStandardFeatures(currentSubscriptions),
    [currentSubscriptions]
  );
  const packFeatures = useMemo(
    () => getStandardFeatures(onetimeProducts),
    [onetimeProducts]
  );

  const tabs: Array<{ period: BillingPeriod; label: string; badge?: string }> = [
    { period: "month", label: t("monthly") },
    { period: "quarter", label: t("quarterly"), badge: t("quarterly_off") },
    { period: "year", label: t("yearly"), badge: t("yearly_off") },
  ];

  return (
    <section className="pb-6">
      <div className="mx-auto mb-8 flex justify-center">
        <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1.5">
          {tabs.map((tab) => (
            <TabButton
              key={tab.period}
              active={activePeriod === tab.period}
              onClick={() => setActivePeriod(tab.period)}
            >
              {tab.label}
              {tab.badge ? (
                <span className="ml-2 text-[10px] font-semibold text-emerald-300">
                  {tab.badge}
                </span>
              ) : null}
            </TabButton>
          ))}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {currentSubscriptions.map((product) => (
          <PricingCard
            key={product.id}
            product={product}
            features={subscriptionFeatures.map((feature) => ({
              ...feature,
              included: product.localizedFeatures.includes(feature.text),
            }))}
            isRecommended={product.popular === true}
            userId={userId}
            isPending={isPending}
            buttonLabel={dictPrice.upgrade}
            creditsLabel={dictCredits.title ?? t("credits")}
            popularLabel={t("popular")}
            onCheckout={handleCheckout}
            signInModal={signInModal}
            subscriptionPriceId={(() => {
              const planId = product.name.startsWith("Go")
                ? "go"
                : product.name.startsWith("Plus")
                  ? "plus"
                  : "pro";
              return (priceDataMap[locale] ?? priceDataMap.en).find(
                (item) => item.id === planId
              )?.stripeIds[activePeriod] ?? undefined;
            })()}
          />
        ))}
      </div>

      <div className="my-8 border-t border-white/10 pt-8">
        <div className="mb-5 text-center">
          <h3 className="text-lg font-semibold text-white">{t("onetime")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("onetime_description")}</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {onetimeProducts.map((product) => (
            <PricingCard
              key={product.id}
              product={product}
              features={packFeatures.map((feature) => ({
                ...feature,
                included: product.localizedFeatures.includes(feature.text),
              }))}
              isRecommended={product.popular === true}
              userId={userId}
              isPending={isPending}
              buttonLabel={dictCredits.buy_credits ?? "Buy Credits"}
              creditsLabel={dictCredits.title ?? t("credits")}
              popularLabel={t("popular")}
              onCheckout={handleCheckout}
              signInModal={signInModal}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-200 sm:px-5",
        active
          ? "bg-white text-black shadow-[0_10px_30px_rgba(255,255,255,0.12)]"
          : "text-white/68 hover:bg-white/6 hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

function PricingCard({
  product,
  features,
  isRecommended,
  userId,
  isPending,
  buttonLabel,
  creditsLabel,
  popularLabel,
  onCheckout,
  signInModal,
  subscriptionPriceId,
}: {
  product: LocalizedPackage;
  features: FeatureItem[];
  isRecommended: boolean;
  userId?: string;
  isPending: boolean;
  buttonLabel: string;
  creditsLabel: string;
  popularLabel: string;
  onCheckout: (product: LocalizedPackage) => void;
  signInModal: { onOpen: () => void };
  subscriptionPriceId?: string;
}) {
  const t = useTranslations("PricingCards");
  const billingPeriod = product.billingPeriod;
  const monthlyEquivalent = billingPeriod
    ? product.price.amount / getPeriodMonths(billingPeriod)
    : product.price.amount;

  return (
    <div
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-[28px] border bg-[linear-gradient(180deg,rgba(23,23,31,0.97),rgba(12,12,18,0.96))] shadow-[0_24px_80px_rgba(0,0,0,0.34)]",
        isRecommended ? "border-primary/45" : "border-white/10"
      )}
    >
      {isRecommended ? (
        <div className="absolute right-5 top-5 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
          {popularLabel}
        </div>
      ) : null}

      <div className="border-b border-white/10 p-7">
        <p className="pr-24 text-sm font-semibold uppercase tracking-[0.22em] text-white/45">
          {product.displayName}
        </p>
        <div className="mt-5 flex items-end gap-2">
          <span className="text-4xl font-semibold tracking-[-0.04em] text-white">
            {formatPrice(monthlyEquivalent)}
          </span>
          {billingPeriod ? (
            <span className="pb-1 text-sm text-muted-foreground">{t("per_month")}</span>
          ) : null}
        </div>
        {billingPeriod === "quarter" ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {t("billed_quarterly", { price: formatPrice(product.price.amount) })}
          </p>
        ) : billingPeriod === "year" ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {t("billed_yearly", { price: formatPrice(product.price.amount) })}
          </p>
        ) : null}
        {!billingPeriod ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("one_time_payment")}</p>
        ) : null}
        <p className="mt-3 text-sm text-muted-foreground">
          {creditsLabel}: {product.credits.toLocaleString()}
        </p>
        {product.displayDescription ? (
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            {product.displayDescription}
          </p>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col justify-between p-7">
        <ul className="space-y-3">
          {features.map((feature) => (
            <li key={feature.text} className="flex items-start gap-3 text-sm leading-7">
              {feature.included ? (
                <Icons.Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              ) : (
                <Icons.Close className="mt-0.5 h-5 w-5 shrink-0 text-white/25" />
              )}
              <span className={feature.included ? "text-white/80" : "text-white/30"}>
                {feature.text}
              </span>
            </li>
          ))}
        </ul>

        {billingPeriod && userId && subscriptionPriceId ? (
          <StripeSubscriptionButton
            planId={subscriptionPriceId}
            label={buttonLabel}
            className="mt-8 h-11 w-full rounded-xl"
          />
        ) : (
          <button
            type="button"
            disabled={isPending || (Boolean(billingPeriod) && !subscriptionPriceId)}
            onClick={() => (userId ? onCheckout(product) : signInModal.onOpen())}
            className="mt-8 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("processing")}
              </>
            ) : (
              buttonLabel
            )}
          </button>
        )}
      </div>
    </div>
  );
}
