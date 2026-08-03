import {
  SUBSCRIPTION_PRODUCTS,
  type SubscriptionPeriod,
} from "@/config/pricing-user";

export type BillingPeriod = SubscriptionPeriod;

export interface SubscriptionPlanTranslation {
  id: "go" | "plus" | "pro";
  title: string;
  description: string;
  benefits: string[];
  limitations: string[];
  prices: Record<BillingPeriod, number>;
  stripeIds: Record<BillingPeriod, string | null>;
  credits: Record<BillingPeriod, number>;
  popular?: boolean;
}

const planIds = ["go", "plus", "pro"] as const;
type PlanId = (typeof planIds)[number];

const productPlanMap: Record<string, PlanId> = {
  "Go Plan": "go",
  "Plus Plan": "plus",
  "Pro Plan": "pro",
};

const copy = {
  go: {
    zh: { title: "Go", description: "适合轻量创作和初次使用" },
    en: { title: "Go", description: "For light creation and getting started" },
  },
  plus: {
    zh: { title: "Plus", description: "适合持续创作的个人和创作者" },
    en: { title: "Plus", description: "For regular creators and ongoing projects" },
  },
  pro: {
    zh: { title: "Pro", description: "适合高频创作和更大的内容需求" },
    en: { title: "Pro", description: "For high-volume creation and larger workloads" },
  },
} as const;

const benefits = {
  zh: [
    "使用全部已上线的 Seedance 模型",
    "支持文生视频和图生视频",
    "按模型支持最高 1080p 与原生音频",
    "实时生成状态、历史记录与视频下载",
    "生成前显示预计积分消耗",
    "生成失败自动返还冻结积分",
    "seedance.co 不额外添加平台水印",
  ],
  en: [
    "Access every available Seedance model",
    "Text-to-video and image-to-video",
    "Up to 1080p and native audio where supported",
    "Real-time status, generation history, and downloads",
    "Credit cost preview before generation",
    "Automatic credit return when generation fails",
    "No seedance.co platform watermark added",
  ],
} as const;

const stripeIds: Record<PlanId, Record<BillingPeriod, string | null>> = {
  go: {
    month: process.env.NEXT_PUBLIC_STRIPE_BASIC_MONTHLY_PRICE_ID ?? null,
    quarter: process.env.NEXT_PUBLIC_STRIPE_BASIC_QUARTERLY_PRICE_ID ?? null,
    year: process.env.NEXT_PUBLIC_STRIPE_BASIC_YEARLY_PRICE_ID ?? null,
  },
  plus: {
    month: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID ?? null,
    quarter: process.env.NEXT_PUBLIC_STRIPE_PRO_QUARTERLY_PRICE_ID ?? null,
    year: process.env.NEXT_PUBLIC_STRIPE_PRO_YEARLY_PRICE_ID ?? null,
  },
  pro: {
    month: process.env.NEXT_PUBLIC_STRIPE_BUSINESS_MONTHLY_PRICE_ID ?? null,
    quarter: process.env.NEXT_PUBLIC_STRIPE_BUSINESS_QUARTERLY_PRICE_ID ?? null,
    year: process.env.NEXT_PUBLIC_STRIPE_BUSINESS_YEARLY_PRICE_ID ?? null,
  },
};

function emptyPeriodRecord(): Record<BillingPeriod, number> {
  return { month: 0, quarter: 0, year: 0 };
}

function getBaseProductName(name: string): string {
  return name.replace(/ \((Quarterly|Yearly)\)$/, "");
}

function generatePriceData(locale: "zh" | "en"): SubscriptionPlanTranslation[] {
  return planIds.map((planId) => {
    const prices = emptyPeriodRecord();
    const credits = emptyPeriodRecord();
    let popular = false;

    for (const product of SUBSCRIPTION_PRODUCTS) {
      if (productPlanMap[getBaseProductName(product.name)] !== planId) continue;
      prices[product.period] = product.priceUsd;
      credits[product.period] = product.credits;
      popular ||= product.popular === true;
    }

    return {
      id: planId,
      title: copy[planId][locale].title,
      description: copy[planId][locale].description,
      benefits: [...benefits[locale]],
      limitations: [],
      prices,
      stripeIds: stripeIds[planId],
      credits,
      popular,
    };
  });
}

export const priceDataMap: Record<string, SubscriptionPlanTranslation[]> = {
  zh: generatePriceData("zh"),
  en: generatePriceData("en"),
};

export function getPeriodMonths(period: BillingPeriod): number {
  return period === "year" ? 12 : period === "quarter" ? 3 : 1;
}
