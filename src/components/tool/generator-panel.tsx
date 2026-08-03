"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Check,
  ChevronDown,
  Clock,
  Crown,
  Gem,
  ImagePlus,
  Sparkles,
  Volume2,
  WandSparkles,
  X,
} from "lucide-react";

import { DEFAULT_VIDEO_MODELS } from "@/components/video-generator";
import { DurationSlider } from "@/components/video-generator/duration-slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { calculateModelCredits, getModelCatalog } from "@/config/credits";
import { cn } from "@/lib/utils";

interface GeneratorPanelProps {
  toolType: "image-to-video" | "text-to-video";
  locale?: string;
  isLoading?: boolean;
  onSubmit?: (data: GeneratorData) => void;
  availableModelIds?: string[];
  defaultModelId?: string;
  initialPrompt?: string;
  initialModelId?: string;
  initialDuration?: number;
  initialAspectRatio?: string;
  initialQuality?: string;
  initialImageUrl?: string;
  maxOutputNumber?: 1 | 2;
}

export interface GeneratorData {
  toolType: string;
  model: string;
  prompt: string;
  duration: number;
  aspectRatio: string;
  quality?: string;
  outputNumber?: number;
  generateAudio?: boolean;
  removeWatermark?: boolean;
  imageFile?: File;
  endImageFile?: File;
  imageUrl?: string;
  endImageUrl?: string;
  estimatedCredits: number;
}

type RecentImageAsset = { uuid: string; url: string; fileName: string };

function getNearestDuration(value: number, options: number[]) {
  if (options.length === 0) return 5;
  return options.reduce((nearest, option) =>
    Math.abs(option - value) < Math.abs(nearest - value) ? option : nearest
  );
}

const copy = {
  en: {
    titleText: "Text to Video",
    titleImage: "Image to Video",
    prompt: "Prompt",
    enhance: "Prompt enhancement",
    placeholder: "Describe the video you want to create, e.g. A cinematic close-up with natural lighting and gentle camera movement...",
    aiPrompt: "AI prompt",
    images: "Images",
    firstFrame: "First Frame",
    lastFrame: "Last Frame",
    upload: "Click to upload",
    recent: "My creations",
    settings: "Settings",
    model: "Model",
    ratio: "Aspect ratio",
    duration: "Duration",
    nativeDuration: "Native",
    extendedDuration: "Official extension",
    unavailableDuration: "Unavailable",
    resolution: "Resolution",
    outputs: "Outputs",
    audio: "Generate audio",
    watermark: "Remove watermark",
    credits: "Estimated cost",
    generate: "Generate",
    generating: "Generating...",
  },
  zh: {
    titleText: "文本转视频",
    titleImage: "图像到视频",
    prompt: "提示",
    enhance: "提示增强",
    placeholder: "描述你想创建的视频，例如：电影感特写，自然光线，镜头缓慢推进……",
    aiPrompt: "AI 提示词",
    images: "图片",
    firstFrame: "首帧",
    lastFrame: "尾帧",
    upload: "点击上传",
    recent: "我的创作",
    settings: "设置",
    model: "模型",
    ratio: "比例",
    duration: "时长",
    nativeDuration: "原生生成",
    extendedDuration: "官方续写",
    unavailableDuration: "暂不支持",
    resolution: "分辨率",
    outputs: "生成数量",
    audio: "生成音频",
    watermark: "移除水印",
    credits: "预计消耗",
    generate: "生成视频",
    generating: "生成中……",
  },
};

function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
        checked ? "border-blue-500 bg-blue-500" : "border-slate-600 bg-slate-700",
      )}
    >
      <span className={cn("absolute left-0 top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-transform", checked ? "translate-x-4" : "translate-x-0.5")} />
    </button>
  );
}

function FrameUpload({
  label,
  file,
  imageUrl,
  onChange,
  onRemove,
  disabled,
  uploadLabel,
  recentLabel,
}: {
  label: string;
  file: File | null;
  imageUrl: string | null;
  onChange: (file: File) => void;
  onRemove: () => void;
  disabled?: boolean;
  uploadLabel: string;
  recentLabel: string;
}) {
  return (
    <div className="relative min-w-0">
      <span className="absolute -top-2 left-2 z-10 rounded bg-blue-600 px-2 py-0.5 text-[11px] font-semibold text-white">{label}</span>
      {file || imageUrl ? (
        <div className="group relative flex h-28 items-center justify-center overflow-hidden rounded-lg border border-slate-600 bg-slate-800/80">
          {imageUrl ? <img src={imageUrl} alt={label} className="h-full w-full object-cover" /> : <span className="max-w-[85%] truncate px-2 text-xs text-slate-300">{file?.name}</span>}
          <button type="button" onClick={onRemove} aria-label={`Remove ${label}`} className="absolute right-2 top-2 rounded-full bg-black/70 p-1 text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <label className="flex h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-500 bg-slate-900/35 text-center transition-colors hover:border-blue-500 hover:bg-blue-500/5">
          <ImagePlus className="mb-2 h-6 w-6 text-slate-400" />
          <span className="text-xs text-slate-300">{uploadLabel}</span>
          <span className="mt-1 text-[10px] text-slate-500">{recentLabel}</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            disabled={disabled}
            onChange={(event) => {
              const next = event.target.files?.[0];
              if (next) onChange(next);
              event.target.value = "";
            }}
          />
        </label>
      )}
    </div>
  );
}

export function GeneratorPanel({
  toolType,
  locale = "en",
  isLoading = false,
  onSubmit,
  availableModelIds,
  defaultModelId,
  initialPrompt,
  initialModelId,
  initialDuration,
  initialAspectRatio,
  initialQuality,
  initialImageUrl,
  maxOutputNumber = 1,
}: GeneratorPanelProps) {
  const translate = useTranslations("GeneratorPanel");
  const creditTranslate = useTranslations("Credits");
  const translatedCopy = {
    titleText: translate("titleText"),
    titleImage: translate("titleImage"),
    prompt: translate("prompt"),
    enhance: translate("enhance"),
    placeholder: translate("placeholder"),
    aiPrompt: translate("aiPrompt"),
    images: translate("images"),
    firstFrame: translate("firstFrame"),
    lastFrame: translate("lastFrame"),
    upload: translate("upload"),
    recent: translate("recent"),
    settings: translate("settings"),
    model: translate("model"),
    ratio: translate("ratio"),
    duration: translate("duration"),
    nativeDuration: translate("nativeDuration"),
    extendedDuration: translate("extendedDuration"),
    unavailableDuration: translate("unavailableDuration"),
    resolution: translate("resolution"),
    outputs: translate("outputs"),
    audio: translate("audio"),
    watermark: translate("watermark"),
    credits: translate("credits"),
    generate: translate("generate"),
    generating: translate("generating"),
    fileError: translate("fileError"),
    enhancementSuffix: translate("enhancementSuffix"),
    seconds: translate("seconds"),
    noModels: translate("noModels"),
    videoModels: translate("videoModels"),
  };
  const t = {
    ...(locale === "zh" ? copy.zh : copy.en),
    ...translatedCopy,
  };
  const models = useMemo(() => getModelCatalog(), []);
  const [prompt, setPrompt] = useState(initialPrompt || "");
  const [promptEnhancement, setPromptEnhancement] = useState(false);
  const firstActiveModel = models.find((model) => model.availability === "active");
  const [selectedModel, setSelectedModel] = useState(
    initialModelId || defaultModelId || firstActiveModel?.id || ""
  );
  const [duration, setDuration] = useState(initialDuration || 5);
  const [aspectRatio, setAspectRatio] = useState(initialAspectRatio || "16:9");
  const [quality, setQuality] = useState(initialQuality || "720P");
  const [outputNumber, setOutputNumber] = useState(1);
  const [generateAudio, setGenerateAudio] = useState(false);
  const [removeWatermark, setRemoveWatermark] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [endImageFile, setEndImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl || null);
  const [endImageUrl, setEndImageUrl] = useState<string | null>(null);
  const [recentAssets, setRecentAssets] = useState<RecentImageAsset[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);

  const availableModels = useMemo(() => {
    const allowed = availableModelIds?.length ? new Set(availableModelIds) : null;
    return models.filter((model) => (!allowed || allowed.has(model.id)) && (toolType === "text-to-video" || model.supportImageToVideo));
  }, [availableModelIds, models, toolType]);
  const activeModels = useMemo(
    () =>
      availableModels.filter((model) => model.availability === "active"),
    [availableModels]
  );
  const currentModel =
    activeModels.find((model) => model.id === selectedModel) || activeModels[0];
  const modelMetadata = useMemo(() => new Map(DEFAULT_VIDEO_MODELS.map((model) => [model.id, model])), []);

  useEffect(() => {
    if (!currentModel) return;
    if (!currentModel.durations.includes(duration)) {
      setDuration(getNearestDuration(duration, currentModel.durations));
    }
    if (!currentModel.aspectRatios.includes(aspectRatio)) setAspectRatio(currentModel.aspectRatios[0] || "16:9");
    if (currentModel.qualities?.length && !currentModel.qualities.includes(quality)) setQuality(currentModel.qualities[0]);
  }, [aspectRatio, currentModel, duration, quality]);

  useEffect(() => {
    if (!activeModels.length || activeModels.some((model) => model.id === selectedModel)) return;
    setSelectedModel(activeModels[0]?.id || "");
  }, [activeModels, selectedModel]);

  useEffect(() => {
    if (toolType !== "image-to-video") return;
    let cancelled = false;
    void fetch("/api/v1/assets?limit=8")
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload) => { if (!cancelled) setRecentAssets((payload?.data?.assets ?? []) as RecentImageAsset[]); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [toolType]);

  const estimatedCredits = useMemo(() => currentModel ? calculateModelCredits(currentModel.id, { duration, quality }) * outputNumber : 0, [currentModel, duration, outputNumber, quality]);
  const canSubmit = Boolean(currentModel && prompt.trim() && (toolType === "text-to-video" || imageFile || imageUrl) && !isLoading);

  const validateFile = (file: File, setFile: (value: File) => void) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type) || file.size > 10 * 1024 * 1024) {
      setImageError(t.fileError);
      return;
    }
    setImageError(null);
    setFile(file);
  };

  const enhancePrompt = () => {
    const base = prompt.trim();
    if (!base) return;
    const suffix = t.enhancementSuffix;
    if (!base.includes(suffix)) setPrompt(`${base}${suffix}`.slice(0, 20000));
    setPromptEnhancement(true);
  };

  const handleSubmit = useCallback(() => {
    if (!canSubmit || !currentModel) return;
    onSubmit?.({
      toolType,
      model: currentModel.id,
      prompt: prompt.trim(),
      duration,
      aspectRatio,
      quality: currentModel.qualities?.includes(quality) ? quality : undefined,
      outputNumber,
      generateAudio: currentModel.supportAudio ? generateAudio : undefined,
      removeWatermark: currentModel.supportRemoveWatermark === false
        ? undefined
        : removeWatermark,
      imageFile: imageFile || undefined,
      endImageFile: endImageFile || undefined,
      imageUrl: imageUrl || undefined,
      endImageUrl: endImageUrl || undefined,
      estimatedCredits,
    });
  }, [aspectRatio, canSubmit, currentModel, duration, endImageFile, endImageUrl, estimatedCredits, generateAudio, imageFile, imageUrl, onSubmit, outputNumber, prompt, quality, removeWatermark, toolType]);

  const renderModelIcon = (id: string, name: string) => {
    const meta = modelMetadata.get(id);
    return <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: meta?.color || "#7c3aed" }}>{typeof meta?.icon === "string" && !meta.icon.startsWith("http") ? meta.icon : name[0]}</span>;
  };

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-700/80 bg-[#0f172a] text-slate-100 shadow-2xl shadow-black/20">
      <div className="shrink-0 px-4 pb-3 pt-4 sm:px-5">
        <h1 className="text-xl font-bold tracking-tight">{toolType === "image-to-video" ? t.titleImage : t.titleText}</h1>
      </div>
      <div className="mx-4 border-t border-slate-700/80 sm:mx-5" />

      <div className="custom-scrollbar flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-5">
        {!activeModels.length && <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-200">{t.noModels}</div>}

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label htmlFor="video-prompt" className="text-sm font-semibold">{t.prompt}</label>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>{t.enhance}</span>
              <Toggle checked={promptEnhancement} onChange={() => setPromptEnhancement((value) => !value)} label={t.enhance} disabled={isLoading} />
            </div>
          </div>
          <div className="relative">
            <textarea
              id="video-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={t.placeholder}
              maxLength={20000}
              disabled={isLoading}
              className="min-h-40 w-full resize-y rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-3 pb-10 text-sm leading-6 text-slate-100 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="absolute bottom-3 left-3 text-[11px] text-slate-400">{prompt.length}/20000</span>
            <button type="button" onClick={enhancePrompt} disabled={!prompt.trim() || isLoading} className="absolute bottom-2 right-2 flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-40">
              <WandSparkles className="h-3.5 w-3.5" /> {t.aiPrompt}
            </button>
          </div>
        </div>

        {toolType === "image-to-video" && (
          <div>
            <div className="mb-3 text-sm font-semibold">{t.images} <span className="font-normal text-slate-400">(1–2)</span></div>
            <div className="grid grid-cols-2 gap-3">
              <FrameUpload label={t.firstFrame} file={imageFile} imageUrl={imageUrl} disabled={isLoading} uploadLabel={t.upload} recentLabel={t.recent} onChange={(file) => validateFile(file, (value) => { setImageFile(value); setImageUrl(null); })} onRemove={() => { setImageFile(null); setImageUrl(null); }} />
              <FrameUpload label={t.lastFrame} file={endImageFile} imageUrl={endImageUrl} disabled={isLoading} uploadLabel={t.upload} recentLabel={t.recent} onChange={(file) => validateFile(file, (value) => { setEndImageFile(value); setEndImageUrl(null); })} onRemove={() => { setEndImageFile(null); setEndImageUrl(null); }} />
            </div>
            {imageError && <p role="alert" className="mt-2 text-xs text-red-400">{imageError}</p>}
            {!imageFile && !imageUrl && recentAssets.length > 0 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {recentAssets.map((asset) => <button key={asset.uuid} type="button" title={asset.fileName} onClick={() => setImageUrl(asset.url)} className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-slate-600"><img src={asset.url} alt={asset.fileName} className="h-full w-full object-cover" /></button>)}
              </div>
            )}
          </div>
        )}

        {currentModel && (
          <div className="space-y-4">
            <h2 className="text-base font-bold">{t.settings}</h2>
            <div>
              <div className="mb-2 text-sm text-slate-300">{t.model}</div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" disabled={isLoading} className="flex h-10 w-full items-center justify-between rounded-md border border-slate-600 bg-slate-800 px-3 text-sm hover:border-slate-500">
                    <span className="flex items-center gap-2">{renderModelIcon(currentModel.id, currentModel.name)}{currentModel.name}</span><ChevronDown className="h-4 w-4 text-slate-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] border-slate-700 bg-slate-900 text-white">
                  <DropdownMenuLabel>{t.videoModels}</DropdownMenuLabel><DropdownMenuSeparator className="bg-slate-700" />
                  {availableModels.map((model) => (
                    <DropdownMenuItem
                      key={model.id}
                      disabled={model.availability !== "active"}
                      onSelect={() => {
                        if (model.availability === "active") setSelectedModel(model.id);
                      }}
                      className="gap-2 py-2.5 focus:bg-slate-800 focus:text-white data-[disabled]:opacity-55"
                    >
                      {renderModelIcon(model.id, model.name)}
                      <span className="flex-1">{model.name}</span>
                      {model.badge ? (
                        <span className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          model.availability === "coming_soon"
                            ? "bg-slate-700 text-slate-300"
                            : "bg-blue-500/15 text-blue-300"
                        )}>{model.badge}</span>
                      ) : null}
                      {selectedModel === model.id && <Check className="h-4 w-4 text-blue-400" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <ChoiceRow label={t.ratio} values={currentModel.aspectRatios} selected={aspectRatio} onSelect={setAspectRatio} disabled={isLoading} />
            <fieldset>
              <legend className="mb-2 text-sm text-slate-300">{t.duration}</legend>
              <DurationSlider
                min={currentModel.durationDisplayMin ?? Math.min(...currentModel.durations)}
                max={currentModel.durationDisplayMax ?? currentModel.maxDuration}
                nativeOptions={currentModel.nativeDurations ?? currentModel.durations}
                extendedOptions={currentModel.extendedDurations ?? []}
                value={duration}
                onChange={setDuration}
                disabled={isLoading}
                nativeLabel={t.nativeDuration}
                extendedLabel={t.extendedDuration}
                unavailableLabel={t.unavailableDuration}
                secondsLabel={t.seconds}
                ariaLabel={t.duration}
              />
            </fieldset>
            {currentModel.qualities?.length ? <ChoiceRow label={t.resolution} values={currentModel.qualities} selected={quality} onSelect={setQuality} disabled={isLoading} /> : null}
            {maxOutputNumber > 1 && <ChoiceRow label={t.outputs} values={["1", "2"]} selected={String(outputNumber)} onSelect={(value) => setOutputNumber(Number(value))} disabled={isLoading} />}

            {currentModel.supportAudio && <SettingToggle icon={<Volume2 className="h-4 w-4" />} label={t.audio} checked={generateAudio} onChange={() => setGenerateAudio((value) => !value)} disabled={isLoading} />}
            {currentModel.supportRemoveWatermark !== false ? <SettingToggle icon={<Crown className="h-4 w-4 text-amber-400" />} label={t.watermark} checked={removeWatermark} onChange={() => setRemoveWatermark((value) => !value)} disabled={isLoading} /> : null}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-700/80 bg-slate-950/35 p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm">
          <span className="text-slate-400">{t.credits}</span><span className="flex items-center gap-1.5 font-semibold"><Gem className="h-4 w-4 text-amber-400" />{estimatedCredits} {creditTranslate("title")}</span>
        </div>
        <button type="button" onClick={handleSubmit} disabled={!canSubmit} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 transition-colors hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none">
          <Sparkles className="h-4 w-4" /> {isLoading ? t.generating : t.generate}
        </button>
      </div>
    </section>
  );
}

function ChoiceRow({ label, values, selected, onSelect, disabled }: { label: string; values: string[]; selected: string; onSelect: (value: string) => void; disabled?: boolean }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm text-slate-300">{label}</legend>
      <div className="flex flex-wrap gap-x-3 gap-y-2">
        {values.map((value) => (
          <label key={value} className="flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md px-1 text-sm text-slate-300 focus-within:ring-2 focus-within:ring-blue-500">
            <input type="radio" name={`choice-${label}`} value={value} checked={selected === value} onChange={() => onSelect(value)} disabled={disabled} className="sr-only" />
            <span className={cn("flex h-4 w-4 items-center justify-center rounded-full border", selected === value ? "border-blue-500 bg-blue-500" : "border-slate-500")}><span className={cn("h-1.5 w-1.5 rounded-full bg-white", selected === value ? "opacity-100" : "opacity-0")} /></span>{value}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function SettingToggle({ icon, label, checked, onChange, disabled }: { icon: React.ReactNode; label: string; checked: boolean; onChange: () => void; disabled?: boolean }) {
  return <div className="flex min-h-9 items-center justify-between gap-3"><span className="flex items-center gap-2 text-sm text-slate-300">{icon}{label}</span><Toggle checked={checked} onChange={onChange} label={label} disabled={disabled} /></div>;
}
