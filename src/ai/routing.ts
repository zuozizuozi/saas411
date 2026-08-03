import type { ProviderType } from "./types";
import {
  isModelModeSupported,
  isModelSupported,
  isProviderDurationSupported,
  type GenerationMode,
} from "./model-mapping";
import { getConfiguredAIProvider, getProviderApiKey } from "./provider-config";

/**
 * Product-owned routing policy. Adding a model should only require registering
 * its provider mappings and updating this policy; UI components never choose a
 * provider directly.
 */
export interface ModelRoutePolicy {
  primary: ProviderType;
  fallbacks: ProviderType[];
}

const MODEL_ROUTE_POLICIES: Record<string, ModelRoutePolicy> = {
  "zhipu-video": { primary: "bailian", fallbacks: ["zhipu"] },
  "seedance-2.0-mini": { primary: "evolink", fallbacks: [] },
  "seedance-2.0": { primary: "evolink", fallbacks: [] },
  "seedance-1.5-pro": { primary: "evolink", fallbacks: ["apimart", "kie"] },
  "seedance-1.0-pro-fast": { primary: "apimart", fallbacks: [] },
  "seedance-1.0-pro-quality": { primary: "apimart", fallbacks: [] },
  "sora-2": { primary: "evolink", fallbacks: ["kie"] },
  "wan2.6": { primary: "evolink", fallbacks: ["kie"] },
  "veo-3.1": { primary: "evolink", fallbacks: ["kie"] },
};

/**
 * Returns candidates in deterministic order. DEFAULT_AI_PROVIDER is honored
 * when it supports the requested model; otherwise the model policy is used.
 */
export function getProviderCandidates(
  modelId: string,
  mode: GenerationMode,
  duration?: number
): ProviderType[] {
  const pinnedProvider = getConfiguredAIProvider();
  const policyCandidates = [
    MODEL_ROUTE_POLICIES[modelId]?.primary,
    ...(MODEL_ROUTE_POLICIES[modelId]?.fallbacks ?? []),
  ].filter((provider): provider is ProviderType => Boolean(provider));

  const filterEligible = (requested: ProviderType[]) =>
    [...new Set(requested)].filter(
    (provider) =>
      Boolean(getProviderApiKey(provider)) &&
      isModelSupported(modelId, provider) &&
      isModelModeSupported(modelId, provider, mode) &&
      (duration === undefined ||
        isProviderDurationSupported(modelId, provider, duration))
  );

  // Keep an explicit deployment pin when it can actually run the model. If it
  // cannot, fall back to the model-owned policy instead of hiding the model.
  if (pinnedProvider) {
    const pinnedCandidates = filterEligible([pinnedProvider]);
    if (pinnedCandidates.length > 0) return pinnedCandidates;
  }

  return filterEligible(policyCandidates);
}

export function getModelRoutePolicy(modelId: string): ModelRoutePolicy | null {
  return MODEL_ROUTE_POLICIES[modelId] ?? null;
}

export function isRetryableProviderError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /rate limit|429|timeout|timed out|network|fetch failed|502|503|504/i.test(
    message
  );
}
