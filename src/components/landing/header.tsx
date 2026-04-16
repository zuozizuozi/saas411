"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Gem,
  Globe,
  ImagePlay,
  Menu,
  Type,
  Video,
} from "lucide-react";

import { authClient } from "@/lib/auth/client";
import type { User } from "@/lib/auth/client";
import { useSigninModal } from "@/hooks/use-signin-modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { LocaleLink } from "@/i18n/navigation";
import { useCredits } from "@/stores/credits-store";

const iconMap: Record<string, ComponentType<{ className?: string }>> = {
  ImagePlay,
  Type,
  Video,
};

export function LandingHeader({ user }: { user?: User | null }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const signInModal = useSigninModal();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 18);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navItems = useMemo(() => {
    const isZh = locale === "zh";
    return [
      { label: isZh ? "定价" : "Pricing", href: "/pricing" },
      { label: isZh ? "文档" : "Docs", href: "https://docs.videofly.app", external: true },
    ];
  }, [locale]);

  const toolItems = useMemo(() => {
    const isZh = locale === "zh";
    return [
      { id: "text", label: isZh ? "文生视频" : "Text to Video", href: "/text-to-video", icon: "Type" },
      { id: "image", label: isZh ? "图生视频" : "Image to Video", href: "/image-to-video", icon: "ImagePlay" },
      { id: "reference", label: isZh ? "参考生成" : "Reference to Video", href: "/reference-to-video", icon: "Video" },
    ];
  }, [locale]);

  const switchLocale = async (nextLocale: "en" | "zh") => {
    const currentPath = window.location.pathname + window.location.search + window.location.hash;
    const stripped = currentPath.replace(/^\/(zh)(?=\/|$)/, "") || "/";
    const target = nextLocale === "zh" ? `/zh${stripped === "/" ? "" : stripped}` : stripped;
    router.push(target);
    router.refresh();
  };

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push(`/${locale}`);
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50">
      <div className="container mx-auto px-4 pb-2 pt-4">
        <div
          className={cn(
            "flex h-16 items-center justify-between rounded-full border px-4 backdrop-blur-2xl transition-all duration-300 lg:px-6",
            scrolled
              ? "border-white/12 bg-black/78 shadow-[0_24px_70px_rgba(0,0,0,0.42)]"
              : "border-white/8 bg-black/42"
          )}
        >
          <LocaleLink
            href="/"
            className="flex items-center gap-3 text-base font-semibold tracking-tight text-white"
          >
            <Image src="/logo.svg" alt="VideoFly" width={30} height={30} className="rounded-md" />
            <span>VideoFly</span>
          </LocaleLink>

          <nav className="hidden items-center gap-7 lg:flex">
            <LocaleLink
              href="/"
              className="text-sm font-medium text-white/72 transition-colors hover:text-white"
            >
              {locale === "zh" ? "首页" : "Home"}
            </LocaleLink>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 text-sm font-medium text-white/72 transition-colors hover:text-white"
                >
                  {locale === "zh" ? "工具" : "Tools"}
                  <ChevronDown className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="center"
                className="w-56 border-white/10 bg-black/92 text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
              >
                {toolItems.map((tool) => {
                  const Icon = iconMap[tool.icon];
                  return (
                    <DropdownMenuItem key={tool.id} asChild className="cursor-pointer hover:bg-white/6 focus:bg-white/6">
                      <LocaleLink href={tool.href} className="flex items-center gap-3">
                        {Icon && <Icon className="h-4 w-4 text-primary" />}
                        {tool.label}
                      </LocaleLink>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {navItems.map((item) =>
              item.external ? (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-white/72 transition-colors hover:text-white"
                >
                  {item.label}
                </a>
              ) : (
                <LocaleLink
                  key={item.label}
                  href={item.href}
                  className="text-sm font-medium text-white/72 transition-colors hover:text-white"
                >
                  {item.label}
                </LocaleLink>
              )
            )}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-10 items-center gap-2 rounded-full px-3 text-sm text-white/72 transition-colors hover:bg-white/5 hover:text-white"
                >
                  <Globe className="h-4 w-4" />
                  {locale.toUpperCase()}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="min-w-[120px] border-white/10 bg-black/92 text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
              >
                <DropdownMenuItem onClick={() => switchLocale("en")} className="cursor-pointer hover:bg-white/6 focus:bg-white/6">
                  English
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => switchLocale("zh")} className="cursor-pointer hover:bg-white/6 focus:bg-white/6">
                  中文
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {user && (
              <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white">
                <Gem className="h-4 w-4 text-amber-400" />
                <CreditsDisplay />
              </div>
            )}

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1 pr-3 text-white transition-colors hover:bg-white/8"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-white">
                      {user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
                    </div>
                    <span className="max-w-28 truncate text-sm text-white/82">
                      {user.name || user.email}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-52 border-white/10 bg-black/92 text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
                >
                  <DropdownMenuItem asChild className="cursor-pointer hover:bg-white/6 focus:bg-white/6">
                    <LocaleLink href="/my-creations">{t("Header.myCreations")}</LocaleLink>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer hover:bg-white/6 focus:bg-white/6">
                    <LocaleLink href="/credits">{t("Header.credits")}</LocaleLink>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer hover:bg-white/6 focus:bg-white/6">
                    <LocaleLink href="/settings">{t("Header.settings")}</LocaleLink>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem
                    className="cursor-pointer text-destructive hover:bg-destructive/10 focus:bg-destructive/10"
                    onClick={handleSignOut}
                  >
                    {t("Common.logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={signInModal.onOpen}
                  className="rounded-full px-4 text-white/80 hover:bg-white/5 hover:text-white"
                >
                  {t("Common.login")}
                </Button>
                <LocaleLink href="/register">
                  <Button className="rounded-full bg-white px-5 text-black hover:bg-white/90">
                    {t("Common.signup")}
                  </Button>
                </LocaleLink>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            {user && (
              <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white">
                <Gem className="h-3 w-3 text-amber-400" />
                <CreditsDisplay />
              </div>
            )}

            <Sheet>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/5"
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent className="overflow-y-auto border-white/10 bg-[#090a10]/96 text-white">
                <SheetHeader>
                  <SheetTitle>
                    <LocaleLink href="/" className="flex items-center gap-3 text-left text-white">
                      <Image src="/logo.svg" alt="VideoFly" width={28} height={28} className="rounded-md" />
                      VideoFly
                    </LocaleLink>
                  </SheetTitle>
                </SheetHeader>

                <div className="mt-8 space-y-6">
                  <div className="space-y-2">
                    {navItems.map((item) =>
                      item.external ? (
                        <a
                          key={item.label}
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block rounded-xl px-3 py-2.5 text-sm font-medium text-white/82 transition-colors hover:bg-white/6 hover:text-white"
                        >
                          {item.label}
                        </a>
                      ) : (
                        <LocaleLink
                          key={item.label}
                          href={item.href}
                          className="block rounded-xl px-3 py-2.5 text-sm font-medium text-white/82 transition-colors hover:bg-white/6 hover:text-white"
                        >
                          {item.label}
                        </LocaleLink>
                      )
                    )}
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-3 text-sm font-semibold text-white/92">
                      {locale === "zh" ? "工具" : "Tools"}
                    </div>
                    <div className="space-y-2">
                      {toolItems.map((tool) => {
                        const Icon = iconMap[tool.icon];
                        return (
                          <LocaleLink
                            key={tool.id}
                            href={tool.href}
                            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/78 transition-colors hover:bg-white/6 hover:text-white"
                          >
                            {Icon && <Icon className="h-4 w-4 text-primary" />}
                            {tool.label}
                          </LocaleLink>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-3 text-sm font-semibold text-white/92">
                      {locale === "zh" ? "语言" : "Language"}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => switchLocale("en")}
                        className={cn(
                          "rounded-full px-3 py-1.5 text-sm transition-colors",
                          locale !== "zh" ? "bg-white text-black" : "bg-white/5 text-white/78 hover:bg-white/10"
                        )}
                      >
                        English
                      </button>
                      <button
                        type="button"
                        onClick={() => switchLocale("zh")}
                        className={cn(
                          "rounded-full px-3 py-1.5 text-sm transition-colors",
                          locale === "zh" ? "bg-white text-black" : "bg-white/5 text-white/78 hover:bg-white/10"
                        )}
                      >
                        中文
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-white/10 pt-5">
                    {user ? (
                      <div className="space-y-2">
                        <LocaleLink href="/my-creations" className="block rounded-xl px-3 py-2.5 text-sm text-white/82 transition-colors hover:bg-white/6 hover:text-white">
                          {t("Header.myCreations")}
                        </LocaleLink>
                        <LocaleLink href="/credits" className="block rounded-xl px-3 py-2.5 text-sm text-white/82 transition-colors hover:bg-white/6 hover:text-white">
                          {t("Header.credits")}
                        </LocaleLink>
                        <LocaleLink href="/settings" className="block rounded-xl px-3 py-2.5 text-sm text-white/82 transition-colors hover:bg-white/6 hover:text-white">
                          {t("Header.settings")}
                        </LocaleLink>
                        <button
                          type="button"
                          onClick={handleSignOut}
                          className="block w-full rounded-xl px-3 py-2.5 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
                        >
                          {t("Common.logout")}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Button onClick={signInModal.onOpen} variant="ghost" className="w-full rounded-full text-white hover:bg-white/5">
                          {t("Common.login")}
                        </Button>
                        <LocaleLink href="/register" className="block">
                          <Button className="w-full rounded-full bg-white text-black hover:bg-white/90">
                            {t("Common.signup")}
                          </Button>
                        </LocaleLink>
                      </div>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}

function CreditsDisplay() {
  const { balance } = useCredits();
  return <span>{balance?.availableCredits ?? 0}</span>;
}
