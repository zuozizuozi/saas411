"use client";

import { Play } from "lucide-react";
import { SHOWCASE_MEDIA } from "@/config/showcase-media";

export function ToolExamplesPanel({ locale = "en" }: { locale?: string }) {
  const isZh = locale === "zh";
  return (
    <section className="min-h-[560px] rounded-xl border border-slate-800 bg-[#080d18] p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <div><h2 className="text-lg font-bold text-white">{isZh ? "探索示例" : "Explore examples"}</h2><p className="mt-1 text-xs text-slate-500">{isZh ? "选择示例，快速获得创作灵感" : "Discover prompts and visual directions"}</p></div>
        <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-400">AI Video</span>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        {SHOWCASE_MEDIA.toolExamples.map((item, index) => (
          <article key={item.title} className={index === 0 ? "col-span-2 xl:col-span-2" : ""}>
            <div className="group relative aspect-video overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
              <video src={item.video} muted loop playsInline preload="metadata" onMouseEnter={(event) => void event.currentTarget.play()} onMouseLeave={(event) => { event.currentTarget.pause(); event.currentTarget.currentTime = 0; }} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
              <span className="absolute bottom-2 left-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-slate-950"><Play className="h-3.5 w-3.5 fill-current" /></span>
            </div>
            <h3 className="mt-2 text-sm font-medium text-slate-200">{item.title}</h3>
            <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{item.prompt}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
