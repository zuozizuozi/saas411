/**
 * ============================================
 * 用户配置文件 - 价格和积分
 * ============================================
 *
 * 📖 使用指南
 * -----------
 * 这个文件包含了所有与价格、积分相关的配置。
 *
 * 🎯 主要配置项：
 * 1. 基础设置 - 新用户赠送、过期规则
 * 2. 订阅产品 - 月付/年付订阅价格和积分
 * 3. 积分包 - 一次性购买积分包
 * 4. 模型计费 - 各 AI 模型的积分消耗规则
 *
 * 📝 修改方法：
 * - 直接修改下面的数值即可（价格用美元，不是美分）
 * - 保存后自动生效，无需重启服务器
 * - 要禁用某个产品，将 enabled 改为 false
 *
 * ⚠️ 注意事项：
 * - id 字段：必须填入 Creem 后台的 Product ID（格式：prod_xxx）
 * - 价格使用美元单位（如 9.9 表示 $9.90）
 * - 积分数量是整数
 * - allowFreeUser: 是否允许免费用户购买（可选，默认 true）
 *
 * 🔄 Creem 配置流程：
 * 1. 在 Creem 后台创建产品（订阅和积分包）
 * 2. 复制每个产品的 Product ID（如 prod_4yNyvLWQ88n8AqJj35uOvK）
 * 3. 将 Product ID 填入下方对应产品的 id 字段
 * 4. .env.local 中无需配置 Price ID（已弃用）
 *
 * ============================================
 */

// ============================================
// 类型定义（内部使用）
// ============================================

/** 视频模型积分配置 */
export interface VideoModelPricing {
  baseCredits: number;
  perSecond: number;
  /** Optional exact site-credit rate per generated second by output quality. */
  creditsPerSecondByQuality?: Record<string, number>;
  qualityMultiplier?: number;
  enabled: boolean;
  availability?: "active" | "coming_soon" | "hidden";
  badge?: string;
}

/** 订阅产品配置 */
export interface SubscriptionProductConfig {
  id: string;
  name: string;
  priceUsd: number;
  credits: number;
  period: "month" | "quarter" | "year";
  popular?: boolean;
  enabled: boolean;
  features?: string[];
}

export type SubscriptionPeriod = SubscriptionProductConfig["period"];

/** 积分包配置 */
export interface CreditPackageConfig {
  id: string;
  name: string;
  priceUsd: number;
  credits: number;
  popular?: boolean;
  enabled: boolean;
  /** 是否允许免费用户购买（可选，默认 true） */
  allowFreeUser?: boolean;
  features?: string[];
}

// ============================================
// 一、基础设置
// ============================================

/**
 * 新用户注册赠送积分
 */
export const NEW_USER_GIFT = {
  /** 是否启用赠送 */
  enabled: false,
  /** 赠送积分数量 */
  credits: 0,
  /** 积分有效期（天）*/
  validDays: 30,
};

/**
 * 积分过期设置
 */
export const CREDIT_EXPIRATION = {
  /** 订阅积分有效期（天）- 月付用户 */
  subscriptionDays: 30,
  /** 一次性购买积分有效期（天）- 单独购买积分包 */
  purchaseDays: 365,
  /** 提前多少天提醒积分即将过期 */
  warnBeforeDays: 7,
};

// ============================================
// 二、订阅产品配置
// ============================================

/**
 * 订阅产品列表
 *
 * 每个产品包含：
 * - id: Creem Product ID（从 Creem 后台复制，如 prod_xxx）
 * - name: 显示名称
 * - priceUsd: 价格（美元）
 * - credits: 每周期赠送积分
 * - period: 付费周期 ("month" 或 "year")
 * - popular: 是否标记为推荐（最多选1-2个）
 * - enabled: 是否启用该产品
 *
 * ⚠️ 重要：id 字段必须是 Creem 后台的 Product ID（格式：prod_xxx）
 * 在 Creem 后台创建产品后，复制 Product ID 到下方对应的 id 字段
 */
const PAID_PLAN_FEATURES = [
  "all_models",
  "text_image_video",
  "model_quality_audio",
  "generation_status_history",
  "credit_cost_preview",
  "failed_credit_return",
  "no_platform_watermark",
];

export const SUBSCRIPTION_PRODUCTS: SubscriptionProductConfig[] = [
  // ===== 月付订阅 =====
  {
    id: "sub_basic_monthly",
    name: "Go Plan",
    priceUsd: 9.9,
    credits: 280,
    period: "month",
    popular: false,
    enabled: true,
    features: PAID_PLAN_FEATURES,
  },
  {
    id: "sub_pro_monthly",
    name: "Plus Plan",
    priceUsd: 29.9,
    credits: 900,
    period: "month",
    popular: true,
    enabled: true,
    features: PAID_PLAN_FEATURES,
  },
  {
    id: "sub_business_monthly",
    name: "Pro Plan",
    priceUsd: 79.9,
    credits: 2520,
    period: "month",
    popular: false,
    enabled: true,
    features: PAID_PLAN_FEATURES,
  },

  // ===== 季付订阅（5% OFF） =====
  {
    id: "sub_basic_quarterly",
    name: "Go Plan (Quarterly)",
    priceUsd: 28.22,
    credits: 840,
    period: "quarter",
    popular: false,
    enabled: true,
    features: PAID_PLAN_FEATURES,
  },
  {
    id: "sub_pro_quarterly",
    name: "Plus Plan (Quarterly)",
    priceUsd: 85.22,
    credits: 2700,
    period: "quarter",
    popular: true,
    enabled: true,
    features: PAID_PLAN_FEATURES,
  },
  {
    id: "sub_business_quarterly",
    name: "Pro Plan (Quarterly)",
    priceUsd: 227.72,
    credits: 7560,
    period: "quarter",
    popular: false,
    enabled: true,
    features: PAID_PLAN_FEATURES,
  },

  // ===== 年付订阅（10% OFF） =====
  {
    id: "sub_basic_yearly",
    name: "Go Plan (Yearly)",
    priceUsd: 106.92,
    credits: 3360,
    period: "year",
    popular: false,
    enabled: true,
    features: PAID_PLAN_FEATURES,
  },
  {
    id: "sub_pro_yearly",
    name: "Plus Plan (Yearly)",
    priceUsd: 322.92,
    credits: 10800,
    period: "year",
    popular: true,
    enabled: true,
    features: PAID_PLAN_FEATURES,
  },
  {
    id: "sub_business_yearly",
    name: "Pro Plan (Yearly)",
    priceUsd: 862.92,
    credits: 30240,
    period: "year",
    popular: false,
    enabled: true,
    features: PAID_PLAN_FEATURES,
  },
];

// ============================================
// 三、一次性购买积分包
// ============================================

/**
 * 积分包产品列表
 *
 * 用户可以单独购买积分包（不订阅）
 *
 * allowFreeUser 说明：
 * - true:  所有用户都可以购买此积分包
 * - false: 只有订阅用户才能购买此积分包
 * - 不填: 默认为 true（所有用户可购买）
 *
 * ⚠️ 重要：id 字段必须是 Creem 后台的 Product ID（格式：prod_xxx）
 */
export const CREDIT_PACKAGES: CreditPackageConfig[] = [
  {
    id: "pack_starter",
    name: "Starter Pack",
    priceUsd: 14.9,
    credits: 280,
    popular: true,
    enabled: true,
    allowFreeUser: true,
    features: PAID_PLAN_FEATURES,
  },
  {
    id: "pack_standard",
    name: "Standard Pack",
    priceUsd: 39.9,
    credits: 900,
    popular: false,
    enabled: true,
    allowFreeUser: true,
    features: PAID_PLAN_FEATURES,
  },
  {
    id: "pack_pro",
    name: "Premium Pack",
    priceUsd: 99.9,
    credits: 2520,
    popular: false,
    enabled: true,
    allowFreeUser: true,
    features: PAID_PLAN_FEATURES,
  },
];

// ============================================
// 四、AI 模型积分计费
// ============================================

/**
 * 视频生成模型积分配置
 *
 * 💡 定价说明（基于 Evolink 1:1 成本，向上取整）:
 *
 * 1. **Veo 3.1 Fast Lite**: 固定 10 积分（基准价格）
 * 2. **Sora 2 Lite**: 10s=2积分, 15s=3积分 (无水印)
 * 3. **Wan 2.6**: 720p: 5s=25积分, 10s=50积分, 15s=75积分
 *              1080p × 1.67 倍
 * 4. **Seedance 1.5 Pro**: 按秒计费, 默认有音频
 *                          480p: 1.636 Credits/秒 → 2 积分/秒
 *                          720p: 3.557 Credits/秒 → 4 积分/秒
 *                          1080p: 7.932 Credits/秒 → 8 积分/秒
 *
 * 计费规则说明：
 * - baseCredits: 基础积分（最短时长、最低画质）
 * - perSecond: 每秒积分（用于按秒计费的模型）
 * - qualityMultiplier: 画质乘数（1080p vs 720p）
 */
export const VIDEO_MODEL_PRICING: Record<string, VideoModelPricing> = {
  /** Legacy provider route retained for rollback, but hidden from the product. */
  "zhipu-video": {
    baseCredits: 0,
    perSecond: 1,
    enabled: false,
    availability: "hidden",
  },

  /** Seedance 2.0 Mini - recommended launch model. */
  "seedance-2.0-mini": {
    baseCredits: 0,
    perSecond: 14,
    creditsPerSecondByQuality: {
      "480p": 7,
      "720p": 14,
    },
    enabled: true,
    availability: "active",
    badge: "Recommended",
  },

  /** Seedance 2.0 - premium launch model. */
  "seedance-2.0": {
    baseCredits: 0,
    perSecond: 28,
    creditsPerSecondByQuality: {
      "480p": 14,
      "720p": 28,
      "1080p": 56,
    },
    enabled: true,
    availability: "active",
    badge: "Pro",
  },

  /** Seedance 1.5 Pro - observed provider rates doubled and rounded up. */
  "seedance-1.5-pro": {
    baseCredits: 0,
    perSecond: 8,
    creditsPerSecondByQuality: {
      "480p": 4,
      "720p": 8,
      "1080p": 16,
    },
    enabled: true,
    availability: "active",
  },

  /** Catalog placeholder only; no provider route is enabled. */
  "seedance-2.5": {
    baseCredits: 0,
    perSecond: 0,
    enabled: false,
    availability: "coming_soon",
    badge: "Coming Soon",
  },

  /** Seedance 1.0 Pro Fast - 快速生成（APImart） */
  "seedance-1.0-pro-fast": {
    baseCredits: 0,
    perSecond: 3, // 按秒计费
    qualityMultiplier: 2,
    enabled: false,
    availability: "hidden",
  },

  /** Seedance 1.0 Pro Quality - 高质量生成（APImart） */
  "seedance-1.0-pro-quality": {
    baseCredits: 0,
    perSecond: 5, // 高质量，每秒积分更高
    qualityMultiplier: 2,
    enabled: false,
    availability: "hidden",
  },

  /** Veo 3.1 Fast Lite - Google (暂时隐藏) */
  "veo-3.1": {
    baseCredits: 0,
    perSecond: 2,
    enabled: false,
    availability: "hidden",
  },

  /** Sora 2 Lite - OpenAI (暂时隐藏) */
  "sora-2": {
    baseCredits: 0,
    perSecond: 1,
    enabled: false,
    availability: "hidden",
  },

  /** Wan 2.6 (暂时隐藏) */
  "wan2.6": {
    baseCredits: 0,
    perSecond: 5,
    qualityMultiplier: 2,
    enabled: false,
    availability: "hidden",
  },
};

// ============================================
// 五、支付配置（环境变量）
// ============================================

/**
 * 支付提供商配置
 *
 * 这些配置通常在 .env.local 文件中设置
 * 这里只是说明，不需要修改
 */
export const PAYMENT_CONFIG = {
  /** 使用 Creem 支付 */
  provider: "stripe",
  /** Creem Webhook URL（用于接收支付状态通知）*/
  webhookUrl: process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/stripe`
    : "",
};
