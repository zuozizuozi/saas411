// ============================================
// 类型定义
// ============================================

export type ProductType = "subscription" | "one-time";
import type { ProviderType } from "@/ai/types";
import {
  isModelModeSupported,
  isModelSupported,
  type GenerationMode,
} from "@/ai/model-mapping";

export interface CreditPackagePrice {
  amount: number;            // 价格（美分）
  currency: string;
}

export interface CreditPackageConfig {
  id: string;
  name: string;              // 产品显示名称
  credits: number;           // 积分数量
  price: CreditPackagePrice;
  type: ProductType;
  billingPeriod?: "month" | "year";
  popular?: boolean;
  disabled?: boolean;
  expireDays?: number;       // 覆盖默认过期天数
  features?: string[];       // 功能列表（用于展示）
  /** 是否允许免费用户购买（仅积分包有效） */
  allowFreeUser?: boolean;
}

export interface ModelConfig {
  id: string;
  name: string;
  provider: ProviderType;
  description: string;
  supportImageToVideo: boolean;
  /** Whether the provider accepts an audio-generation flag for this model. */
  supportAudio?: boolean;
  /** Whether the provider accepts a per-request watermark removal flag. */
  supportRemoveWatermark?: boolean;
  maxDuration: number;
  /** Full duration scale rendered by the product UI. */
  durationDisplayMin?: number;
  durationDisplayMax?: number;
  /** Durations completed by one provider generation task. */
  nativeDurations?: number[];
  /** Durations completed through a provider's official extend workflow. */
  extendedDurations?: number[];
  durations: number[];
  aspectRatios: string[];
  qualities?: string[];
  creditCost: {
    base: number;            // 基础积分（10s）
    perExtraSecond?: number; // 每额外秒积分
    highQualityMultiplier?: number; // 高质量乘数
  };
  /** Whether the model is enabled (default: true). Disabled models can still be shown with a badge */
  enabled?: boolean;
  /** Optional badge text for disabled/upcoming models (e.g., "Coming Soon") */
  badge?: string;
}

// ============================================
// 用户配置导入
// ============================================
// 所有的价格和积分配置都在 pricing-user.ts 中
// 用户只需要修改那个文件即可
import {
  NEW_USER_GIFT,
  CREDIT_EXPIRATION,
  SUBSCRIPTION_PRODUCTS,
  CREDIT_PACKAGES,
  VIDEO_MODEL_PRICING,
} from "./pricing-user";

// ============================================
// 转换函数：用户配置 -> 内部格式
// ============================================

/** 将美元转换为美分（内部使用） */
function usdToCents(usd: number): number {
  return Math.round(usd * 100);
}

// ============================================
// 统一积分配置（从 pricing-user.ts 生成）
// ============================================

export const CREDITS_CONFIG = {
  // ========== 系统开关 ==========
  enabled: true, // 积分系统始终启用

  // ========== 新用户赠送 ==========
  registerGift: {
    enabled: NEW_USER_GIFT.enabled,
    amount: NEW_USER_GIFT.credits,
    expireDays: NEW_USER_GIFT.validDays,
  },

  // ========== 过期配置 ==========
  expiration: {
    subscriptionDays: CREDIT_EXPIRATION.subscriptionDays,
    purchaseDays: CREDIT_EXPIRATION.purchaseDays,
    warnBeforeDays: CREDIT_EXPIRATION.warnBeforeDays,
  },

  // ========== 订阅产品（从 pricing-user.ts 生成）==========
  subscriptions: Object.fromEntries(
    SUBSCRIPTION_PRODUCTS.filter((p) => p.enabled).map((product) => {
      const isYearly = product.period === "year";
      const planType = product.id.includes("basic")
        ? "BASIC"
        : product.id.includes("pro")
          ? "PRO"
          : "TEAM";
      const envKey = isYearly ? "YEARLY" : "MONTHLY";

      return [
        product.id,
        {
          id: product.id,
          name: product.name,
          credits: product.credits,
          price: {
            amount: usdToCents(product.priceUsd),
            currency: "USD",
          },
          type: "subscription" as const,
          billingPeriod: product.period,
          popular: product.popular,
          expireDays: isYearly ? 365 : undefined,
          features: product.features || [],
        },
      ];
    })
  ) as Record<string, CreditPackageConfig>,

  // ========== 一次性购买产品（从 pricing-user.ts 生成）==========
  packages: Object.fromEntries(
    CREDIT_PACKAGES.filter((p) => p.enabled).map((pkg) => [
      pkg.id,
      {
        id: pkg.id,
        name: pkg.name,
        credits: pkg.credits,
        price: {
          amount: usdToCents(pkg.priceUsd),
          currency: "USD",
        },
        type: "one-time" as const,
        popular: pkg.popular,
        expireDays: CREDIT_EXPIRATION.purchaseDays,
        features: pkg.features || [],
        // allowFreeUser: 是否允许免费用户购买（前端使用）
        allowFreeUser: pkg.allowFreeUser ?? true, // 默认允许
      },
    ])
  ) as Record<string, CreditPackageConfig>,

  // ========== AI 模型配置（从 pricing-user.ts 生成）==========
  models: Object.fromEntries(
    Object.entries(VIDEO_MODEL_PRICING)
      .map(([modelId, pricing]) => {
        // 模型基础配置（从 defaults.ts 获取）
        const baseConfigs: Record<string, Omit<ModelConfig, "creditCost">> = {
          "zhipu-video": {
            id: "zhipu-video",
            name: "AI Video",
            provider: "bailian" as const,
            description: "AI video generation with text, images, and audio",
            supportImageToVideo: true,
            supportAudio: true,
            supportRemoveWatermark: false,
            maxDuration: 15,
            durationDisplayMin: 5,
            durationDisplayMax: 30,
            nativeDurations: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
            extendedDurations: [],
            durations: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
            aspectRatios: ["16:9", "9:16", "1:1"],
            qualities: ["speed", "quality"],
          },
          "sora-2": {
            id: "sora-2",
            name: "Sora 2",
            provider: "evolink" as const,
            description: "models.sora2.description",
            supportImageToVideo: true,
            maxDuration: 15,
            durations: [10, 15],
            aspectRatios: ["16:9", "9:16"],
          },
          "wan2.6": {
            id: "wan2.6",
            name: "Wan 2.6",
            provider: "evolink" as const,
            description: "models.wan26.description",
            supportImageToVideo: true,
            maxDuration: 15,
            durations: [5, 10, 15],
            aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
            qualities: ["720P", "1080P"],
          },
          "veo-3.1": {
            id: "veo-3.1",
            name: "Veo 3.1",
            provider: "evolink" as const,
            description: "models.veo31.description",
            supportImageToVideo: true,
            maxDuration: 8,
            durations: [8],
            aspectRatios: ["16:9", "9:16"],
          },
          "seedance-1.5-pro": {
            id: "seedance-1.5-pro",
            name: "Seedance 1.5 Pro",
            provider: "apimart" as const,
            description: "models.seedance.description",
            supportImageToVideo: true,
            supportAudio: true,
            maxDuration: 12,
            durations: [4, 5, 6, 8, 10, 12],
            aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
            qualities: ["480P", "720P", "1080P"],
          },
          "seedance-1.0-pro-fast": {
            id: "seedance-1.0-pro-fast",
            name: "Seedance 1.0 Pro Fast",
            provider: "apimart" as const,
            description: "models.seedance10fast.description",
            supportImageToVideo: true,
            supportAudio: true,
            maxDuration: 12,
            durations: [2, 4, 5, 6, 8, 10, 12],
            aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
            qualities: ["480P", "720P", "1080P"],
          },
          "seedance-1.0-pro-quality": {
            id: "seedance-1.0-pro-quality",
            name: "Seedance 1.0 Pro Quality",
            provider: "apimart" as const,
            description: "models.seedance10quality.description",
            supportImageToVideo: true,
            supportAudio: true,
            maxDuration: 12,
            durations: [2, 4, 5, 6, 8, 10, 12],
            aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
            qualities: ["480P", "720P", "1080P"],
          },
        };

        const baseConfig = baseConfigs[modelId];
        if (!baseConfig) return null;

        const creditCost: {
          base: number;
          perExtraSecond: number;
          highQualityMultiplier?: number;
        } = {
          base: pricing.baseCredits,
          perExtraSecond: pricing.perSecond,
        };

        if (pricing.qualityMultiplier !== undefined) {
          creditCost.highQualityMultiplier = pricing.qualityMultiplier;
        }

        return [
          modelId,
          {
            ...baseConfig,
            creditCost,
            enabled: pricing.enabled,
            badge: pricing.enabled ? undefined : "Coming Soon",
          },
        ];
      })
      .filter(Boolean) as Array<[string, ModelConfig]>
  ) as Record<string, ModelConfig>,
};

// ============================================
// 辅助函数
// ============================================

/** 获取所有订阅产品 */
export function getSubscriptionProducts(): CreditPackageConfig[] {
  return Object.values(CREDITS_CONFIG.subscriptions).filter(
    (p) => !(p as CreditPackageConfig).disabled
  );
}

/** 获取所有一次性购买产品 */
export function getOnetimeProducts(): CreditPackageConfig[] {
  return Object.values(CREDITS_CONFIG.packages).filter(
    (p) => !(p as CreditPackageConfig).disabled
  );
}

/** 根据产品 ID 获取配置 */
export function getProductById(productId: string): CreditPackageConfig | null {
  const all = {
    ...CREDITS_CONFIG.subscriptions,
    ...CREDITS_CONFIG.packages,
  };
  return Object.values(all).find(p => p.id === productId) || null;
}

/** 获取产品过期天数 */
export function getProductExpiryDays(product: CreditPackageConfig): number {
  if (product.expireDays !== undefined) {
    return product.expireDays;
  }
  return product.type === "subscription"
    ? CREDITS_CONFIG.expiration.subscriptionDays
    : CREDITS_CONFIG.expiration.purchaseDays;
}

/** 获取所有模型（按显示顺序排序） */
export function getAvailableModels(options?: {
  provider?: ProviderType;
  mode?: GenerationMode;
  enabledOnly?: boolean;
}): ModelConfig[] {
  const { provider, mode, enabledOnly = true } = options || {};
  // Define display order (newest/most important first)
  // Models not in this list are sorted to the end
  const displayOrder = Object.keys(VIDEO_MODEL_PRICING);
  const orderMap = new Map(displayOrder.map((id, index) => [id, index]));
  return Object.values(CREDITS_CONFIG.models)
    .filter((model) => !enabledOnly || model.enabled !== false)
    .filter((model) => {
      const effectiveProvider = provider || model.provider;
      if (!isModelSupported(model.id, effectiveProvider)) return false;
      if (!mode) return true;
      return isModelModeSupported(model.id, effectiveProvider, mode);
    })
    .sort((a, b) => {
    const aOrder = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bOrder = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder;
  });
}

/** 根据模型 ID 获取配置 */
export function getModelConfig(modelId: string): ModelConfig | null {
  return CREDITS_CONFIG.models[modelId as keyof typeof CREDITS_CONFIG.models] || null;
}

/** 计算模型积分消耗（基于 Evolink 1:1 成本） */
export function calculateModelCredits(
  modelId: string,
  params: { duration: number; quality?: string }
): number {
  const config = getModelConfig(modelId);
  if (!config) return 0;

  const { base, perExtraSecond = 0, highQualityMultiplier = 1 } = config.creditCost;

  const parseQualityToResolution = (quality?: string): number => {
    if (!quality) return 720;
    const normalized = quality.toLowerCase();
    if (normalized.includes("1080")) return 1080;
    if (normalized.includes("720")) return 720;
    if (normalized.includes("480")) return 480;
    if (normalized === "high") return 1080;
    return 720;
  };
  const resolution = parseQualityToResolution(params.quality);
  const isHighQuality = resolution >= 1080 || params.quality?.toLowerCase() === "high";

  const configuredPerSecond = perExtraSecond > 0 ? perExtraSecond : base;
  const qualityMultiplier = isHighQuality ? highQualityMultiplier : 1;
  // Resolve the integer one-second price first. This guarantees that N
  // seconds always costs exactly N times the one-second price.
  const creditsPerSecond = Math.max(
    1,
    Math.ceil(configuredPerSecond * qualityMultiplier)
  );

  return Math.max(0, Math.trunc(params.duration)) * creditsPerSecond;
}
