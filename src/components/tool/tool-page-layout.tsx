/**
 * Tool Page Layout Component
 *
 * 工具页面统一布局组件
 *
 * 根据工具页面配置动态渲染：
 * - 左侧：生成器面板
 * - 右侧：落地页（未登录）或结果面板（已登录）
 *
 * SEO 友好，支持服务端渲染
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth/client";
import { useCredits } from "@/stores/credits-store";
import { useVideoPolling } from "@/hooks/use-video-polling";
import { useNotificationDeduplication } from "@/hooks/use-notification-deduplication";
import { videoTaskStorage } from "@/lib/video-task-storage";
import { videoHistoryStorage, type VideoHistoryItem } from "@/lib/video-history-storage";
import { useUpgradeModal } from "@/hooks/use-upgrade-modal";
import { UpgradeModal } from "@/components/upgrade/upgrade-modal";
import { siteConfig } from "@/config/site";
import type { Video } from "@/db";
import type { ToolPageConfig } from "@/config/tool-pages";
import { GeneratorPanel, type GeneratorData } from "@/components/tool/generator-panel";
import { ToolExamplesPanel } from "@/components/tool/tool-examples-panel";
import { uploadImage } from "@/lib/video-api";
import { ToolLandingPage } from "@/components/tool/tool-landing-page";
import { VideoHistoryPanel } from "@/components/tool/video-history-panel";
import { toast } from "sonner";
import { getLowCreditState } from "@/config/low-credit";

const TOOL_PREFILL_KEY = "videofly_tool_prefill";
const LOW_CREDIT_NOTICE_KEY = "seedance_low_credit_notice_at";
const LOW_CREDIT_NOTICE_INTERVAL = 24 * 60 * 60 * 1000;

// ============================================================================
// Types
// ============================================================================

export interface ToolPageLayoutProps {
  /**
   * 工具页面配置
   */
  config: ToolPageConfig;

  /**
   * 工具路由（用于 SEO 和导航）
   */
  toolRoute: string;

  /**
   * 当前语言
   */
  locale: string;
}

// ============================================================================
// ToolPageLayout Component
// ============================================================================

/**
 * ToolPageLayout - 工具页面布局
 *
 * 处理：
 * - 用户登录状态检测
 * - 视频生成流程
 * - 积分检查
 * - 左右面板布局切换
 *
 * @example
 * ```tsx
 * import { getToolPageConfig } from "@/config/tool-pages";
 *
 * export default function ImageToVideoPage({ params }) {
 *   const config = getToolPageConfig("image-to-video");
 *   return <ToolPageLayout config={config} locale={params.locale} toolRoute="image-to-video" />;
 * }
 * ```
 */
export function ToolPageLayout({
  config,
  toolRoute,
  locale,
}: ToolPageLayoutProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { balance, optimisticFreeze, optimisticRelease, invalidate } = useCredits();
  const { openModal } = useUpgradeModal();
  const { shouldNotify, markNotified, resetNotification } = useNotificationDeduplication();
  const videoIdFromQuery = searchParams.get("id");
  const NOTIFICATION_ASKED_KEY = "videofly_notification_asked";
  const tNotify = useTranslations("Notifications");
  const tTool = useTranslations("ToolPage");
  const tHistory = useTranslations("VideoHistory");
  const tCommon = useTranslations("Common");

  // 状态
  const [user, setUser] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentVideos, setCurrentVideos] = useState<Video[]>([]);
  const [generatingIds, setGeneratingIds] = useState<string[]>([]);
  const [historyItems, setHistoryItems] = useState<VideoHistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<"generator" | "result">("generator");
  const historySyncUserRef = useRef<string | null>(null);
  const [prefillData, setPrefillData] = useState<{
    prompt?: string;
    model?: string;
    duration?: number;
    aspectRatio?: string;
    quality?: string;
    imageUrl?: string;
  } | null>(null);

  const addGeneratingId = useCallback((videoId: string) => {
    setGeneratingIds((prev) => (prev.includes(videoId) ? prev : [videoId, ...prev]));
  }, []);

  const removeGeneratingId = useCallback((videoId: string) => {
    setGeneratingIds((prev) => prev.filter((id) => id !== videoId));
  }, []);

  const handleCompleted = useCallback(
    (video: Video) => {
      // 更新历史记录
      videoHistoryStorage.updateHistory(
        video.uuid,
        {
          status: "completed",
          videoUrl: video.videoUrl || undefined,
          thumbnailUrl: video.thumbnailUrl || undefined,
          duration: video.duration || undefined,
        },
        user?.id
      );
      setHistoryItems(videoHistoryStorage.getHistory(user?.id));

      // 更新 currentVideos（兼容旧逻辑）
      setCurrentVideos((prev) => {
        const exists = prev.find((v) => v.uuid === video.uuid);
        if (exists) {
          return prev.map((v) => (v.uuid === video.uuid ? video : v));
        }
        return [video, ...prev];
      });
      removeGeneratingId(video.uuid);
      // 刷新积分（生成成功，积分已结算）
      invalidate();
      if (user?.id) {
        videoTaskStorage.updateTask(
          video.uuid,
          { status: "completed" },
          user.id
        );
      }

      // 通知去重：确保只有一个标签页显示通知
      if (!shouldNotify(video.uuid)) {
        return;
      }

      // 准备提示词（截断过长的提示词）
      const promptPreview = video.prompt?.length > 50
        ? `${video.prompt.slice(0, 50)}...`
        : video.prompt || "";

      // 显示通知（浏览器通知或 toast）
      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "granted") {
          try {
            new Notification(
              tNotify("videoReadyTitle", { siteName: siteConfig.name }),
              {
                body: tNotify("videoReadyBody", { prompt: promptPreview }),
              }
            );
          } catch (error) {
            console.warn("Notification dispatch failed:", error);
            toast.success(
              tNotify("videoReadyTitle", { siteName: siteConfig.name }),
              {
                description: tNotify("videoReadyBody", { prompt: promptPreview }),
              }
            );
          }
        } else {
          toast.success(
            tNotify("videoReadyTitle", { siteName: siteConfig.name }),
            {
              description: promptPreview
                ? tNotify("videoReadyBody", { prompt: promptPreview })
                : tNotify("videoReadyBodyShort"),
            }
          );
        }
      } else {
        toast.success(
          tNotify("videoReadyTitle", { siteName: siteConfig.name }),
          {
            description: promptPreview
              ? tNotify("videoReadyBody", { prompt: promptPreview })
              : tNotify("videoReadyBodyShort"),
          }
        );
      }

      // 标记为已通知，防止其他标签页重复通知
      markNotified(video.uuid);
    },
    [removeGeneratingId, user?.id, invalidate, tNotify, shouldNotify, markNotified]
  );

  const handleFailed = useCallback(
    ({ videoId, error }: { videoId: string; error?: string }) => {
      // 更新历史记录
      videoHistoryStorage.updateHistory(
        videoId,
        {
          status: "failed",
        },
        user?.id
      );
      setHistoryItems(videoHistoryStorage.getHistory(user?.id));

      // 移除生成 ID
      removeGeneratingId(videoId);
      // 刷新积分（生成失败，积分已释放）
      invalidate();
      if (user?.id) {
        videoTaskStorage.updateTask(
          videoId,
          { status: "failed" },
          user.id
        );
      }
      const notificationKey = `${videoId}:failed`;
      if (shouldNotify(notificationKey)) {
        const message = error || tHistory("generationFailed");
        toast.error(message);
        markNotified(notificationKey);
      }
    },
    [removeGeneratingId, user?.id, invalidate, shouldNotify, markNotified, tHistory]
  );

  const { startPolling, stopPolling, isPolling } = useVideoPolling({
    maxConsecutiveErrors: 3,
    maxBackoffMs: 60000,
    onCompleted: handleCompleted,
    onFailed: handleFailed,
  });

  // 检查登录状态
  useEffect(() => {
    authClient.getSession().then((session) => {
      setUser(session?.data?.user ?? null);
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(TOOL_PREFILL_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setPrefillData({
        prompt: parsed?.prompt,
        model: parsed?.model,
        duration: parsed?.duration,
        aspectRatio: parsed?.aspectRatio,
        quality: parsed?.quality,
        imageUrl: parsed?.imageUrl,
      });
      sessionStorage.removeItem(TOOL_PREFILL_KEY);
    } catch (error) {
      console.warn("Failed to read tool prefill data:", error);
    }
  }, []);

  // 加载历史记录（用户登录时）
  useEffect(() => {
    const userId = user?.id;
    if (!userId) {
      historySyncUserRef.current = null;
      return;
    }
    if (historySyncUserRef.current === userId) return;

    historySyncUserRef.current = userId;

    const abortController = new AbortController();
    let disposed = false;
    let completed = false;

    // 从 localStorage 加载历史记录
    const history = videoHistoryStorage.getHistory(userId);
    setHistoryItems(history);

    // 可选：从服务器同步最近 20 条视频
    fetch(`/api/v1/video/list?limit=20`, { signal: abortController.signal })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to sync video history (${res.status})`);
        }
        return res.json();
      })
      .then((data) => {
        if (disposed) return;
        if (data.data?.videos) {
          videoHistoryStorage.syncFromServer(data.data.videos);
          setHistoryItems(videoHistoryStorage.getHistory(userId));
          // Resume reconciliation for tasks created in another tab/device or
          // after local storage was cleared. Zhipu is polling-based, so server
          // history must be sufficient to recover a non-terminal generation.
          for (const video of data.data.videos as Video[]) {
            const status = video.status.toLowerCase();
            if (
              status === "pending" ||
              status === "generating" ||
              status === "uploading"
            ) {
              addGeneratingId(video.uuid);
              if (!isPolling(video.uuid)) startPolling(video.uuid);
            }
          }
        }
        completed = true;
      })
      .catch((error) => {
        if (abortController.signal.aborted) return;
        if (historySyncUserRef.current === userId) {
          historySyncUserRef.current = null;
        }
        console.warn("Failed to sync video history from server:", error);
      });

    return () => {
      disposed = true;
      abortController.abort();
      if (!completed && historySyncUserRef.current === userId) {
        historySyncUserRef.current = null;
      }
    };
  }, [user?.id, addGeneratingId, isPolling, startPolling]);

  useEffect(() => {
    if (!user?.id) return;
    const localTasks = videoTaskStorage.getGeneratingTasks(user.id);
    localTasks.forEach((task) => {
      addGeneratingId(task.videoId);
      if (!isPolling(task.videoId)) {
        startPolling(task.videoId);
      }
    });
  }, [user?.id, isPolling, startPolling, addGeneratingId]);

  useEffect(() => {
    if (!user?.id) return;
    if (!videoIdFromQuery) return;

    // 立即添加到历史记录（即使是正在生成中）
    const existingItem = videoHistoryStorage.getHistory(user.id).find(item => item.uuid === videoIdFromQuery);
    const existingStatus = existingItem?.status?.toLowerCase();
    const isTerminalStatus = existingStatus === "completed" || existingStatus === "failed";
    if (!existingItem) {
      const newItem: VideoHistoryItem = {
        uuid: videoIdFromQuery,
        userId: user.id,
        prompt: prefillData?.prompt || "",
        model: prefillData?.model || "",
        status: "generating",
        creditsUsed: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      videoHistoryStorage.addHistory(newItem);
      setHistoryItems(videoHistoryStorage.getHistory(user.id));
    }

    setActiveTab("result");
    if (!isTerminalStatus) {
      addGeneratingId(videoIdFromQuery);
      if (!isPolling(videoIdFromQuery)) {
        startPolling(videoIdFromQuery);
      }
    } else {
      removeGeneratingId(videoIdFromQuery);
      stopPolling(videoIdFromQuery);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoIdFromQuery, user?.id]);

  // 处理生成提交
  const handleSubmit = useCallback(async (data: GeneratorData) => {
    // 检查登录
    if (!user) {
      router.push(`/${locale}/login`);
      return;
    }

    // 检查积分
    const requiredCredits = data.estimatedCredits || 0;
    const availableCredits = balance?.availableCredits ?? 0;

    const lowCreditState = getLowCreditState(availableCredits, requiredCredits);

    if (!lowCreditState.canGenerate) {
      // 打开升级弹窗
      openModal({
        reason: "insufficient_credits",
        requiredCredits,
        availableCredits,
      });
      return;
    }

    // 乐观更新：立即冻结积分（UI 立即反映变化）
    optimisticFreeze(requiredCredits);

    // 开始提交
    setIsSubmitting(true);

    try {
      if (typeof window !== "undefined" && "Notification" in window) {
        const asked = localStorage.getItem(NOTIFICATION_ASKED_KEY);
        if (!asked && Notification.permission === "default") {
          localStorage.setItem(NOTIFICATION_ASKED_KEY, "1");
          toast.info(tNotify("generationWillNotify"), {
            description: tNotify("notificationDescription"),
            duration: Number.POSITIVE_INFINITY, // 保持显示直到用户操作
            closeButton: true,  // 显示关闭按钮
            action: {
              label: tNotify("enableNotifications"),
              onClick: () => {
                Notification.requestPermission().catch((error) => {
                  console.warn("Notification permission request failed:", error);
                });
              },
            },
          });
        }
      }
    } catch (error) {
      console.warn("Notification permission request failed:", error);
    }

    try {
      const selectedMode = config.generator.mode || toolRoute;
      const [imageUrl, endImageUrl] = await Promise.all([
        data.imageFile ? uploadImage(data.imageFile) : Promise.resolve(data.imageUrl),
        data.endImageFile ? uploadImage(data.endImageFile) : Promise.resolve(data.endImageUrl),
      ]);
      const imageUrls = [imageUrl, endImageUrl].filter(
        (value): value is string => Boolean(value)
      );
      const response = await fetch("/api/v1/video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: data.prompt,
          model: data.model,
          mode: selectedMode,
          duration: data.duration,
          aspectRatio: data.aspectRatio,
          quality: data.quality,
          outputNumber: data.outputNumber ?? 1,
          generateAudio: data.generateAudio,
          imageUrls: imageUrls.length ? imageUrls : undefined,
          imageUrl,
          removeWatermark: data.removeWatermark,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error?.error?.message || error?.message || tHistory("generationFailed"));
      }

      const result = await response.json();
      const generatedOutputs = Array.isArray(result.data.outputs) && result.data.outputs.length > 0
        ? result.data.outputs
        : [result.data];

      toast.success(tTool("generatingTag"));

      if (lowCreditState.shouldWarn && typeof window !== "undefined") {
        const lastNotice = Number(localStorage.getItem(LOW_CREDIT_NOTICE_KEY) || 0);
        if (Date.now() - lastNotice >= LOW_CREDIT_NOTICE_INTERVAL) {
          localStorage.setItem(LOW_CREDIT_NOTICE_KEY, String(Date.now()));
          const isSubscriber = Boolean(balance?.plan && balance.plan !== "FREE");
          toast.warning(tTool("lowCreditTitle"), {
            description: tTool("lowCreditDescription", {
              credits: lowCreditState.remainingAfterGeneration,
            }),
            action: {
              label: isSubscriber
                ? tTool("buyCredits")
                : tTool("choosePlan"),
              onClick: () => openModal({ reason: "upgrade" }),
            },
          });
        }
      }

      // 添加到历史记录
      const creditsPerOutput = Math.ceil(
        (data.estimatedCredits || 0) / generatedOutputs.length
      );
      for (const output of generatedOutputs) {
        const videoUuid = output.videoUuid as string;
        videoHistoryStorage.addHistory({
          uuid: videoUuid,
          userId: user.id,
          prompt: data.prompt,
          model: data.model,
          status: "generating",
          creditsUsed: output.creditsUsed ?? creditsPerOutput,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        addGeneratingId(videoUuid);
        startPolling(videoUuid);
        videoTaskStorage.addTask({
          userId: user.id,
          videoId: videoUuid,
          taskId: output.taskId,
          prompt: data.prompt,
          model: data.model,
          mode: selectedMode,
          status: "generating",
          createdAt: Date.now(),
          notified: false,
        });
      }
      setHistoryItems(videoHistoryStorage.getHistory(user.id));

      setActiveTab("result");
    } catch (error) {
      console.error("Generation error:", error);
      // API 调用失败，回滚乐观更新（释放积分）
      const requiredCredits = data.estimatedCredits || 0;
      optimisticRelease(requiredCredits);
      // 显示错误提示
      toast.error(error instanceof Error ? error.message : tHistory("generationFailed"));
    }
    setIsSubmitting(false);
  }, [
    user,
    locale,
    router,
    balance,
    config.generator.mode,
    toolRoute,
    startPolling,
    addGeneratingId,
    optimisticFreeze,
    optimisticRelease,
    tNotify,
    tHistory,
    tTool,
    openModal,
  ]);

  // 处理重新生成
  const handleRegenerate = useCallback(() => {
    setActiveTab("generator");
  }, []);

  // 处理删除视频
  const handleDelete = useCallback(async (uuid: string) => {
    try {
      const response = await fetch(`/api/v1/video/${uuid}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(tCommon("error"));
      }

      // 从历史记录中删除
      videoHistoryStorage.removeHistory(uuid, user?.id);
      setHistoryItems(videoHistoryStorage.getHistory(user?.id));

      // 更新 currentVideos（兼容旧逻辑）
      setCurrentVideos((prev) => prev.filter((v) => v.uuid !== uuid));
      toast.success(tCommon("success"));
    } catch (error) {
      console.error("Delete error:", error);
      toast.error(tCommon("error"));
    }
  }, [user?.id, tCommon]);

  // 处理重试失败的视频
  const handleRetry = useCallback(async (uuid: string) => {
    try {
      const response = await fetch(`/api/v1/video/${uuid}/retry`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(tCommon("error"));
      }
      const payload = await response.json();
      const retried = payload.data;
      const newVideoUuid = retried.videoUuid as string;
      resetNotification(uuid);
      resetNotification(`${uuid}:failed`);
      videoHistoryStorage.addHistory({
        uuid: newVideoUuid,
        userId: user.id,
        prompt: historyItems.find((item) => item.uuid === uuid)?.prompt ?? "",
        model: historyItems.find((item) => item.uuid === uuid)?.model ?? "",
        status: "generating",
        creditsUsed: retried.creditsUsed ?? 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setHistoryItems(videoHistoryStorage.getHistory(user.id));
      videoTaskStorage.addTask({
        userId: user.id,
        videoId: newVideoUuid,
        taskId: retried.taskId,
        prompt: historyItems.find((item) => item.uuid === uuid)?.prompt ?? "",
        model: historyItems.find((item) => item.uuid === uuid)?.model ?? "",
        mode: config.generator.mode || toolRoute,
        status: "generating",
        createdAt: Date.now(),
        notified: false,
      });
      addGeneratingId(newVideoUuid);
      startPolling(newVideoUuid);
      toast.success(tTool("generatingTag"));
    } catch (error) {
      console.error("Retry error:", error);
      toast.error(tCommon("error"));
    }
  }, [
    addGeneratingId,
    config.generator.mode,
    historyItems,
    resetNotification,
    startPolling,
    toolRoute,
    user,
    tCommon,
    tTool,
  ]);

  // 移动端：显示标签导航
  const showMobileTabs = Boolean(user);

  // Unauthenticated Layout: Scrollable, Tool Area + Landing Page
  if (!user) {
    return (
      <>
        <div className="relative flex h-full flex-1 flex-col overflow-hidden lg:flex-row">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,rgba(129,92,246,0.18),transparent_26%),radial-gradient(circle_at_82%_24%,rgba(236,72,153,0.14),transparent_22%),linear-gradient(180deg,rgba(5,6,10,0.12),rgba(5,6,10,0))]" />
          {/* Mobile Tabs */}
          {showMobileTabs && (
            <div className="flex shrink-0 border-b border-white/10 lg:hidden">
              <button
                type="button"
                onClick={() => setActiveTab("generator")}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === "generator"
                  ? "text-foreground border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                {tTool("generator")}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("result")}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === "result"
                  ? "text-foreground border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                {tTool("result")}
              </button>
            </div>
          )}

          {/* Desktop Sidebar (Left) is handled by the parent layout wrapper, 
            but here we control the content area to be scrollable */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* Tool Area Container */}
            <div className="mx-auto w-full max-w-[1540px] px-3 py-4 sm:px-4 lg:px-5">
              <div className={`flex flex-col gap-4 lg:flex-row ${activeTab === "generator" ? "" : "lg:flex"}`}>

                {/* Generator Panel Side */}
                <div className="block w-full shrink-0 lg:h-[calc(100svh-92px)] lg:min-h-[700px] lg:w-[440px]">
                  <GeneratorPanel
                    toolType={toolRoute as "image-to-video" | "text-to-video"}
                    locale={locale}
                    isLoading={isSubmitting}
                    onSubmit={handleSubmit}
                    availableModelIds={config.generator.models.available}
                    defaultModelId={config.generator.models.default}
                    initialPrompt={prefillData?.prompt}
                    initialModelId={prefillData?.model}
                    initialDuration={prefillData?.duration}
                    initialAspectRatio={prefillData?.aspectRatio}
                    initialQuality={prefillData?.quality}
                    initialImageUrl={prefillData?.imageUrl}
                    maxOutputNumber={1}
                  />
                </div>

                {/* Result/Preview Side */}
                <div className="min-w-0 flex-1"><ToolExamplesPanel locale={locale} /></div>
              </div>
            </div>

            {/* Landing Page Content */}
            <ToolLandingPage
              config={config}
              locale={locale}
            />
          </div>
        </div>

        {/* 全局升级弹窗 */}
        <UpgradeModal />
      </>
    );
  }

  // Authenticated Layout: Three-column application mode
  return (
    <>
      <div className="relative flex h-full flex-1 flex-col gap-6 overflow-hidden bg-background px-4 py-4 lg:px-4">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_0%,rgba(129,92,246,0.18),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(236,72,153,0.14),transparent_20%)]" />
        {/* Mobile Tabs */}
        {showMobileTabs && (
          <div className="mb-2 flex shrink-0 border-b border-white/10 lg:hidden">
            <button
              type="button"
              onClick={() => setActiveTab("generator")}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === "generator"
                ? "text-foreground border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              {tTool("generator")}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("result")}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === "result"
                ? "text-foreground border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              {tTool("result")}
            </button>
          </div>
        )}

        <div className="grid h-fit min-h-0 max-h-[calc(100svh-92px)] grid-cols-1 gap-4 lg:grid-cols-[440px_minmax(0,1.2fr)]">
          {/* Generator Panel */}
          <div
            className={`${activeTab === "generator" ? "flex" : "hidden"
              } lg:flex flex-col h-full min-h-0`}
          >
            <div className="h-full min-h-0">
              <GeneratorPanel
                toolType={toolRoute as "image-to-video" | "text-to-video"}
                locale={locale}
                isLoading={isSubmitting}
                onSubmit={handleSubmit}
                availableModelIds={config.generator.models.available}
                defaultModelId={config.generator.models.default}
                initialPrompt={prefillData?.prompt}
                initialModelId={prefillData?.model}
                initialDuration={prefillData?.duration}
                initialAspectRatio={prefillData?.aspectRatio}
                initialQuality={prefillData?.quality}
                initialImageUrl={prefillData?.imageUrl}
                maxOutputNumber={2}
              />
            </div>
          </div>

          {/* Result Panel */}
          <div
            className={`${activeTab === "result" ? "flex" : "hidden"
              } lg:flex flex-1 h-full min-h-0`}
          >
            <VideoHistoryPanel
              historyItems={historyItems}
              generatingIds={generatingIds}
              onDelete={handleDelete}
              className="h-full min-h-0"
            />
          </div>

        </div>
      </div>

      {/* 全局升级弹窗 */}
      <UpgradeModal />
    </>
  );
}

export default ToolPageLayout;
