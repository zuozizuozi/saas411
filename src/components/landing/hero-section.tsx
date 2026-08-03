"use client";

import { ImagePlay, Type } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ProviderType } from "@/ai";
import { SHOWCASE_MEDIA } from "@/config/showcase-media";
import { LocaleLink } from "@/i18n/navigation";

interface HeroSectionProps { currentProvider?: ProviderType }

export function HeroSection({ currentProvider: _currentProvider }: HeroSectionProps) {
  const hero = useTranslations("Hero");
  const navigation = useTranslations("Navigation");
  return (
    <section className="relative -mt-24 flex min-h-[760px] items-center justify-center overflow-hidden bg-[#030712] pt-24 sm:min-h-[780px] lg:min-h-screen">
      <video autoPlay muted loop playsInline preload="metadata" src={SHOWCASE_MEDIA.homeHero} className="pointer-events-none absolute inset-0 h-full w-full object-cover motion-reduce:hidden" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,7,18,0.35)_0%,rgba(3,7,18,0.38)_35%,rgba(3,7,18,0.82)_84%,#030712_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_10%,rgba(3,7,18,0.28)_70%)]" />

      <div className="relative z-10 mx-auto w-full max-w-5xl px-5 py-24 text-center">
        <span className="mb-6 inline-flex rounded-full border border-white/20 bg-black/25 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 backdrop-blur-md">{hero("badge")}</span>
        <h1 className="mx-auto max-w-4xl text-balance text-4xl font-bold leading-[1.08] tracking-[-0.04em] text-white sm:text-5xl lg:text-7xl">
          {hero("title")} <span className="text-blue-500">{hero("subtitle")}</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-balance text-base leading-7 text-white/78 sm:text-lg lg:text-xl">
          {hero("description")}
        </p>
        <div className="mx-auto mt-10 flex max-w-sm flex-col gap-3 sm:max-w-xl sm:flex-row sm:justify-center">
          <LocaleLink href="/image-to-video" className="group flex h-14 flex-1 items-center justify-center gap-2 rounded-xl border border-cyan-400/70 bg-black/55 px-6 font-semibold text-white shadow-lg shadow-cyan-950/30 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-black/70">
            <ImagePlay className="h-5 w-5" />{navigation("imageToVideo")}
          </LocaleLink>
          <LocaleLink href="/text-to-video" className="group flex h-14 flex-1 items-center justify-center gap-2 rounded-xl border border-amber-400/70 bg-black/55 px-6 font-semibold text-white shadow-lg shadow-amber-950/30 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-black/70">
            <Type className="h-5 w-5" />{navigation("textToVideo")}
          </LocaleLink>
        </div>
        <p className="mt-5 text-xs text-white/50">{hero("creditsHint")}</p>
      </div>
    </section>
  );
}
