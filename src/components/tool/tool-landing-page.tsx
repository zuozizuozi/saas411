"use client";

import { ArrowRight, Check, Clock3, Film, Sparkles, WandSparkles } from "lucide-react";
import Link from "next/link";

import { cn } from "@/components/ui";
import { SHOWCASE_MEDIA } from "@/config/showcase-media";
import type { ToolPageConfig } from "@/config/tool-pages";

export interface ToolLandingPageProps { config: ToolPageConfig; locale?: string; className?: string }

export function ToolLandingPage({ config, locale = "en", className }: ToolLandingPageProps) {
  const isZh = locale === "zh";
  const isImage = config.generator.mode === "image-to-video";
  const steps = isImage
    ? [isZh ? "上传首帧，可选添加尾帧" : "Upload a first frame and optional end frame", isZh ? "描述希望出现的动作" : "Describe the motion you want", isZh ? "选择模型并生成视频" : "Choose a model and generate"]
    : [isZh ? "写下你的画面描述" : "Write your scene description", isZh ? "选择比例、时长和清晰度" : "Choose ratio, duration and resolution", isZh ? "生成、预览并下载" : "Generate, preview and download"];

  return (
    <div className={cn("border-t border-slate-800 bg-[#030712] text-slate-100", className)}>
      <section className="mx-auto max-w-6xl px-4 py-20 text-center sm:py-24">
        <p className="mb-4 text-sm font-semibold text-blue-400">seedance.co AI Studio</p>
        <h1 className="mx-auto max-w-4xl text-balance text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">{config.landing.hero.title}</h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">{config.landing.hero.description}</p>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="mb-8 text-center"><h2 className="text-3xl font-bold sm:text-4xl">{isZh ? "把灵感变成电影级画面" : "Turn ideas into cinematic motion"}</h2><p className="mt-3 text-slate-400">{isZh ? "从真实示例中了解提示词、构图与运动效果" : "Explore real prompt, composition and motion patterns"}</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          {SHOWCASE_MEDIA.toolExamples.map((item) => <article key={item.title} className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40"><video src={item.video} muted loop playsInline controls preload="metadata" className="aspect-video w-full object-cover" /><div className="p-4"><h3 className="font-semibold">{item.title}</h3><p className="mt-1 text-sm leading-6 text-slate-400">{item.prompt}</p></div></article>)}
        </div>
      </section>

      <section className="border-y border-slate-800 bg-[#070b15]">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div><p className="mb-3 text-sm font-semibold text-violet-400">{isZh ? "创作流程" : "Creative workflow"}</p><h2 className="text-3xl font-bold sm:text-4xl">{isZh ? "无需学习复杂的剪辑工具" : "No complicated editing workflow"}</h2><p className="mt-4 leading-7 text-slate-400">{isZh ? "统一的模型入口、清晰的积分预估和异步任务，让每一次生成都可追踪。" : "One model gateway, transparent credit estimates and traceable asynchronous tasks."}</p></div>
          <div className="grid gap-3">
            {steps.map((step, index) => <div key={step} className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold">{index + 1}</span><span className="font-medium">{step}</span></div>)}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-24">
        <div className="mb-10 text-center"><h2 className="text-3xl font-bold sm:text-4xl">{isZh ? "为生产工作流准备" : "Built for production workflows"}</h2></div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: Sparkles, title: isZh ? "多模型统一入口" : "One multi-model gateway", body: isZh ? "模型可插拔，切换供应商不改页面。" : "Swap providers without rebuilding the product UI." },
            { icon: Clock3, title: isZh ? "异步任务可追踪" : "Traceable async tasks", body: isZh ? "生成进度、重试与历史记录都在同一处。" : "Progress, retries and history stay in one place." },
            { icon: Film, title: isZh ? "视频优先体验" : "Video-first experience", body: isZh ? "从首屏到示例都直接展示动态效果。" : "Motion is visible from the first screen to every example." },
          ].map(({ icon: Icon, title, body }) => <article key={title} className="rounded-xl border border-slate-800 bg-slate-900/40 p-6"><Icon className="h-6 w-6 text-blue-400" /><h3 className="mt-5 text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{body}</p></article>)}
        </div>
        <div className="mt-10 grid gap-2 sm:grid-cols-2">{config.landing.features.map((feature) => <div key={feature} className="flex items-start gap-2 text-sm text-slate-300"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />{feature}</div>)}</div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-24">
        <div className="overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-600/15 via-slate-900 to-violet-600/10 px-6 py-14 text-center sm:px-12">
          <WandSparkles className="mx-auto h-8 w-8 text-blue-400" /><h2 className="mt-5 text-3xl font-bold">{isZh ? "开始创作你的下一条视频" : "Create your next video"}</h2><p className="mx-auto mt-3 max-w-xl text-slate-400">{config.landing.hero.ctaSubtext}</p>
          <Link href={`/${locale}/register`} className="mt-7 inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-500">{config.landing.hero.ctaText}<ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>
    </div>
  );
}

export default ToolLandingPage;
