"use client";

import { motion } from "framer-motion";
import { useLocale } from "next-intl";
import { Download, ImagePlus, SlidersHorizontal, Type } from "lucide-react";

const icons = [Type, ImagePlus, SlidersHorizontal, Download];

export function HowItWorks() {
  const locale = useLocale();
  const isZh = locale === "zh";

  const steps = [
    {
      step: "01",
      title: isZh ? "输入视频想法" : "Describe the scene",
      description: isZh
        ? "写下主体、动作、镜头、光线和氛围，让首页工作台直接成为真实生成入口。"
        : "Start with the subject, action, camera, and lighting so the homepage doubles as a real generation workspace.",
    },
    {
      step: "02",
      title: isZh ? "添加参考素材" : "Add reference media",
      description: isZh
        ? "需要时上传图片或关键视觉，帮助模型锁定风格、主体和运动方向。"
        : "Upload an image when you need tighter control over style, subject identity, or movement direction.",
    },
    {
      step: "03",
      title: isZh ? "选择模型与参数" : "Pick model and settings",
      description: isZh
        ? "在一个面板里处理模型、比例、时长与分辨率，减少跳转和理解成本。"
        : "Keep model, ratio, duration, and quality in one clear panel so users can decide fast and confidently.",
    },
    {
      step: "04",
      title: isZh ? "生成、查看与下载" : "Generate, review, download",
      description: isZh
        ? "任务发起后继续走你现有的鉴权、积分、任务状态和回调链路，结果页也保持闭环。"
        : "Generation continues through your existing auth, credits, task tracking, and callback flow until the result is ready.",
    },
  ];

  return (
    <section className="relative py-24 md:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white/65">
            {isZh ? "工作流程" : "Workflow"}
          </span>
          <h2 className="mt-6 text-balance text-4xl font-semibold tracking-[-0.03em] text-white md:text-5xl">
            {isZh ? "从第一句提示词，到最终视频交付" : "From first prompt to finished video"}
          </h2>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">
            {isZh
              ? "对标站点最有说服力的地方，在于流程清楚、入口直接、付费路径自然，而不是把功能藏得很深。"
              : "The best competitor flows feel direct: users understand the product fast, start fast, and see where pricing fits."}
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
                {isZh ? "适合视频 SaaS 的落地页结构" : "Landing page logic"}
              </p>
              <h3 className="mt-3 text-2xl font-semibold text-white md:text-3xl">
                {isZh ? "先讲输入与结果，再讲能力与定价，转化路径会自然很多" : "Lead with input and output, then explain capabilities and pricing"}
              </h3>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-sm leading-7 text-muted-foreground md:max-w-sm">
              {isZh
                ? "这次保留你已有的鉴权、支付、积分和 provider 接法，只把前端营销结构调整到更接近成熟竞品的状态。"
                : "This pass keeps auth, billing, credits, and provider plumbing intact while moving the frontend closer to a polished competitor layout."}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
