"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  Clapperboard,
  ImagePlay,
  Layers3,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";

const primaryIcons = [Clapperboard, ImagePlay, Layers3];
const secondaryIcons = [Workflow, ShieldCheck, Sparkles];

export function FeaturesSection() {
  const t = useTranslations("Features");

  const primaryCards = [
    {
      title: t("textToVideo.title"),
      description: t("textToVideo.description"),
      points: [t("formats.description"), t("fast.description"), t("realtime.description")],
    },
    {
      title: t("imageToVideo.title"),
      description: t("imageToVideo.description"),
      points: [t("secure.description"), t("formats.description"), t("realtime.description")],
    },
    {
      title: t("referenceGen.title"),
      description: t("referenceGen.description"),
      points: [t("ai.description"), t("secure.description"), t("formats.description")],
    },
  ];

  const secondaryCards = [
    {
      title: t("realtime.title"),
      description: t("realtime.description"),
    },
    {
      title: t("secure.title"),
      description: t("secure.description"),
    },
    {
      title: t("enhancement.title"),
      description: t("enhancement.description"),
    },
  ];

  return (
    <section id="features" className="relative py-24 md:py-28">
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
          {primaryCards.map((card, index) => {
            const Icon = primaryIcons[index];
            return (
              <motion.article
                key={card.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08, duration: 0.45 }}
                className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(23,23,31,0.96),rgba(12,12,18,0.96))] p-7 shadow-[0_22px_70px_rgba(0,0,0,0.34)]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-2xl font-semibold text-white">{card.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{card.description}</p>
                <ul className="mt-6 space-y-3">
                  {card.points.map((point) => (
                    <li key={point} className="flex items-center gap-3 text-sm text-white/84">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      {point}
                    </li>
                  ))}
                </ul>
              </motion.article>
            );
          })}
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {secondaryCards.map((card, index) => {
            const Icon = secondaryIcons[index];
            return (
              <motion.article
                key={card.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.18 + index * 0.08, duration: 0.45 }}
                className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h4 className="text-lg font-medium text-white">{card.title}</h4>
                </div>
                <p className="mt-4 text-sm leading-7 text-muted-foreground">{card.description}</p>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
