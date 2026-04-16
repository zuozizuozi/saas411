"use client";

import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Play, Sparkles, Zap } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { ProviderType } from "@/ai";
import {
  isModelModeSupported,
  type GenerationMode,
} from "@/ai/model-mapping";
import { BlurFade } from "@/components/magicui/blur-fade";
import { cn } from "@/components/ui";
import {
  VideoGeneratorInput,
  type SubmitData,
  DEFAULT_CONFIG,
  DEFAULT_DEFAULTS,
} from "@/components/video-generator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { calculateModelCredits, getAvailableModels } from "@/config/credits";
import { NEW_USER_GIFT } from "@/config/pricing-user";
import { useSigninModal } from "@/hooks/use-signin-modal";
import { authClient } from "@/lib/auth/client";
import { uploadImage } from "@/lib/video-api";
import { videoTaskStorage } from "@/lib/video-task-storage";

const PENDING_PROMPT_KEY = "videofly_pending_prompt";
const PENDING_IMAGE_KEY = "videofly_pending_image";
const NOTIFICATION_ASKED_KEY = "videofly_notification_asked";
const TOOL_PREFILL_KEY = "videofly_tool_prefill";

function normalizeGeneratorMode(mode?: string): GenerationMode {
  if (mode === "image-to-video" || mode === "i2v") {
    return "image-to-video";
  }
  if (mode === "reference-to-video" || mode === "r2v") {
    return "reference-to-video";
  }
  if (mode === "frames-to-video") {
    return "frames-to-video";
  }
  return "text-to-video";
}

interface HeroSectionProps {
  currentProvider?: ProviderType;
}

export function HeroSection({ currentProvider }: HeroSectionProps) {
  const t = useTranslations("Hero");
  const tNotify = useTranslations("Notifications");
  const locale = useLocale();
  const isZh = locale === "zh";
  const router = useRouter();
  const signInModal = useSigninModal();
  const { data: session } = authClient.useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNotifyDialog, setShowNotifyDialog] = useState(false);
  const [pendingSubmitData, setPendingSubmitData] = useState<SubmitData | null>(null);

  const generatorConfig = useMemo(() => {
    const availableModels = getAvailableModels({
      provider: currentProvider,
    });
    const availableIds = new Set(availableModels.map((model) => model.id));
    const providerByModel = new Map(
      availableModels.map((model) => [model.id, currentProvider || model.provider])
    );
    const videoModels = DEFAULT_CONFIG.videoModels ?? [];
    const filteredVideoModels = videoModels.filter((model) => availableIds.has(model.id));
    const filteredVideoModes = (DEFAULT_CONFIG.videoModes ?? [])
      .map((mode) => {
        const normalizedMode = normalizeGeneratorMode(mode.id);
        const supportedModels = (mode.supportedModels ?? []).filter((modelId) => {
          if (!availableIds.has(modelId)) return false;
          const provider = providerByModel.get(modelId);
          if (!provider) return false;
          return isModelModeSupported(modelId, provider, normalizedMode);
        });
        return {
          ...mode,
          supportedModels,
        };
      })
      .filter((mode) => mode.supportedModels.length > 0);

    return {
      ...DEFAULT_CONFIG,
      videoModels: filteredVideoModels,
      videoModes: filteredVideoModes,
    };
  }, [currentProvider]);

  const generatorDefaults = useMemo(() => {
    const preferredModel = (generatorConfig.videoModels ?? [])[0]?.id ?? DEFAULT_DEFAULTS.videoModel;
    return {
      ...DEFAULT_DEFAULTS,
      videoModel: preferredModel,
    };
  }, [generatorConfig.videoModels]);

  const defaultDuration = useMemo(() => {
    const rawDuration = generatorDefaults.duration ?? generatorConfig.durations?.[0];
    if (!rawDuration) return 10;
    const parsed = Number.parseInt(String(rawDuration), 10);
    return Number.isNaN(parsed) ? 10 : parsed;
  }, [generatorDefaults.duration, generatorConfig.durations]);

  const parseDuration = (duration?: string | number) => {
    if (typeof duration === "number") return duration;
    if (!duration) return undefined;
    const parsed = Number.parseInt(duration, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  };

  const calculateCredits = useCallback((params: {
    type: "video" | "image";
    model: string;
    outputNumber: number;
    duration?: string;
    resolution?: string;
  }) => {
    if (params.type !== "video") return 0;
    const parsedDuration = parseDuration(params.duration) ?? defaultDuration;
    const baseCredits = calculateModelCredits(params.model, {
      duration: parsedDuration,
      quality: params.resolution,
    });
    return baseCredits * params.outputNumber;
  }, [defaultDuration, parseDuration]);

  const resolveImageUrls = async (data: SubmitData) => {
    if (data.images && data.images.length > 0) {
      return Promise.all(data.images.map((file) => uploadImage(file)));
    }
    return data.imageUrls;
  };

  const getToolRouteByMode = (mode: string) => {
    const normalized = normalizeGeneratorMode(mode);
    if (normalized === "image-to-video") {
      return "image-to-video";
    }
    if (normalized === "reference-to-video") {
      return "reference-to-video";
    }
    return "text-to-video";
  };

  const processSubmission = async (data: SubmitData) => {
    setIsSubmitting(true);
    try {
      const normalizedMode = normalizeGeneratorMode(data.mode);
      const hasImages = (data.images && data.images.length > 0) || (data.imageUrls && data.imageUrls.length > 0);
      const resolvedImageUrls = hasImages ? await resolveImageUrls(data) : undefined;
      const response = await fetch("/api/v1/video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: data.prompt,
          model: data.model,
          mode: normalizedMode,
          duration: parseDuration(data.duration),
          aspectRatio: data.aspectRatio,
          quality: data.quality ?? data.resolution,
          outputNumber: data.outputNumber,
          generateAudio: data.generateAudio,
          imageUrls: resolvedImageUrls,
          imageUrl: resolvedImageUrls?.[0],
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error?.error?.message || error?.message || "Failed to generate video"
        );
      }

      const result = await response.json();
      const toolRoute = getToolRouteByMode(normalizedMode);
      toast.success("Generation started");
      try {
        if (typeof window !== "undefined") {
          sessionStorage.setItem(
            TOOL_PREFILL_KEY,
            JSON.stringify({
              prompt: data.prompt,
              model: data.model,
              mode: normalizedMode,
              duration: parseDuration(data.duration),
              aspectRatio: data.aspectRatio,
              quality: data.quality ?? data.resolution,
              imageUrl: resolvedImageUrls?.[0],
            })
          );
        }
      } catch (storageError) {
        console.warn("Failed to store tool prefill data:", storageError);
      }
      if (session?.user?.id) {
        videoTaskStorage.addTask({
          userId: session.user.id,
          videoId: result.data.videoUuid,
          taskId: result.data.taskId,
          prompt: data.prompt,
          model: data.model,
          mode: normalizedMode,
          status: "generating",
          createdAt: Date.now(),
          notified: false,
        });
      }
      router.push(`/${locale}/${toolRoute}?id=${result.data.videoUuid}`);
    } catch (error) {
      console.error("Generation error:", error);
      const message = error instanceof Error ? error.message : "Failed to generate video. Please try again.";
      if (message.includes("credits") || message.includes("Credit")) {
        toast.error("Insufficient credits. Please top up and try again.");
      } else if (message.includes("database") || message.includes("DATABASE_URL")) {
        toast.error("Service temporarily unavailable. Please try again later.");
      } else {
        toast.error(message || "Failed to generate video. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
      setPendingSubmitData(null);
    }
  };

  const handleAllowNotify = () => {
    setShowNotifyDialog(false);
    Notification.requestPermission().then(() => {
      localStorage.setItem(NOTIFICATION_ASKED_KEY, "1");
      if (pendingSubmitData) {
        processSubmission(pendingSubmitData);
      }
    });
  };

  const handleSkipNotify = () => {
    setShowNotifyDialog(false);
    localStorage.setItem(NOTIFICATION_ASKED_KEY, "1");
    if (pendingSubmitData) {
      processSubmission(pendingSubmitData);
    }
  };

  const handleSubmit = async (data: SubmitData) => {
    let activeUser = session?.user ?? null;
    if (!activeUser) {
      try {
        const fresh = await authClient.getSession();
        activeUser = fresh?.data?.user ?? null;
      } catch (error) {
        console.warn("Failed to refresh session:", error);
      }
    }

    if (!activeUser) {
      try {
        sessionStorage.setItem(PENDING_PROMPT_KEY, data.prompt);
        if (data.images?.[0]) {
          const reader = new FileReader();
          reader.onloadend = () => {
            sessionStorage.setItem(PENDING_IMAGE_KEY, reader.result as string);
          };
          reader.readAsDataURL(data.images[0]);
        }
      } catch (error) {
        console.warn("Failed to store pending input:", error);
      }
      signInModal.onOpen();
      return;
    }

    if (typeof window !== "undefined" && "Notification" in window) {
      const asked = localStorage.getItem(NOTIFICATION_ASKED_KEY);
      if (!asked && Notification.permission === "default") {
        setPendingSubmitData(data);
        setShowNotifyDialog(true);
        return;
      }
    }

    processSubmission(data);
  };

  const heroStats = [
    {
      value: "Text + Image",
      label: isZh ? "双输入工作流" : "Input workflow",
    },
    {
      value: "16:9 / 9:16",
      label: isZh ? "常用比例" : "Aspect ratios",
    },
    {
      value: "Multi-model",
      label: isZh ? "统一模型入口" : "Model routing",
    },
    {
      value: "Async Tasks",
      label: isZh ? "生成与回看" : "Task lifecycle",
    },
  ];

  return (
    <section id="generator" className="relative overflow-hidden pb-24 pt-6 sm:pb-28">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-22rem] h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-primary/14 blur-[150px]" />
        <div className="absolute left-[12%] top-[28%] h-40 w-40 rounded-full bg-sky-500/8 blur-[120px]" />
        <div className="absolute right-[10%] top-[22%] h-44 w-44 rounded-full bg-fuchsia-500/10 blur-[125px]" />
        <div
          className="absolute inset-0 opacity-[0.14] mix-blend-soft-light"
          style={{
            backgroundImage: "url('/images/noise.webp')",
            backgroundSize: "180px 180px",
          }}
        />
      </div>

      <div className="container mx-auto flex min-h-[calc(100vh-7rem)] max-w-7xl flex-col justify-center px-4 pb-8 pt-8 md:pt-12">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-10 text-center md:gap-12">
          <motion.div
            initial={{ opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="max-w-4xl space-y-7"
          >
            <BlurFade delay={0.05} inView>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/78 backdrop-blur-xl">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>{t("badge")}</span>
              </div>
            </BlurFade>

            <BlurFade delay={0.1} inView>
              <h1 className="text-balance font-heading text-5xl font-semibold tracking-[-0.04em] text-white md:text-6xl lg:text-7xl">
                {t("title")}
              </h1>
            </BlurFade>

            <BlurFade delay={0.2} inView>
              <p className="mx-auto max-w-3xl text-balance text-lg leading-8 text-muted-foreground md:text-xl">
                {t("description")}
              </p>
            </BlurFade>

            <BlurFade delay={0.3} inView className="flex flex-wrap justify-center gap-3">
              {[
                { icon: Zap, label: t("features.fast"), color: "text-amber-400" },
                { icon: Play, label: t("features.easy"), color: "text-sky-400" },
                { icon: Sparkles, label: t("features.ai"), color: "text-primary" },
              ].map((feature, idx) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={feature.label}
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.36 + idx * 0.08 }}
                    className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-4 py-2 text-sm font-medium text-white/82 backdrop-blur-xl"
                  >
                    <Icon className={cn("h-4 w-4", feature.color)} />
                    <span>{feature.label}</span>
                  </motion.div>
                );
              })}
            </BlurFade>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.28, ease: "easeOut" }}
            className="relative w-full"
          >
            <div className="absolute inset-x-10 -top-10 h-28 rounded-full bg-primary/14 blur-[100px]" />
            <div className="absolute inset-x-0 bottom-6 h-16 rounded-full bg-fuchsia-500/8 blur-[90px]" />
            <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-black/35 p-4 shadow-[0_30px_100px_rgba(0,0,0,0.48)] backdrop-blur-2xl sm:p-5">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0))]" />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

              {generatorConfig.videoModels.length > 0 ? (
                <VideoGeneratorInput
                  className="max-w-none"
                  config={generatorConfig}
                  defaults={generatorDefaults}
                  isLoading={isSubmitting}
                  disabled={isSubmitting}
                  calculateCredits={calculateCredits}
                  onSubmit={handleSubmit}
                />
              ) : (
                <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-center text-sm text-muted-foreground">
                  No enabled models are available for the current AI provider configuration.
                </div>
              )}
            </div>

            {NEW_USER_GIFT.enabled && NEW_USER_GIFT.credits > 0 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="mt-4 text-center text-xs text-muted-foreground"
              >
                {t("creditsHint", { credits: NEW_USER_GIFT.credits })}
              </motion.p>
            )}

            <div className="mt-8 grid gap-3 border-t border-white/10 pt-6 sm:grid-cols-2 xl:grid-cols-4">
              {heroStats.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-left"
                >
                  <div className="text-sm font-semibold uppercase tracking-[0.18em] text-white/92">
                    {item.value}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      <AlertDialog open={showNotifyDialog} onOpenChange={setShowNotifyDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tNotify("enableNotifications")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tNotify("notificationDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleSkipNotify}>{tNotify("maybeLater")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleAllowNotify}>{tNotify("allow")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
