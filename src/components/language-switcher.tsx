"use client";

import { Check, Globe } from "lucide-react";
import { useLocale } from "next-intl";
import { startTransition } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { i18n, localeConfig, type Locale } from "@/config/i18n-config";
import { useLocalePathname, useLocaleRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const changeLanguageLabels: Record<Locale, string> = {
  en: "Change language",
  fr: "Changer de langue",
  de: "Sprache ändern",
  zh: "切换语言",
  ja: "言語を変更",
  ko: "언어 변경",
  es: "Cambiar idioma",
};

interface LanguageSwitcherProps {
  className?: string;
  menuClassName?: string;
  showName?: boolean;
  variant?: "dark" | "light";
}

export function LanguageSwitcher({
  className,
  menuClassName,
  showName = false,
  variant = "dark",
}: LanguageSwitcherProps) {
  const activeLocale = useLocale() as Locale;
  const pathname = useLocalePathname();
  const router = useLocaleRouter();
  const activeConfig = localeConfig[activeLocale] ?? localeConfig.en;
  const isDark = variant === "dark";

  function changeLocale(locale: Locale) {
    if (locale === activeLocale) return;
    const suffix = typeof window === "undefined"
      ? ""
      : `${window.location.search}${window.location.hash}`;

    startTransition(() => {
      router.push(`${pathname}${suffix}`, { locale });
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={changeLanguageLabels[activeLocale]}
          className={cn(
            "flex h-9 items-center gap-1.5 rounded-md px-2 text-sm transition-colors",
            isDark
              ? "text-slate-400 hover:bg-slate-800 hover:text-white"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
            className
          )}
        >
          <Globe className="h-4 w-4" aria-hidden="true" />
          <span className="font-medium">{activeConfig.mark}</span>
          {showName ? <span className="hidden xl:inline">{activeConfig.name}</span> : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn(
          "w-40 p-1.5",
          isDark
            ? "border-slate-700 bg-slate-900 text-white"
            : "border-slate-200 bg-white text-slate-950",
          menuClassName
        )}
      >
        {i18n.locales.map((locale) => {
          const config = localeConfig[locale];
          const selected = locale === activeLocale;

          return (
            <DropdownMenuItem
              key={locale}
              aria-current={selected ? "true" : undefined}
              onSelect={() => changeLocale(locale)}
              className={cn(
                "gap-2 rounded-lg px-3 py-2",
                isDark
                  ? "focus:bg-slate-800 focus:text-white"
                  : "focus:bg-slate-100 focus:text-slate-950",
                selected && (isDark ? "bg-slate-800" : "bg-slate-100")
              )}
            >
              <span className="w-6 shrink-0 text-xs font-semibold">{config.mark}</span>
              <span className="flex-1 text-xs">{config.name}</span>
              {selected ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
