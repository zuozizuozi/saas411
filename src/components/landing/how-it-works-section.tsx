"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Download, ImagePlus, SlidersHorizontal, Type } from "lucide-react";

const icons = [Type, ImagePlus, SlidersHorizontal, Download];

export function HowItWorks() {
  const t = useTranslations("HowItWorks");

  const steps = [
    {
      step: "01",
      title: t("steps.prompt.title"),
      description: t("steps.prompt.description"),
    },
    {
      step: "02",
      title: t("steps.upload.title"),
      description: t("steps.upload.description"),
    },
    {
      step: "03",
      title: t("steps.generate.title"),
      description: t("steps.generate.description"),
    },
    {
      step: "04",
      title: t("steps.download.title"),
      description: t("steps.download.description"),
    },
  ];

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

        <div className="mt-14 grid gap-5 lg:grid-cols-4">
          {steps.map((item, index) => {
            const Icon = icons[index];
            return (
              <motion.article
                key={item.step}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08, duration: 0.45 }}
                className="rounded-[26px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold tracking-[0.24em] text-white/45">{item.step}</span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <h3 className="mt-8 text-xl font-semibold text-white">{item.title}</h3>
                <p className="mt-4 text-sm leading-7 text-muted-foreground">{item.description}</p>
              </motion.article>
            );
          })}
        </div>

        <div className="mt-10 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,17,24,0.92),rgba(10,10,16,0.96))] p-8 md:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.22em] text-white/45">
                {t("subtitle")}
              </p>
              <h3 className="mt-3 text-2xl font-semibold text-white md:text-3xl">
                {t("bottomHint")}
              </h3>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-sm leading-7 text-muted-foreground md:max-w-sm">
              {t("bottomHint")}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
