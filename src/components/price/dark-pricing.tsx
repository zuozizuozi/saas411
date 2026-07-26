"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as Icons from "@/components/ui/icons";
import { toast } from "sonner";
import { useAction } from "next-safe-action/hooks";

import {
  createStripeCreditSessionAction,
  createStripeSessionAction,
} from "@/actions/stripe";
import { priceDataMap } from "@/config/price/price-data";
import { cn } from "@/lib/utils";
import { useSigninModal } from "@/hooks/use-signin-modal";
import {
  getLocalizedOnetimePackages,
  getLocalizedSubscriptionPackages,
  type CreditsDictionary,
  type LocalizedPackage,
} from "@/hooks/use-credit-packages";
import { useCredits } from "@/stores/credits-store";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface DarkPricingProps {
  userId?: string;
  dictPrice: Record<string, string>;
  dictCredits: CreditsDictionary;
}

type PricingTab = "onetime" | "monthly" | "yearly";
type FeatureItem = {
  text: string;
  included: boolean;
};

function formatPrice(cents: number): string {
  const value = (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
  return `$${value}`;
}

function getStandardFeatures(products: LocalizedPackage[]): FeatureItem[] {
  const allFeatures = products.flatMap((product) => product.localizedFeatures);
  const uniqueFeatures = Array.from(new Set(allFeatures));

  return uniqueFeatures.map((feature) => ({
    text: feature,
    included: false,
  }));
}

export function DarkPricing({
  userId,
  dictPrice,
  dictCredits,
}: DarkPricingProps) {
  const t = useTranslations("PricingCards");
  const locale = useLocale();
  const isZh = locale === "zh";
  const [activeTab, setActiveTab] = useState<PricingTab>("monthly");
  const [isPending, startTransition] = useTransition();
  const subscriptionCheckout = useAction(createStripeSessionAction);
  const creditCheckout = useAction(createStripeCreditSessionAction);
  const signInModal = useSigninModal();
  const { balance } = useCredits();
  const userPlan = balance?.plan || "FREE";
  const isFreeUser = !userPlan || userPlan === "FREE";

  const allSubscriptionProducts = useMemo(
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

  const monthlyProducts = useMemo(
    () => allSubscriptionProducts.filter((p) => p.billingPeriod === "month"),
    [allSubscriptionProducts]
  );

  const yearlyProducts = useMemo(
    () => allSubscriptionProducts.filter((p) => p.billingPeriod === "year"),
    [allSubscriptionProducts]
  );

  const handleCheckout = (product: LocalizedPackage) => {
    if (!userId) {
      signInModal.onOpen();
      return;
    }

    startTransition(async () => {
      let result: { data?: { url?: string | null } } | undefined;
      if (product.billingPeriod) {
        const planId = product.name.startsWith("Basic")
          ? "basic"
          : product.name.startsWith("Pro")
            ? "pro"
            : "ultimate";
        const offer = (priceDataMap[locale] ?? priceDataMap.en).find(
          (item) => item.id === planId
        );
        const stripePriceId =
          product.billingPeriod === "year"
            ? offer?.stripeIds.yearly
            : offer?.stripeIds.monthly;
        if (!stripePriceId) {
          toast.error("Checkout is not configured for this plan.");
          return;
        }
        result = await subscriptionCheckout.executeAsync({
          planId: stripePriceId,
        });
      } else {
        result = await creditCheckout.executeAsync({ packageId: product.id });
      }

      if (!result?.data?.url) {
        toast.error("Checkout error", {
          description: "Failed to create Stripe checkout session.",
        });
        return;
      }

      window.location.href = result.data.url;
    });
  };

  const currentProducts = useMemo(() => {
    switch (activeTab) {
      case "onetime":
        return onetimeProducts;
      case "monthly":
        return monthlyProducts;
      case "yearly":
        return yearlyProducts;
      default:
        return [];
    }
  }, [activeTab, monthlyProducts, onetimeProducts, yearlyProducts]);

  const standardFeatures = useMemo(
    () => getStandardFeatures(currentProducts),
    [currentProducts]
  );

  const buyCreditsLabel = dictCredits.buy_credits ?? "Buy Credits";

  return (
    <section className="pb-4">
      <div className="mx-auto mb-8 flex justify-center">
        <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1.5">
          <TabButton active={activeTab === "onetime"} onClick={() => setActiveTab("onetime")}>
            {t("onetime")}
          </TabButton>
          <TabButton active={activeTab === "monthly"} onClick={() => setActiveTab("monthly")}>
            {t("monthly")}
          </TabButton>
          <TabButton active={activeTab === "yearly"} onClick={() => setActiveTab("yearly")}>
            {t("yearly")}
            <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
              {isZh ? "省 20%" : "Save 20%"}
            </span>
          </TabButton>
        </div>
      </div>

      {currentProducts.length > 0 ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {currentProducts.map((product) => {
            const isRecommended = product.popular === true;
            const alignedFeatures = standardFeatures.map((feature) => ({
              ...feature,
              included: product.localizedFeatures.some((item) => item === feature.text),
            }));
            const isRestricted = isFreeUser && product.allowFreeUser === false;

            return (
              <PricingCard
                key={product.id}
                product={product}
                features={alignedFeatures}
                isRecommended={isRecommended}
                userId={userId}
                isPending={isPending}
                isRestricted={isRestricted}
                buyCreditsLabel={buyCreditsLabel}
                dictPrice={dictPrice}
                creditsLabel={dictCredits.title ?? (isZh ? "积分" : "Credits")}
                popularLabel={isZh ? "推荐" : "Popular"}
                perMonthLabel={t("per_month")}
                perYearLabel={t("per_year")}
                onCheckout={handleCheckout}
                signInModal={signInModal}
              />
            );
          })}
        </div>
      ) : (
        <div className="py-12 text-center text-muted-foreground">
          {t("no_products")}
        </div>
      )}
    </section>
  );
}

interface TabButtonProps {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}

function TabButton({ active, children, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-200",
        active
          ? "bg-white text-black shadow-[0_10px_30px_rgba(255,255,255,0.12)]"
          : "text-white/68 hover:bg-white/6 hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

interface PricingCardProps {
  product: LocalizedPackage;
  features: FeatureItem[];
  isRecommended: boolean;
  userId?: string;
  isPending: boolean;
  buyCreditsLabel: string;
  dictPrice: Record<string, string>;
  creditsLabel: string;
  popularLabel: string;
  perMonthLabel: string;
  perYearLabel: string;
  onCheckout: (product: LocalizedPackage) => void;
  signInModal: { onOpen: () => void };
  isRestricted?: boolean;
}

function PricingCard({
  product,
  features,
  isRecommended,
  userId,
  isPending,
  buyCreditsLabel,
  dictPrice,
  creditsLabel,
  popularLabel,
  perMonthLabel,
  perYearLabel,
  onCheckout,
  signInModal,
  isRestricted = false,
}: PricingCardProps) {
  return (
    <div
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-[28px] border bg-[linear-gradient(180deg,rgba(23,23,31,0.97),rgba(12,12,18,0.96))] shadow-[0_24px_80px_rgba(0,0,0,0.34)] transition-all",
        isRecommended ? "border-primary/45" : "border-white/10"
      )}
    >
      {isRecommended && (
        <div className="absolute right-5 top-5 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
          {popularLabel}
        </div>
      )}

      <div className="border-b border-white/10 p-7">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white/45">
          {product.displayName}
        </p>
        <div className="mt-5 flex items-end gap-2">
          <span className="text-4xl font-semibold tracking-[-0.04em] text-white">
            {formatPrice(product.price.amount)}
          </span>
          {product.billingPeriod ? (
            <span className="pb-1 text-sm text-muted-foreground">
              {product.billingPeriod === "year" ? perYearLabel : perMonthLabel}
            </span>
          ) : null}
        </div>
        {product.credits ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {creditsLabel}: {product.credits.toLocaleString()}
          </p>
        ) : null}
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
                <Icons.Close className="mt-0.5 h-5 w-5 shrink-0 text-white/30" />
              )}
              <span className={feature.included ? "text-white/88" : "text-muted-foreground"}>
                {feature.text}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-8">
          {userId ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="block w-full">
                    <button
                      type="button"
                      disabled={isPending || isRestricted}
                      onClick={() => onCheckout(product)}
                      className={cn(
                        "flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition-all",
                        "disabled:cursor-not-allowed disabled:opacity-55",
                        isRecommended
                          ? "bg-primary text-primary-foreground shadow-[0_12px_30px_rgba(139,92,246,0.34)] hover:bg-primary/90"
                          : "border border-white/12 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                      )}
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : isRestricted ? (
                        isRestricted && "Subscribers Only"
                      ) : product.billingPeriod ? (
                        dictPrice.upgrade
                      ) : (
                        buyCreditsLabel
                      )}
                    </button>
                  </span>
                </TooltipTrigger>
                {isRestricted && (
                  <TooltipContent>
                    <p>This pack is only available to active subscribers.</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          ) : (
            <button
              type="button"
              onClick={signInModal.onOpen}
              className={cn(
                "w-full rounded-2xl px-5 py-3 text-sm font-semibold transition-all",
                isRecommended
                  ? "bg-primary text-primary-foreground shadow-[0_12px_30px_rgba(139,92,246,0.34)] hover:bg-primary/90"
                  : "border border-white/12 bg-white/[0.04] text-white hover:bg-white/[0.08]"
              )}
            >
              {dictPrice.signup}
            </button>
          )}

        </div>
      </div>
    </div>
  );
}
