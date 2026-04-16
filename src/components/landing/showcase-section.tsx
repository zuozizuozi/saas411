"use client";

import { motion } from "framer-motion";
import { useLocale } from "next-intl";
import { Play, Sparkles } from "lucide-react";

const samples = [
  {
    image: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1200&q=80",
    labelEn: "Product launch",
    labelZh: "产品发布",
    titleEn: "Cinematic product hero clip",
    titleZh: "电影感产品主视觉短片",
    detailEn: "5s · 16:9 · motion-led reveal",
    detailZh: "5 秒 · 16:9 · 强调镜头运动",
  },
  {
    image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&q=80",
    labelEn: "Documentary",
    labelZh: "纪录片",
    titleEn: "Nature story with controlled movement",
    titleZh: "自然场景叙事与稳定运动",
    detailEn: "10s · image-guided motion",
    detailZh: "10 秒 · 图片驱动运动",
  },
  {
    image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&q=80",
    labelEn: "SaaS explainer",
    labelZh: "SaaS 讲解",
    titleEn: "Dashboard-to-story visual sequence",
    titleZh: "从界面到叙事的视频序列",
    detailEn: "ad creative · branded workflow",
    detailZh: "广告创意 · 品牌化流程",
  },
];

export function ShowcaseSection() {
  const locale = useLocale();
  const isZh = locale === "zh";

  return (
    <section className="relative py-24 md:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white/65">
            {isZh ? "示例展示" : "Showcase"}
          </span>
          <h2 className="mt-6 text-balance text-4xl font-semibold tracking-[-0.03em] text-white md:text-5xl">
            {isZh ? "让用户一眼看到能生成什么" : "Show the kinds of videos users can actually make"}
          </h2>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">
            {isZh
              ? "竞品首页普遍会放样例结果，因为这是让用户建立预期最快的方式。"
              : "Strong competitor homepages place example outputs early because it is the fastest way to set user expectations."}
          </p>
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {samples.map((sample, index) => (
            <motion.article
              key={sample.titleEn}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08, duration: 0.45 }}
              className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,28,0.96),rgba(11,11,17,0.96))] shadow-[0_24px_80px_rgba(0,0,0,0.34)]"
            >
              <div className="group relative aspect-video overflow-hidden">
                <img
                  src={sample.image}
                  alt={isZh ? sample.titleZh : sample.titleEn}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-xs font-medium text-white/82 backdrop-blur-lg">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  {isZh ? sample.labelZh : sample.labelEn}
                </div>
                <div className="absolute bottom-4 right-4 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white backdrop-blur-lg">
                  <Play className="ml-0.5 h-4 w-4" />
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-semibold text-white">
                  {isZh ? sample.titleZh : sample.titleEn}
                </h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  {isZh ? sample.detailZh : sample.detailEn}
                </p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
