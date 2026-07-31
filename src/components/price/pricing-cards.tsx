"use client";

import { useState } from "react";
import Balancer from "react-wrap-balancer";
import { useTranslations, useLocale } from "next-intl";

import { Button } from "@/components/ui/button";
import * as Icons from "@/components/ui/icons";

import { BillingFormButton } from "@/components/price/billing-form-button";
import { priceDataMap, type SubscriptionPlanTranslation } from "@/config/price/price-data";
import { siteConfig } from "@/config/site";
import { useSigninModal } from "@/hooks/use-signin-modal";
import { UserSubscriptionPlan } from "@/types";

interface PricingCardsProps {
  userId?: string;
  subscriptionPlan?: UserSubscriptionPlan;
}

export function PricingCards({
  userId,
  subscriptionPlan,
}: PricingCardsProps) {
  const t = useTranslations('PricingCards');
  const locale = useLocale();
  const isYearlyDefault = true;
  const [isYearly, setIsYearly] = useState<boolean>(isYearlyDefault);
  const signInModal = useSigninModal();
  const pricingData = priceDataMap[locale] || priceDataMap.en;
  return (
    <section className="flex flex-col items-center text-center">
      <div className="mb-8 inline-flex rounded-lg border border-slate-700 bg-slate-900 p-1">
        <button type="button" onClick={() => setIsYearly(false)} className={`rounded-md px-5 py-2 text-sm font-medium ${!isYearly ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"}`}>{t('monthly_bill')}</button>
        <button type="button" onClick={() => setIsYearly(true)} className={`rounded-md px-5 py-2 text-sm font-medium ${isYearly ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}>{t('annual_bill')}<span className="ml-2 text-[10px] text-emerald-300">20% OFF</span></button>
      </div>

      <div className="mx-auto grid w-full max-w-6xl gap-5 py-5 md:grid-cols-3">
        {pricingData.map((offer: SubscriptionPlanTranslation, index) => (
          <div
            className={`relative flex min-h-[520px] flex-col overflow-hidden rounded-xl border bg-[#0f172a] text-left shadow-2xl shadow-black/10 ${index === 1 ? "border-blue-500/70" : "border-slate-700"}`}
            key={offer.id}
          >
            {index === 1 && <span className="absolute right-4 top-4 rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white">{locale === "zh" ? "最受欢迎" : "Most popular"}</span>}
            <div className="min-h-[170px] space-y-4 border-b border-slate-700 p-6">
              <p className="flex text-sm font-bold text-slate-200">
                {offer.title}
              </p>

              <div className="flex flex-row">
                <div className="flex items-end">
                  <div className="flex text-left text-4xl font-bold leading-9 text-white">
                    {isYearly && offer.prices.monthly > 0 ? (
                      <>
                        <span className="mr-2 text-xl text-slate-500 line-through">
                          ${offer.prices.monthly}
                        </span>
                        <span>${(offer.prices.yearly / 12).toFixed(2)}</span>
                      </>
                    ) : (
                      `$${offer.prices.monthly}`
                    )}
                  </div>
                  <div className="-mb-1 ml-2 text-left text-sm font-medium text-slate-400">
                    <div>{t('mo')}</div>
                  </div>
                </div>
              </div>
              {offer.prices.monthly > 0 ? (
                <div className="text-left text-sm text-slate-400">
                  {isYearly
                    ? `$${offer.prices.yearly} ${t('annual_info')}`
                    : `${t('monthly_info')}`}
                </div>
              ) : null}
            </div>

            <div className="flex h-full flex-1 flex-col justify-between gap-10 p-6">
              <ul className="space-y-3 text-left text-sm leading-6 text-slate-300">
                {offer.benefits.map((feature) => (
                  <li className="flex items-start" key={feature}>
                    <Icons.Check className="mr-3 h-5 w-5 shrink-0 text-blue-400" />
                    <p>{feature}</p>
                  </li>
                ))}

                {offer.limitations?.length > 0 &&
                  offer.limitations.map((feature) => (
                    <li
                      className="flex items-start text-slate-500"
                      key={feature}
                    >
                      <Icons.Close className="mr-3 h-5 w-5 shrink-0" />
                      <p>{feature}</p>
                    </li>
                  ))}
              </ul>

              {userId && subscriptionPlan ? (
                <BillingFormButton
                  year={isYearly}
                  offer={offer}
                  subscriptionPlan={subscriptionPlan}
                />
              ) : (
                <Button onClick={signInModal.onOpen} className={index === 1 ? "bg-blue-600 text-white hover:bg-blue-500" : "border border-slate-600 bg-slate-800 text-white hover:bg-slate-700"}>{t('signup')}</Button>
              )}
            </div>
          </div>
        ))}
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
            {t('contact')}
            <br />
            <strong>{t('contact_2')}</strong>
          </Balancer>
        </p>
      ) : null}
    </section>
  );
}
