"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Play, Sparkles } from "lucide-react";

const samples = [
  {
    image: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1200&q=80",
    feature: "textToVideo",
    prompt: "promptExample1",
    detail: "tipsLine1",
  },
  {
    image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&q=80",
    feature: "imageToVideo",
    prompt: "promptExample2",
    detail: "tipsLine2",
  },
  {
    image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&q=80",
    feature: "enhancement",
    prompt: "promptExample3",
    detail: "tipsLine3",
  },
];

export function ShowcaseSection() {
  const t = useTranslations("Showcase");
  const features = useTranslations("Features");
  const tool = useTranslations("ToolPage");

  return (
    <section className="relative py-24 md:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white/65">
            {t("badge")}
          </span>
          <h2 className="mt-6 text-balance text-4xl font-semibold tracking-[-0.03em] text-white md:text-5xl">
            {t("title")}
          </h2>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">
            {t("description")}
          </p>
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {samples.map((sample, index) => (
            <motion.article
              key={sample.prompt}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08, duration: 0.45 }}
              className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,28,0.96),rgba(11,11,17,0.96))] shadow-[0_24px_80px_rgba(0,0,0,0.34)]"
            >
              <div className="group relative aspect-video overflow-hidden">
                <img
                  src={sample.image}
                  alt={tool(sample.prompt)}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-xs font-medium text-white/82 backdrop-blur-lg">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  {features(`${sample.feature}.title`)}
                </div>
                <div className="absolute bottom-4 right-4 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white backdrop-blur-lg">
                  <Play className="ml-0.5 h-4 w-4" />
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-semibold text-white">
                  {tool(sample.prompt)}
                </h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  {tool(sample.detail)}
                </p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
