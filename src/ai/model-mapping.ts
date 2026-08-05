/**
 * AI Provider Model Mapping Configuration
 *
 * This file defines the mapping between internal model IDs and provider-specific model IDs,
 * along with parameter transformation rules.
 *
 * @version 1.0.0
 * @last-updated 2026-01-26
 */

// ============================================================================
// Type Definitions
// ============================================================================

import type { ProviderType } from "./types";

export type GenerationMode =
  | "text-to-video"
  | "image-to-video"
  | "reference-to-video"
  | "frames-to-video";

export interface ProviderModelConfig {
  /** Provider-specific model ID */
  providerModelId: string | ((params: Record<string, any>) => string);
  /** API endpoint (optional, if different from default) */
  apiEndpoint?: string;
  /** Parameter transformation function */
  transformParams?: (
    internalModelId: string,
    params: Record<string, any>
  ) => Record<string, any>;
  /** Response transformation function */
  transformResponse?: (response: any) => any;
  /** Whether this provider supports this model */
  supported: boolean;
  /** Durations this provider can generate in a single native task. */
  nativeDurations?: number[];
  /** Final durations supported through the provider's official extend API. */
  extendedDurations?: number[];
}

export interface ModelMapping {
  /** Internal unified model ID */
  internalId: string;
  /** Display name */
  displayName: string;
  /** Provider-specific configurations */
  providers: {
    evolink?: ProviderModelConfig;
    kie?: ProviderModelConfig;
    apimart?: ProviderModelConfig;
    bailian?: ProviderModelConfig;
    zhipu?: ProviderModelConfig;
  };
}

// ============================================================================
// Parameter Transformers
// ============================================================================

/**
 * Transform aspect_ratio parameter for different providers
 */
function transformAspectRatio(
  value: string,
  provider: ProviderType
): string {
  if (provider === "evolink") {
    return value; // "16:9", "9:16", etc.
  }

  // KIE uses landscape/portrait for some models
  const kieMapping: Record<string, string> = {
    "16:9": "landscape",
    "9:16": "portrait",
  };

  return kieMapping[value] || value;
}

/**
 * Transform duration parameter (number vs string)
 */
function transformDuration(
  value: number,
  provider: ProviderType
): number | string {
  if (provider === "evolink") {
    return value; // number
  }
  return String(value); // KIE uses string
}

/**
 * Normalize quality across providers
 */
function normalizeQuality(
  value: string | undefined,
  provider: ProviderType,
  internalModelId: string
): string | undefined {
  if (!value) return undefined;
  const normalized = String(value).toLowerCase();

  if (provider === "evolink") {
    if (normalized === "standard") return "720p";
    if (normalized === "high") return "1080p";
    if (normalized === "480p") return "480p";
    if (normalized === "720p") return "720p";
    if (normalized === "1080p") return "1080p";
    return value;
  }

  // KIE special case: Sora uses size = standard/high
  if (internalModelId === "sora-2") {
    if (normalized === "high" || normalized === "1080p") return "high";
    if (normalized === "standard" || normalized === "720p" || normalized === "480p") {
      return "standard";
    }
    return value;
  }

  // KIE/APImart default: resolution string
  if (normalized === "standard") return "720p";
  if (normalized === "high") return "1080p";
  if (normalized === "480p") return "480p";
  if (normalized === "720p") return "720p";
  if (normalized === "1080p") return "1080p";
  return value;
}

/**
 * Evolink parameter transformer
 */
function evolinkParamsTransformer(
  internalModelId: string,
  params: Record<string, any>
): Record<string, any> {
  const quality = normalizeQuality(params.quality, "evolink", internalModelId);
  const imageUrls = Array.isArray(params.imageUrls)
    ? params.imageUrls
    : params.imageUrl
      ? [params.imageUrl]
      : undefined;
  const internalFields = new Set([
    "aspectRatio",
    "removeWatermark",
    "callbackUrl",
    "imageUrl",
    "imageUrls",
    "mode",
    "outputNumber",
    "generateAudio",
  ]);
  const passthroughParams = Object.fromEntries(
    Object.entries(params).filter(([key]) => !internalFields.has(key))
  );
  const result: Record<string, any> = {
    ...passthroughParams,
    aspect_ratio: params.aspectRatio || "16:9",
    duration: params.duration || 5,
    ...(internalModelId.startsWith("seedance-")
      ? {}
      : { remove_watermark: params.removeWatermark ?? true }),
    callback_url: params.callbackUrl,
    quality,
    image_urls: imageUrls,
    generate_audio:
      typeof params.generateAudio === "boolean"
        ? params.generateAudio
        : undefined,
  };

  // Seedance 2.0 exposes content_filter. Seedance 1.5 Pro does not document
  // this field, so do not send it there (unknown fields can be rejected).
  if (internalModelId.startsWith("seedance-2.0")) {
    result.content_filter = true;
  }

  // Model-specific adjustments
  if (internalModelId === "wan2.6") {
    // Wan 2.6 uses quality instead of remove_watermark
    if (params.quality) {
      result.quality = quality;
      result.remove_watermark = undefined;
    }
  }

  return result;
}

/**
 * KIE parameter transformer
 */
function kieParamsTransformer(
  internalModelId: string,
  params: Record<string, any>
): Record<string, any> {
  const baseInput: Record<string, any> = {
    prompt: params.prompt,
  };
  const imageUrls = Array.isArray(params.imageUrls)
    ? params.imageUrls
    : params.imageUrl
      ? [params.imageUrl]
      : undefined;

  // Transform common parameters
  if (params.aspectRatio) {
    if (internalModelId === "veo-3.1") {
      baseInput.aspect_ratio = params.aspectRatio;
    } else {
      baseInput.aspect_ratio = transformAspectRatio(params.aspectRatio, "kie");
    }
  }

  if (params.duration) {
    baseInput.duration = transformDuration(params.duration, "kie");
  }

  if (imageUrls && imageUrls.length > 0) {
    // Sora 2 uses image_urls
    if (internalModelId === "sora-2") {
      baseInput.image_urls = imageUrls;
    }
    // Wan 2.6 uses image_urls
    else if (internalModelId === "wan2.6") {
      baseInput.image_urls = imageUrls;
    }
    // Seedance uses input_urls
    else if (internalModelId === "seedance-1.5-pro") {
      baseInput.input_urls = imageUrls;
    }
    // Veo 3.1 uses imageUrls (camelCase)
    else if (internalModelId === "veo-3.1") {
      baseInput.imageUrls = imageUrls;
    }
  }

  baseInput.remove_watermark = params.removeWatermark ?? true;

  // Sora 2 specific parameters
  if (internalModelId === "sora-2") {
    // KIE's Sora 2 uses n_frames instead of duration
    if (params.duration) {
      baseInput.n_frames = String(params.duration);
      baseInput.duration = undefined;
    }
    const size = normalizeQuality(params.quality, "kie", internalModelId);
    if (size) {
      baseInput.size = size;
    }
  }

  // Wan 2.6 specific parameters
  if (internalModelId === "wan2.6") {
    baseInput.resolution =
      normalizeQuality(params.quality, "kie", internalModelId) || "1080p";
    baseInput.multi_shots = params.multiShots || false;
  }

  // Veo 3.1 specific parameters
  if (internalModelId === "veo-3.1") {
    baseInput.aspect_ratio = params.aspectRatio || "16:9";
    // Veo 3.1 doesn't use duration
    baseInput.duration = undefined;
  }

  // Seedance 1.5 Pro specific parameters
  if (internalModelId === "seedance-1.5-pro") {
    baseInput.resolution =
      normalizeQuality(params.quality, "kie", internalModelId) || "720p";
    baseInput.fixed_lens = params.fixedLens ?? true;
    baseInput.generate_audio = params.generateAudio ?? false;
    // KIE documents this model-level checker explicitly. Keep it on even when
    // callers omit the field so a fallback route cannot silently weaken safety.
    baseInput.nsfw_checker = true;
  }

  return {
    input: baseInput,
  };
}

/**
 * APImart parameter transformer
 *
 * APImart uses the same endpoint for all models: POST /v1/videos/generations
 * Currently supports Seedance models (1.0 Pro Fast/Quality, 1.5 Pro).
 * To add new models, add model-specific logic below.
 */
function apimartParamsTransformer(
  internalModelId: string,
  params: Record<string, any>
): Record<string, any> {
  const imageUrls = Array.isArray(params.imageUrls)
    ? params.imageUrls
    : params.imageUrl
      ? [params.imageUrl]
      : undefined;

  const result: Record<string, any> = {
    prompt: params.prompt,
    aspect_ratio: params.aspectRatio || "16:9",
    duration: params.duration || 5,
    callback_url: params.callbackUrl,
  };

  if (imageUrls && imageUrls.length > 0) {
    result.image_urls = imageUrls;
  }

  // Seedance 1.5 Pro
  if (internalModelId === "seedance-1.5-pro") {
    result.resolution =
      normalizeQuality(params.quality, "apimart", internalModelId) || "720p";
    result.audio = params.generateAudio ?? false;
  }

  // Seedance 1.0 Pro (Fast / Quality)
  if (
    internalModelId === "seedance-1.0-pro-fast" ||
    internalModelId === "seedance-1.0-pro-quality"
  ) {
    result.resolution =
      normalizeQuality(params.quality, "apimart", internalModelId) || "1080p";
  }

  return result;
}

/** Transform unified video options to Zhipu's shared video request schema. */
function zhipuParamsTransformer(
  _internalModelId: string,
  params: Record<string, any>
): Record<string, any> {
  const duration = Math.round(Number(params.duration) || 5);
  if (![5, 10].includes(duration)) {
    throw new Error(`Zhipu video only supports 5s or 10s, received ${duration}s`);
  }
  const imageUrls = Array.isArray(params.imageUrls)
    ? params.imageUrls.filter(Boolean)
    : params.imageUrl
      ? [params.imageUrl]
      : [];
  const sizeByAspectRatio: Record<string, string> = {
    "16:9": "1280x720",
    "9:16": "720x1280",
    "1:1": "1024x1024",
    "21:9": "2048x1080",
  };
  const quality = String(params.quality || "speed").toLowerCase();

  return {
    prompt: params.prompt,
    quality: quality === "quality" ? "quality" : "speed",
    with_audio: params.generateAudio ?? false,
    // Zhipu only permits disabling the watermark after a separate waiver.
    watermark_enabled: process.env.ZHIPU_WATERMARK_ENABLED !== "false",
    size: sizeByAspectRatio[params.aspectRatio || "16:9"] || "1280x720",
    fps: 30,
    duration,
    image_url:
      imageUrls.length > 1 ? imageUrls.slice(0, 2) : imageUrls[0],
  };
}

/** Transform unified video options to Wan 2.7's multimodal request schema. */
function bailianParamsTransformer(
  _internalModelId: string,
  params: Record<string, any>
): Record<string, any> {
  const imageUrls = (
    Array.isArray(params.imageUrls)
      ? params.imageUrls
      : params.imageUrl
        ? [params.imageUrl]
        : []
  ).filter(Boolean);
  const duration = Math.round(Number(params.duration) || 5);
  if (duration < 2 || duration > 15) {
    throw new Error(`Bailian Wan video supports 2-15s, received ${duration}s`);
  }
  const aspectRatio = ["16:9", "9:16", "1:1", "4:3", "3:4"].includes(
    params.aspectRatio
  )
    ? params.aspectRatio
    : "16:9";
  const quality = String(params.quality || "speed").toLowerCase();

  const input: Record<string, any> = { prompt: params.prompt };
  if (imageUrls.length > 0) {
    input.media = imageUrls.slice(0, 2).map((url: string, index: number) => ({
      type: index === 0 ? "first_frame" : "last_frame",
      url,
    }));
  }

  return {
    input,
    parameters: {
      resolution: quality === "quality" ? "1080P" : "720P",
      duration,
      prompt_extend: true,
      watermark: false,
      ...(imageUrls.length === 0 ? { ratio: aspectRatio } : {}),
    },
  };
}

// ============================================================================
// Model Mappings
// ============================================================================

export const MODEL_MAPPINGS: Record<string, ModelMapping> = {
  // -------------------------------------------------------------------------
  // Zhipu video (the provider model is environment-configurable)
  // -------------------------------------------------------------------------
  "zhipu-video": {
    internalId: "zhipu-video",
    displayName: "AI Video",
    providers: {
      bailian: {
        providerModelId: (params) => {
          const hasImage =
            (Array.isArray(params.imageUrls) && params.imageUrls.length > 0) ||
            Boolean(params.imageUrl);
          return hasImage
            ? process.env.BAILIAN_I2V_MODEL?.trim() || "wan2.7-i2v"
            : process.env.BAILIAN_T2V_MODEL?.trim() || "wan2.7-t2v";
        },
        supported: true,
        nativeDurations: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
        transformParams: bailianParamsTransformer,
      },
      zhipu: {
        providerModelId: () =>
          process.env.ZHIPU_VIDEO_MODEL?.trim() || "cogvideox-flash",
        supported: true,
        nativeDurations: [5, 10],
        transformParams: zhipuParamsTransformer,
      },
    },
  },

  // -------------------------------------------------------------------------
  // Seedance 2.0 family (EvoLink unified generation API)
  // -------------------------------------------------------------------------
  "seedance-2.0-mini": {
    internalId: "seedance-2.0-mini",
    displayName: "Seedance 2.0 Mini",
    providers: {
      evolink: {
        providerModelId: (params) => {
          const hasImage =
            (Array.isArray(params.imageUrls) && params.imageUrls.length > 0) ||
            Boolean(params.imageUrl);
          return hasImage
            ? "seedance-2.0-mini-image-to-video"
            : "seedance-2.0-mini-text-to-video";
        },
        supported: true,
        nativeDurations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
        extendedDurations: [],
        transformParams: evolinkParamsTransformer,
      },
    },
  },
  "seedance-2.0": {
    internalId: "seedance-2.0",
    displayName: "Seedance 2.0",
    providers: {
      evolink: {
        providerModelId: (params) => {
          const hasImage =
            (Array.isArray(params.imageUrls) && params.imageUrls.length > 0) ||
            Boolean(params.imageUrl);
          return hasImage
            ? "seedance-2.0-image-to-video"
            : "seedance-2.0-text-to-video";
        },
        supported: true,
        nativeDurations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
        extendedDurations: [],
        transformParams: evolinkParamsTransformer,
      },
    },
  },

  // -------------------------------------------------------------------------
  // Sora 2
  // -------------------------------------------------------------------------
  "sora-2": {
    internalId: "sora-2",
    displayName: "Sora 2",
    providers: {
      evolink: {
        providerModelId: "sora-2",
        supported: true,
        transformParams: evolinkParamsTransformer,
      },
      kie: {
        providerModelId: (params: any) =>
          (Array.isArray(params.imageUrls) && params.imageUrls.length > 0) || params.imageUrl
            ? "sora-2-image-to-video"
            : "sora-2-text-to-video",
        supported: true,
        transformParams: kieParamsTransformer,
      },
    },
  },

  // -------------------------------------------------------------------------
  // Wan 2.6
  // -------------------------------------------------------------------------
  "wan2.6": {
    internalId: "wan2.6",
    displayName: "Wan 2.6",
    providers: {
      evolink: {
        providerModelId: (params: any) => {
          // Select model based on mode
          if (params.mode === "reference-to-video") {
            return "wan2.6-reference-video";
          }
          const hasImage =
            (Array.isArray(params.imageUrls) && params.imageUrls.length > 0) || params.imageUrl;
          return hasImage ? "wan2.6-image-to-video" : "wan2.6-text-to-video";
        },
        supported: true,
        transformParams: evolinkParamsTransformer,
      },
      kie: {
        providerModelId: (params: any) => {
          // Select model based on mode
          if (params.mode === "reference-to-video") {
            return "wan/2-6-video-to-video";
          }
          const hasImage =
            (Array.isArray(params.imageUrls) && params.imageUrls.length > 0) || params.imageUrl;
          return hasImage ? "wan/2-6-image-to-video" : "wan/2-6-text-to-video";
        },
        supported: true,
        transformParams: kieParamsTransformer,
      },
    },
  },

  // -------------------------------------------------------------------------
  // Veo 3.1
  // -------------------------------------------------------------------------
  "veo-3.1": {
    internalId: "veo-3.1",
    displayName: "Veo 3.1",
    providers: {
      evolink: {
        providerModelId: "veo3.1-fast",
        supported: true,
        transformParams: evolinkParamsTransformer,
      },
      kie: {
        providerModelId: (params: any) => {
          const quality = String(params.quality || "").toLowerCase();
          if (quality === "high" || quality === "1080p" || quality === "4k") {
            return "veo3";
          }
          return "veo3_fast";
        },
        apiEndpoint: "/api/v1/veo/generate", // Different endpoint
        supported: true,
        transformParams: (internalModelId, params) => {
          // Veo 3.1 has a different structure on KIE
          const imageUrls = Array.isArray(params.imageUrls)
            ? params.imageUrls
            : params.imageUrl
              ? [params.imageUrl]
              : undefined;

          const result: Record<string, any> = {
            prompt: params.prompt,
            aspect_ratio: params.aspectRatio || "16:9",
            callBackUrl: params.callbackUrl,
          };

          if (imageUrls && imageUrls.length > 0) {
            result.imageUrls = imageUrls;
          }

          // Determine generation type (only if explicitly provided)
          if (params.mode === "frames-to-video") {
            result.generationType = "FIRST_AND_LAST_FRAMES_2_VIDEO";
          } else if (params.mode === "reference-to-video") {
            result.generationType = "REFERENCE_2_VIDEO";
          } else if (params.mode === "text-to-video") {
            result.generationType = "TEXT_2_VIDEO";
          }

          return result;
        },
      },
    },
  },

  // -------------------------------------------------------------------------
  // Seedance 1.5 Pro
  // -------------------------------------------------------------------------
  "seedance-1.5-pro": {
    internalId: "seedance-1.5-pro",
    displayName: "Seedance 1.5 Pro",
    providers: {
      evolink: {
        providerModelId: "seedance-1.5-pro",
        supported: true,
        nativeDurations: [4, 5, 6, 7, 8, 9, 10, 11, 12],
        extendedDurations: [],
        transformParams: evolinkParamsTransformer,
      },
      kie: {
        providerModelId: "bytedance/seedance-1.5-pro",
        supported: true,
        transformParams: kieParamsTransformer,
      },
      apimart: {
        providerModelId: "doubao-seedance-1-5-pro",
        supported: true,
        transformParams: apimartParamsTransformer,
      },
    },
  },

  // -------------------------------------------------------------------------
  // Seedance 1.0 Pro Fast (APImart only)
  // -------------------------------------------------------------------------
  "seedance-1.0-pro-fast": {
    internalId: "seedance-1.0-pro-fast",
    displayName: "Seedance 1.0 Pro Fast",
    providers: {
      apimart: {
        providerModelId: "doubao-seedance-1-0-pro-fast",
        supported: true,
        transformParams: apimartParamsTransformer,
      },
    },
  },

  // -------------------------------------------------------------------------
  // Seedance 1.0 Pro Quality (APImart only)
  // -------------------------------------------------------------------------
  "seedance-1.0-pro-quality": {
    internalId: "seedance-1.0-pro-quality",
    displayName: "Seedance 1.0 Pro Quality",
    providers: {
      apimart: {
        providerModelId: "doubao-seedance-1-0-pro-quality",
        supported: true,
        transformParams: apimartParamsTransformer,
      },
    },
  },
};

const MODEL_MODE_SUPPORT: Record<
  string,
  Partial<Record<ProviderType, GenerationMode[]>>
> = {
  "zhipu-video": {
    bailian: ["text-to-video", "image-to-video"],
    zhipu: ["text-to-video", "image-to-video"],
  },
  "seedance-2.0-mini": {
    evolink: ["text-to-video", "image-to-video"],
  },
  "seedance-2.0": {
    evolink: ["text-to-video", "image-to-video"],
  },
  "sora-2": {
    evolink: ["text-to-video", "image-to-video"],
    kie: ["text-to-video", "image-to-video"],
  },
  "wan2.6": {
    evolink: ["text-to-video", "image-to-video", "reference-to-video"],
    kie: ["text-to-video", "image-to-video", "reference-to-video"],
  },
  "veo-3.1": {
    evolink: ["text-to-video", "image-to-video"],
    kie: [
      "text-to-video",
      "image-to-video",
      "reference-to-video",
      "frames-to-video",
    ],
  },
  "seedance-1.5-pro": {
    evolink: ["text-to-video", "image-to-video"],
    kie: ["text-to-video", "image-to-video"],
    apimart: ["text-to-video", "image-to-video"],
  },
  "seedance-1.0-pro-fast": {
    apimart: ["text-to-video", "image-to-video"],
  },
  "seedance-1.0-pro-quality": {
    apimart: ["text-to-video", "image-to-video"],
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get provider model ID for internal model
 */
export function getProviderModelId(
  internalModelId: string,
  provider: ProviderType,
  params?: Record<string, any>
): string {
  const mapping = MODEL_MAPPINGS[internalModelId];
  if (!mapping) {
    throw new Error(`Unknown internal model ID: ${internalModelId}`);
  }

  const providerConfig = mapping.providers[provider];
  if (!providerConfig || !providerConfig.supported) {
    throw new Error(
      `Model ${internalModelId} is not supported by provider ${provider}`
    );
  }

  const providerModelId = providerConfig.providerModelId;

  // Handle dynamic model IDs (functions)
  if (typeof providerModelId === "function") {
    return providerModelId(params || {});
  }

  return providerModelId;
}

/**
 * Get provider config for internal model
 */
export function getProviderConfig(
  internalModelId: string,
  provider: ProviderType
): ProviderModelConfig | undefined {
  const mapping = MODEL_MAPPINGS[internalModelId];
  return mapping?.providers[provider];
}

/**
 * Check if a provider supports a specific model
 */
export function isModelSupported(
  internalModelId: string,
  provider: ProviderType
): boolean {
  const mapping = MODEL_MAPPINGS[internalModelId];
  if (!mapping) return false;

  const providerConfig = mapping.providers[provider];
  return providerConfig?.supported || false;
}

/** Check whether a provider can satisfy the requested final duration. */
export function isProviderDurationSupported(
  internalModelId: string,
  provider: ProviderType,
  duration: number
): boolean {
  const providerConfig = MODEL_MAPPINGS[internalModelId]?.providers[provider];
  if (!providerConfig?.supported) return false;

  const configuredDurations = [
    ...(providerConfig.nativeDurations ?? []),
    ...(providerConfig.extendedDurations ?? []),
  ];

  // Existing providers without an explicit capability declaration continue to
  // rely on the model-level validation until their adapter is migrated.
  return configuredDurations.length === 0 || configuredDurations.includes(duration);
}

export function normalizeGenerationMode(
  mode?: string,
  hasImageInput = false
): GenerationMode {
  switch (mode) {
    case "image-to-video":
    case "reference-to-video":
    case "frames-to-video":
      return mode;
    case "text-image-to-video":
    case "t2v":
    case "text-to-video":
      return hasImageInput ? "image-to-video" : "text-to-video";
    case "i2v":
      return "image-to-video";
    case "r2v":
      return "reference-to-video";
    default:
      return hasImageInput ? "image-to-video" : "text-to-video";
  }
}

export function isModelModeSupported(
  internalModelId: string,
  provider: ProviderType,
  mode: GenerationMode
): boolean {
  if (!isModelSupported(internalModelId, provider)) {
    return false;
  }

  const supportedModes = MODEL_MODE_SUPPORT[internalModelId]?.[provider];
  if (!supportedModes) {
    return false;
  }

  return supportedModes.includes(mode);
}

/**
 * Transform parameters for a specific provider
 */
export function transformParamsForProvider(
  internalModelId: string,
  provider: ProviderType,
  params: Record<string, any>
): Record<string, any> {
  const mapping = MODEL_MAPPINGS[internalModelId];
  if (!mapping) {
    throw new Error(`Unknown internal model ID: ${internalModelId}`);
  }

  const providerConfig = mapping.providers[provider];
  if (!providerConfig || !providerConfig.supported) {
    throw new Error(
      `Model ${internalModelId} is not supported by provider ${provider}`
    );
  }

  if (providerConfig.transformParams) {
    return providerConfig.transformParams(internalModelId, params);
  }

  return params;
}

/**
 * Get all supported models for a provider
 */
export function getSupportedModels(provider: ProviderType): string[] {
  return Object.values(MODEL_MAPPINGS)
    .filter((mapping) => mapping.providers[provider]?.supported)
    .map((mapping) => mapping.internalId);
}

/**
 * Get model display name
 */
export function getModelDisplayName(internalModelId: string): string {
  const mapping = MODEL_MAPPINGS[internalModelId];
  return mapping?.displayName || internalModelId;
}
