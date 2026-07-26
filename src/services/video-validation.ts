import { normalizeGenerationMode } from "@/ai/model-mapping";
import { getModelConfig } from "@/config/credits";
import { ApiError } from "@/lib/api/error";

export interface GenerationValidationInput {
  model: string;
  duration?: number;
  aspectRatio?: string;
  quality?: string;
  imageUrl?: string;
  imageUrls?: string[];
  mode?: string;
  outputNumber?: number;
  generateAudio?: boolean;
  removeWatermark?: boolean;
}

export function validateGenerationParams(params: GenerationValidationInput) {
  if (!Number.isInteger(params.outputNumber ?? 1)) {
    throw new ApiError("Output count must be an integer", 400);
  }
  const outputNumber = params.outputNumber ?? 1;
  if (outputNumber < 1 || outputNumber > 2) {
    throw new ApiError("Output count must be between 1 and 2", 400);
  }

  const modelConfig = getModelConfig(params.model);
  if (!modelConfig || modelConfig.enabled === false) {
    throw new ApiError(`Unsupported model: ${params.model}`, 400, {
      code: "UNSUPPORTED_MODEL",
      model: params.model,
    });
  }

  const duration = params.duration ?? modelConfig.durations[0];
  if (!duration || !modelConfig.durations.includes(duration)) {
    throw new ApiError(`Unsupported duration for ${params.model}`, 400, {
      code: "UNSUPPORTED_DURATION",
      allowed: modelConfig.durations,
    });
  }
  if (params.aspectRatio && !modelConfig.aspectRatios.includes(params.aspectRatio)) {
    throw new ApiError(`Unsupported aspect ratio for ${params.model}`, 400, {
      code: "UNSUPPORTED_ASPECT_RATIO",
      allowed: modelConfig.aspectRatios,
    });
  }
  if (
    params.quality &&
    (!modelConfig.qualities || !modelConfig.qualities.includes(params.quality))
  ) {
    throw new ApiError(`Unsupported quality for ${params.model}`, 400, {
      code: "UNSUPPORTED_QUALITY",
      allowed: modelConfig.qualities ?? [],
    });
  }
  if (params.generateAudio && !modelConfig.supportAudio) {
    throw new ApiError(`Audio generation is not supported by ${params.model}`, 400, {
      code: "AUDIO_NOT_SUPPORTED",
    });
  }

  const imageUrls = Array.from(
    new Set([...(params.imageUrls ?? []), ...(params.imageUrl ? [params.imageUrl] : [])])
  );
  if (imageUrls.length > 2) {
    throw new ApiError("Image-to-video accepts up to two source images", 400);
  }
  if (
    (params.mode === "text-to-video" || params.mode === "t2v") &&
    imageUrls.length > 0
  ) {
    throw new ApiError("Text-to-video does not accept an input image", 400);
  }
  const mode = normalizeGenerationMode(params.mode, imageUrls.length > 0);
  if (mode !== "text-to-video" && mode !== "image-to-video") {
    throw new ApiError(`Unsupported generation mode: ${mode}`, 400);
  }
  if (mode === "image-to-video" && imageUrls.length < 1) {
    throw new ApiError("Image-to-video requires one uploaded image (an optional end frame is supported)", 400, {
      code: "MISSING_INPUT_MEDIA",
    });
  }
  return { modelConfig, duration, mode, outputNumber, imageUrls };
}
