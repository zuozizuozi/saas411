export const i18n = {
  defaultLocale: "en",
  locales: ["en", "fr", "de", "zh", "ja", "ko", "es"],
} as const;

export type Locale = (typeof i18n)["locales"][number];

// 语言配置对象（用于 next-intl）
export const localeConfig = {
  en: {
    mark: "EN",
    name: "English",
    hreflang: "en",
  },
  fr: {
    mark: "FR",
    name: "Français",
    hreflang: "fr",
  },
  de: {
    mark: "DE",
    name: "Deutsch",
    hreflang: "de",
  },
  zh: {
    mark: "中",
    name: "中文",
    hreflang: "zh-CN",
  },
  ja: {
    mark: "JA",
    name: "日本語",
    hreflang: "ja",
  },
  ko: {
    mark: "KO",
    name: "한국어",
    hreflang: "ko",
  },
  es: {
    mark: "ES",
    name: "Español",
    hreflang: "es",
  },
} as const;

// Cookie 名称
export const LOCALE_COOKIE_NAME = "NEXT_LOCALE";

// 向后兼容的 localeMap
export const localeMap = Object.fromEntries(
  Object.entries(localeConfig).map(([locale, config]) => [locale, config.name])
) as Record<Locale, string>;
