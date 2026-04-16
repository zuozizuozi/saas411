"use client";

import { motion } from "framer-motion";
import { useLocale } from "next-intl";
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
  const locale = useLocale();
  const isZh = locale === "zh";

  const primaryCards = [
    {
      title: isZh ? "文本生成视频" : "Text to video",
      description: isZh
        ? "一句提示词即可生成营销短片、产品演示、故事镜头和社媒素材，适合快速起稿与成片验证。"
        : "Turn a prompt into a launch clip, ad concept, demo scene, or social asset in one generation flow.",
      points: isZh
        ? ["适合营销与产品演示", "支持常见横竖比例", "适合快速出首版"]
        : ["Built for product, marketing, and social video", "Common landscape and portrait formats", "Fast first-pass generation"],
    },
    {
      title: isZh ? "图片生成视频" : "Image to video",
      description: isZh
        ? "上传产品图、角色图或关键视觉，补上镜头运动、节奏与动态细节，让静态素材直接进入视频工作流。"
        : "Animate product shots, character art, or campaign key visuals with motion, pacing, and camera energy.",
      points: isZh
        ? ["适合海报转视频", "适合商品与角色演示", "保留主体一致性"]
        : ["Ideal for poster-to-video workflows", "Useful for commerce and character shots", "Keeps the main subject consistent"],
    },
    {
      title: isZh ? "多模型统一工作台" : "Unified model workbench",
      description: isZh
        ? "在同一个入口下切换模型、时长、比例与清晰度，不改你现有的鉴权、积分、任务与回调链路。"
        : "Switch models, duration, ratios, and quality from one workbench without changing your auth, credit, or task pipeline.",
      points: isZh
        ? ["保持现有后端逻辑", "统一任务与积分系统", "便于后续继续接新模型"]
        : ["Preserves your current backend flow", "One task and credit system", "Easy to expand with new providers"],
    },
  ];

  const secondaryCards = [
    {
      title: isZh ? "完整生成链路" : "Full generation flow",
      description: isZh
        ? "从输入、提交、排队、回调到结果查看，用户能清楚知道任务在哪里、下一步做什么。"
        : "Users can see the path from input to queue, callback, and final result without losing context.",
    },
    {
      title: isZh ? "信用与任务安全" : "Safe credits and tasks",
      description: isZh
        ? "保留你已有的积分冻结、结算、失败回滚和历史记录，不为了改首页而动核心交易逻辑。"
        : "Your freeze, settle, refund, and history flows stay intact while the marketing surface gets upgraded.",
    },
    {
      title: isZh ? "适合继续扩展" : "Ready for next-stage growth",
      description: isZh
        ? "后续可继续加模板库、案例页、模型专题页和视频背景，不需要再推翻这套落地页结构。"
        : "You can layer in templates, model pages, examples, and video backgrounds later without rebuilding the layout.",
    },
  ];

  return (
    <section id="features" className="relative py-24 md:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white/65">
            {isZh ? "核心能力" : "Capabilities"}
          </span>
          <h2 className="mt-6 text-balance text-4xl font-semibold tracking-[-0.03em] text-white md:text-5xl">
            {isZh ? "一套首页，把视频生成产品最关键的能力讲清楚" : "Everything users need to understand before they start generating"}
          </h2>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">
            {isZh
              ? "竞品首页真正有效的地方，不是堆特效，而是让用户立刻知道能做什么、怎么做、值不值得付费。"
              : "The strongest AI video homepages explain output, workflow, and value quickly instead of relying on decoration."}
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
