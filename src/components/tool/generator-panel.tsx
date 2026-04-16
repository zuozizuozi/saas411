"use client";

/**
 * Generator Panel Component - Pollo.ai Style
 *
 * Tool page generator panel with dark theme design
 * Design inspired by https://pollo.ai
 * - Dark theme (#1A1A1A background)
 * - Uppercase labels for sections
 * - Purple accent color (#6D28D9)
 * - Dashed border upload area
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { cn } from "@/components/ui";
import { DEFAULT_VIDEO_MODELS } from "@/components/video-generator";
import { getAvailableModels, calculateModelCredits } from "@/config/credits";
import { ChevronDown, X, Sparkles, Image as ImageIcon, Clock, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

// ============================================================================
// Types
// ============================================================================

interface SectionLabelProps {
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}

function SectionLabel({ children, required, className }: SectionLabelProps) {
  return (
    <div className={cn("text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2 block", className)}>
      {children}
      {required && <span className="text-destructive ml-1">*</span>}
    </div>
  );
}

interface GeneratorPanelProps {
  toolType: "image-to-video" | "text-to-video" | "reference-to-video";
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
  imageFile?: File;
  imageUrl?: string;
  estimatedCredits: number;
}

export function GeneratorPanel({
  toolType,
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
}: GeneratorPanelProps) {
  const models = getAvailableModels();
  const [prompt, setPrompt] = useState(initialPrompt || "");
  const [selectedModel, setSelectedModel] = useState(initialModelId || defaultModelId || models[0]?.id || "");
  const [duration, setDuration] = useState(initialDuration || 10);
  const [aspectRatio, setAspectRatio] = useState(initialAspectRatio || "16:9");
  const [quality, setQuality] = useState(initialQuality || "standard");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl || null);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  // Filter models based on tool type
  const availableModels = useMemo(() => {
    const allowList = Array.isArray(availableModelIds) && availableModelIds.length > 0;
    let filtered = allowList
      ? models.filter((m) => availableModelIds!.includes(m.id))
      : models;
    if (toolType === "image-to-video" || toolType === "reference-to-video") {
      filtered = filtered.filter((m) => m.supportImageToVideo);
    }
    return filtered;
  }, [toolType, models, availableModelIds]);

  const currentModel = useMemo(
    () => availableModels.find((m) => m.id === selectedModel) || availableModels[0],
    [selectedModel, availableModels]
  );
  const hasAvailableModels = availableModels.length > 0;

  const modelMetadata = useMemo(() => {
    return new Map(DEFAULT_VIDEO_MODELS.map((model) => [model.id, model]));
  }, []);

  const getModelIcon = (modelId: string, fallbackName: string) => {
    const meta = modelMetadata.get(modelId);
    return meta?.icon ?? fallbackName.charAt(0).toUpperCase();
  };

  const getModelColor = (modelId: string) => {
    const meta = modelMetadata.get(modelId);
    return meta?.color ?? "#71717a";
  };

  const renderModelIcon = (modelId: string, name: string, size: "sm" | "md" = "sm") => {
    const icon = getModelIcon(modelId, name);
    const color = getModelColor(modelId);
    const sizeClass = size === "sm" ? "w-4 h-4 text-xs" : "w-6 h-6 text-xs";

    if (typeof icon === "string" && (icon.startsWith("http://") || icon.startsWith("https://") || icon.startsWith("/"))) {
      return (
        <img
          src={icon}
          alt={name}
          className={cn(sizeClass, "rounded object-cover")}
        />
      );
    }

    return (
      <span
        className={cn(sizeClass, "rounded flex items-center justify-center font-bold")}
        style={{ backgroundColor: color, color: "#fff" }}
      >
        {typeof icon === "string" ? icon : name.charAt(0).toUpperCase()}
      </span>
    );
  };

  useEffect(() => {
    if (!currentModel) return;

    if (currentModel.durations && !currentModel.durations.includes(duration)) {
      setDuration(currentModel.durations[0] || duration);
    }

    if (currentModel.aspectRatios && !currentModel.aspectRatios.includes(aspectRatio)) {
      setAspectRatio(currentModel.aspectRatios[0] || aspectRatio);
    }

    if (currentModel.qualities) {
      if (!currentModel.qualities.includes(quality)) {
        setQuality(currentModel.qualities[0] || quality);
      }
    }
  }, [currentModel, duration, aspectRatio, quality]);

  useEffect(() => {
    if (!availableModels.length) return;
    if (selectedModel && availableModels.some((m) => m.id === selectedModel)) {
      return;
    }
    const fallback = defaultModelId && availableModels.some((m) => m.id === defaultModelId)
      ? defaultModelId
      : availableModels[0]?.id;
    if (fallback) {
      setSelectedModel(fallback);
    }
  }, [availableModels, selectedModel, defaultModelId]);

  useEffect(() => {
    if (initialPrompt && !prompt) {
      setPrompt(initialPrompt);
    }
    if (initialImageUrl && !imageFile && !imageUrl) {
      setImageUrl(initialImageUrl);
    }
  }, [initialPrompt, initialImageUrl, prompt, imageFile, imageUrl]);

  useEffect(() => {
    if (!currentModel) return;
    if (initialDuration && currentModel.durations?.includes(initialDuration)) {
      setDuration(initialDuration);
    }
    if (initialAspectRatio && currentModel.aspectRatios?.includes(initialAspectRatio)) {
      setAspectRatio(initialAspectRatio);
    }
    if (initialQuality && currentModel.qualities?.includes(initialQuality)) {
      setQuality(initialQuality);
    }
  }, [currentModel, initialDuration, initialAspectRatio, initialQuality]);

  const estimatedCredits = useMemo(() => {
    if (!selectedModel) return 0;
    return calculateModelCredits(selectedModel, {
      duration,
      quality: currentModel?.qualities?.includes(quality) ? quality : undefined,
    });
  }, [selectedModel, duration, quality, currentModel]);

  const handleSubmit = useCallback(() => {
    if (!currentModel) return;
    const hasPrompt = prompt.trim().length > 0;
    const requiresImage = toolType !== "text-to-video";
    const hasImage = Boolean(imageFile || imageUrl);
    if (!hasPrompt || isLoading) return;
    if (requiresImage && !hasImage) return;

    const data: GeneratorData = {
      toolType,
      model: selectedModel,
      prompt: prompt.trim(),
      duration,
      aspectRatio,
      quality: currentModel?.qualities?.includes(quality) ? quality : undefined,
      outputNumber: 1,
      imageFile: imageFile || undefined,
      imageUrl: imageUrl || undefined,
      estimatedCredits,
    };

    onSubmit?.(data);
  }, [
    prompt,
    selectedModel,
    duration,
    aspectRatio,
    quality,
    imageFile,
    imageUrl,
    estimatedCredits,
    isLoading,
    toolType,
    onSubmit,
    currentModel,
  ]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImageUrl(null);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImageUrl(null);
  };

  const canSubmit = hasAvailableModels &&
    Boolean(currentModel) &&
    prompt.trim().length > 0 &&
    (!((toolType !== "text-to-video") && !imageFile && !imageUrl)) &&
    !isLoading;


  // Get page title
  const getPageTitle = () => {
    if (toolType === "image-to-video") return "IMAGE TO VIDEO";
    if (toolType === "text-to-video") return "TEXT TO VIDEO";
    if (toolType === "reference-to-video") return "REFERENCE TO VIDEO";
    return "AI GENERATOR";
  };

  return (
    <div className="h-full flex flex-col">
      {/* Main Card - Pollo.ai Style */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(24,24,34,0.98),rgba(12,12,18,0.96))] text-foreground shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        {/* Header Bar */}
        <div className="shrink-0 border-b border-white/10 bg-white/[0.03] px-5 py-4">
          <h2 className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
            {getPageTitle()}
          </h2>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5 custom-scrollbar">
          {!hasAvailableModels && (
            <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              No models are currently available for this tool under the active AI
              provider configuration.
            </div>
          )}

          {hasAvailableModels && (
            <>
          {/* Model Selection */}
          <div className="flex items-center justify-between gap-3">
             <span className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
               MODEL
             </span>
             {currentModel && (
                <DropdownMenu open={isModelDropdownOpen} onOpenChange={setIsModelDropdownOpen}>
                <DropdownMenuTrigger asChild disabled={isLoading}>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.05] px-3 py-1.5 text-sm text-white transition-colors hover:bg-white/[0.08]"
                  >
                    {renderModelIcon(currentModel.id, currentModel.name, "sm")}
                    <span>{currentModel.name}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="custom-scrollbar max-h-[400px] w-80 overflow-y-scroll border-white/10 bg-black/92 text-white backdrop-blur-2xl">
                  <DropdownMenuLabel className="text-xs text-zinc-400">
                    Video Models
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/10" />
                  {availableModels.map((model) => (
                    <DropdownMenuItem
                      key={model.id}
                      data-model-id={model.id}
                      onClick={() => setSelectedModel(model.id)}
                       className="flex flex-col items-start py-3 text-white hover:bg-white/6 focus:bg-white/6"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          {renderModelIcon(model.id, model.name, "md")}
                          <span className="font-medium">{model.name}</span>
                        </div>
                        {selectedModel === model.id && (
                          <Check className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                      {model.description && (
                        <div className="text-xs text-zinc-500 mt-1 ml-8">{model.description}</div>
                      )}
                      <div className="text-xs text-zinc-400 mt-1 ml-8 flex items-center gap-2">
                        {model.maxDuration && (
                          <>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {model.maxDuration}
                            </span>
                            <span>•</span>
                          </>
                        )}
                        <span>{model.creditCost?.base ?? ""} credits</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Prompt Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <SectionLabel className="mb-0">PROMPT</SectionLabel>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the video you want to create, e.g., A cat playing in a sunny garden with natural lighting and fresh atmosphere..."
              disabled={isLoading}
               className="min-h-[120px] max-h-[220px] w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-relaxed text-foreground transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none"
              rows={4}
              maxLength={2000}
            />
          </div>

          {/* Image Upload (for image-to-video) */}
          {(toolType === "image-to-video" || toolType === "reference-to-video") &&
            currentModel?.supportImageToVideo && (
              <div>
                <SectionLabel required={toolType === "image-to-video"}>
                  {toolType === "reference-to-video" ? "REFERENCE IMAGE" : "IMAGE SOURCE"}
                </SectionLabel>
                {imageFile || imageUrl ? (
                   <div className="group relative h-32 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt="Selected"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center p-3">
                        <span className="text-xs font-medium truncate bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border">
                          {imageFile?.name}
                        </span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                       className="absolute right-2 top-2 rounded-full border border-white/10 bg-black/70 p-1.5 opacity-0 transition-opacity hover:bg-black group-hover:opacity-100"
                    >
                      <X className="w-3.5 h-3.5 text-foreground" />
                    </button>
                  </div>
                ) : (
                   <label className="group flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/14 bg-white/[0.02] transition-colors hover:border-primary/45 hover:bg-primary/6">
                     <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.05] transition-colors group-hover:bg-white/[0.08]">
                      <ImageIcon className="w-6 h-6 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground mt-3">Upload image</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">JPG, PNG, WEBP • Max 10MB</p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                      disabled={isLoading}
                    />
                  </label>
                )}
              </div>
            )}


          {/* Settings Group */}
          <div className="space-y-5">
            {/* Aspect Ratio */}
            {currentModel?.aspectRatios && (
              <div>
                <SectionLabel>ASPECT RATIO</SectionLabel>
                <div className="grid grid-cols-3 gap-3">
                  {currentModel.aspectRatios.map((ar) => (
                    <button
                      key={ar}
                      type="button"
                      onClick={() => setAspectRatio(ar)}
                      disabled={isLoading}
                      className={cn(
                         "flex aspect-square w-full items-center justify-center rounded-2xl border text-xs font-medium transition-all",
                         aspectRatio === ar
                           ? "border-primary/50 bg-primary/10 text-foreground"
                           : "border-white/10 bg-white/[0.03] text-muted-foreground hover:border-white/20"
                       )}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div className={cn(
                          "border-2 rounded-sm",
                          aspectRatio === ar ? "border-primary" : "border-muted-foreground/50",
                          ar === "16:9" && "w-8 h-4",
                          ar === "9:16" && "w-4 h-8",
                          ar === "1:1" && "w-6 h-6",
                          ar === "4:3" && "w-6 h-4",
                          ar === "3:4" && "w-4 h-6"
                        )} />
                        <span>{ar}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Duration & Quality */}
            <div className="grid grid-cols-2 gap-4">
              {currentModel?.durations && (
                <div>
                  <SectionLabel>VIDEO LENGTH</SectionLabel>
                  <div className="grid grid-cols-3 gap-2">
                    {currentModel.durations.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDuration(d)}
                        disabled={isLoading}
                        className={cn(
                           "h-10 rounded-xl text-sm font-medium transition-all",
                           duration === d
                             ? "bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(139,92,246,0.26)]"
                             : "bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08]"
                         )}
                      >
                        {d}s
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {currentModel?.qualities && (
                <div>
                  <SectionLabel>RESOLUTION</SectionLabel>
                  <div className="grid grid-cols-3 gap-2">
                    {currentModel.qualities.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setQuality(q)}
                        disabled={isLoading}
                        className={cn(
                           "h-10 rounded-xl text-sm font-medium capitalize transition-all",
                           quality === q
                             ? "bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(139,92,246,0.26)]"
                             : "bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08]"
                         )}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
            </>
          )}
        </div>

        {/* Bottom Section - Credits + Generate Button */}
        <div className="shrink-0 space-y-4 border-t border-white/10 bg-white/[0.03] px-5 py-4">
          {/* Credits Display */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Credits:</span>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
              <span className="text-foreground font-medium">{estimatedCredits} Credits</span>
            </div>
          </div>

          {/* Generate Button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-all",
                  canSubmit
                    ? "bg-primary text-primary-foreground shadow-[0_12px_30px_rgba(139,92,246,0.34)] hover:bg-primary/90"
                    : "bg-white/[0.05] text-muted-foreground cursor-not-allowed"
                )}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Video
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
