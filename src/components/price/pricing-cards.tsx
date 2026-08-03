"use client";

import { useState } from "react";
import Balancer from "react-wrap-balancer";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import * as Icons from "@/components/ui/icons";
import { BillingFormButton } from "@/components/price/billing-form-button";
import {
  getPeriodMonths,
  priceDataMap,
  type BillingPeriod,
} from "@/config/price/price-data";
import { siteConfig } from "@/config/site";
import { useSigninModal } from "@/hooks/use-signin-modal";
import type { UserSubscriptionPlan } from "@/types";

interface PricingCardsProps {
  userId?: string;
  subscriptionPlan?: UserSubscriptionPlan;
}

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function PricingCards({ userId, subscriptionPlan }: PricingCardsProps) {
  const t = useTranslations("PricingCards");
  const credits = useTranslations("Credits");
  const locale = useLocale();
  const [period, setPeriod] = useState<BillingPeriod>("month");
  const signInModal = useSigninModal();
  const pricingData = priceDataMap[locale] || priceDataMap.en;

  const tabs: Array<{
    period: BillingPeriod;
    label: string;
    badge?: string;
  }> = [
    { period: "month", label: t("monthly_bill") },
    {
      period: "quarter",
      label: t("quarterly_bill"),
      badge: t("quarterly_off"),
    },
    { period: "year", label: t("annual_bill"), badge: t("yearly_off") },
  ];

  return (
    <section className="flex flex-col items-center text-center">
      <div className="mb-8 inline-flex rounded-lg border border-slate-700 bg-slate-900 p-1">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.period}
            onClick={() => setPeriod(tab.period)}
            className={`rounded-md px-4 py-2 text-sm font-medium sm:px-5 ${
              period === tab.period
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {tab.label}
            {tab.badge ? (
              <span className="ml-2 text-[10px] font-semibold text-emerald-300">
                {tab.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="mx-auto grid w-full max-w-6xl gap-5 py-5 md:grid-cols-3">
        {pricingData.map((offer) => {
          const cyclePrice = offer.prices[period];
          const monthlyEquivalent = cyclePrice / getPeriodMonths(period);
          const cycleCredits = offer.credits[period];

          return (
            <div
              className={`relative flex min-h-[560px] flex-col overflow-hidden rounded-xl border bg-[#0f172a] text-left shadow-2xl shadow-black/10 ${
                offer.popular ? "border-blue-500/70" : "border-slate-700"
              }`}
              key={offer.id}
            >
              {offer.popular ? (
                <span className="absolute right-4 top-4 rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white">
                  {t("popular")}
                </span>
              ) : null}

              <div className="min-h-[185px] space-y-4 border-b border-slate-700 p-6">
                <p className="text-sm font-bold text-slate-200">{offer.title}</p>
                <p className="pr-20 text-sm text-slate-400">{offer.description}</p>

                <div className="flex items-end">
                  <div className="text-left text-4xl font-bold leading-9 text-white">
                    {period === "month" ? null : (
                      <span className="mr-2 text-xl text-slate-500 line-through">
                        {formatUsd(offer.prices.month)}
                      </span>
                    )}
                    <span>{formatUsd(monthlyEquivalent)}</span>
                  </div>
                  <span className="-mb-1 ml-2 text-sm font-medium text-slate-400">
                    {t("mo")}
                  </span>
                </div>

                <div className="text-left text-sm text-slate-400">
                  {period === "year"
                    ? t("billed_yearly", { price: formatUsd(cyclePrice) })
                    : period === "quarter"
                      ? t("billed_quarterly", { price: formatUsd(cyclePrice) })
                      : t("monthly_info")}
                </div>
              </div>

              <div className="flex h-full flex-1 flex-col justify-between gap-10 p-6">
                <ul className="space-y-3 text-left text-sm leading-6 text-slate-300">
                  <li className="flex items-start">
                    <Icons.Check className="mr-3 h-5 w-5 shrink-0 text-blue-400" />
                    <p>
                      {cycleCredits.toLocaleString(locale)} {credits("title")} {t(
                        period === "year"
                          ? "per_year"
                          : period === "quarter"
                            ? "per_quarter"
                            : "per_month"
                      )}
                    </p>
                  </li>
                  {offer.benefits.map((feature) => (
                    <li className="flex items-start" key={feature}>
                      <Icons.Check className="mr-3 h-5 w-5 shrink-0 text-blue-400" />
                      <p>{feature}</p>
                    </li>
                  ))}
                </ul>

                {userId && subscriptionPlan ? (
                  <BillingFormButton
                    period={period}
                    offer={offer}
                    subscriptionPlan={subscriptionPlan}
                  />
                ) : (
                  <Button
                    onClick={signInModal.onOpen}
                    className={
                      offer.popular
                        ? "bg-blue-600 text-white hover:bg-blue-500"
                        : "border border-slate-600 bg-slate-800 text-white hover:bg-slate-700"
                    }
                  >
                    {t("signup")}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {siteConfig.supportEmail ? (
        <p className="mt-6 text-center text-sm text-slate-500">
          <Balancer>
            Email{" "}
            <a
              className="font-medium text-primary hover:underline"
              href={`mailto:${siteConfig.supportEmail}`}
            >
              {siteConfig.supportEmail}
            </a>{" "}
            {t("contact")}
            <br />
            <strong>{t("contact_2")}</strong>
          </Balancer>
        </p>
      ) : null}
    </section>
  );
}
