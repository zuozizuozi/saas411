"use client";

import { ArrowRight, Check, Clock3, Film, Sparkles, WandSparkles } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { cn } from "@/components/ui";
import { SHOWCASE_MEDIA } from "@/config/showcase-media";
import type { ToolPageConfig } from "@/config/tool-pages";

export interface ToolLandingPageProps { config: ToolPageConfig; locale?: string; className?: string }

export function ToolLandingPage({ config, locale = "en", className }: ToolLandingPageProps) {
  const isImage = config.generator.mode === "image-to-video";
  const navigation = useTranslations("Navigation");
  const features = useTranslations("Features");
  const showcase = useTranslations("Showcase");
  const how = useTranslations("HowItWorks");
  const cta = useTranslations("CTA");
  const tool = useTranslations("ToolPage");
  const steps = isImage
    ? [how("steps.upload.title"), how("steps.generate.title"), how("steps.download.title")]
    : [how("steps.prompt.title"), how("steps.generate.title"), how("steps.download.title")];

  const benefitCards = [
    { icon: Sparkles, title: features("ai.title"), body: features("ai.description") },
    { icon: Clock3, title: features("realtime.title"), body: features("realtime.description") },
    { icon: Film, title: features("formats.title"), body: features("formats.description") },
  ];

  const featureList = [
    features("textToVideo.description"),
    features("imageToVideo.description"),
    features("secure.description"),
    features("fast.description"),
    features("formats.description"),
  ];

  return (
    <div className={cn("border-t border-slate-800 bg-[#030712] text-slate-100", className)}>
      <section className="mx-auto max-w-6xl px-4 py-20 text-center sm:py-24">
        <p className="mb-4 text-sm font-semibold text-blue-400">seedance.co AI Studio</p>
        <h1 className="mx-auto max-w-4xl text-balance text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">{isImage ? navigation("imageToVideo") : navigation("textToVideo")}</h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">{isImage ? features("imageToVideo.description") : features("textToVideo.description")}</p>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="mb-8 text-center"><h2 className="text-3xl font-bold sm:text-4xl">{showcase("title")}</h2><p className="mt-3 text-slate-400">{showcase("description")}</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          {SHOWCASE_MEDIA.toolExamples.map((item, index) => <article key={item.title} className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40"><video src={item.video} muted loop playsInline controls preload="metadata" className="aspect-video w-full object-cover" /><div className="p-4"><h3 className="font-semibold">{tool(`promptExample${(index % 3) + 1}`)}</h3><p className="mt-1 text-sm leading-6 text-slate-400">{tool(`tipsLine${(index % 3) + 1}`)}</p></div></article>)}
        </div>
      </section>

      <section className="border-y border-slate-800 bg-[#070b15]">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div><p className="mb-3 text-sm font-semibold text-violet-400">{how("badge")}</p><h2 className="text-3xl font-bold sm:text-4xl">{how("title")}</h2><p className="mt-4 leading-7 text-slate-400">{how("description")}</p></div>
          <div className="grid gap-3">
            {steps.map((step, index) => <div key={step} className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold">{index + 1}</span><span className="font-medium">{step}</span></div>)}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-24">
        <div className="mb-10 text-center"><h2 className="text-3xl font-bold sm:text-4xl">{features("title")}</h2></div>
        <div className="grid gap-4 md:grid-cols-3">
          {benefitCards.map(({ icon: Icon, title, body }) => <article key={title} className="rounded-xl border border-slate-800 bg-slate-900/40 p-6"><Icon className="h-6 w-6 text-blue-400" /><h3 className="mt-5 text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{body}</p></article>)}
        </div>
        <div className="mt-10 grid gap-2 sm:grid-cols-2">{featureList.map((feature) => <div key={feature} className="flex items-start gap-2 text-sm text-slate-300"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />{feature}</div>)}</div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-24">
        <div className="overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-600/15 via-slate-900 to-violet-600/10 px-6 py-14 text-center sm:px-12">
          <WandSparkles className="mx-auto h-8 w-8 text-blue-400" /><h2 className="mt-5 text-3xl font-bold">{cta("title")}</h2><p className="mx-auto mt-3 max-w-xl text-slate-400">{cta("description")}</p>
          <Link href={`/${locale}/register`} className="mt-7 inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-500">{cta("getStarted")}<ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>
    </div>
  );
}

export default ToolLandingPage;
