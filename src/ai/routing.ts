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
  "seedance-1.5-pro": { primary: "apimart", fallbacks: ["evolink", "kie"] },
  "seedance-1.0-pro-fast": { primary: "apimart", fallbacks: [] },
  "seedance-1.0-pro-quality": { primary: "apimart", fallbacks: [] },
  "sora-2": { primary: "evolink", fallbacks: ["kie"] },
  "wan2.6": { primary: "evolink", fallbacks: ["kie"] },
  "veo-3.1": { primary: "evolink", fallbacks: ["kie"] },
};

/**
 * Returns candidates in deterministic order. DEFAULT_AI_PROVIDER remains a
 * deployment pin: when configured, no automatic fallback is attempted.
 */
export function getProviderCandidates(
  modelId: string,
  mode: GenerationMode,
  duration?: number
): ProviderType[] {
  const pinnedProvider = getConfiguredAIProvider();
  const requested = pinnedProvider
    ? [pinnedProvider]
    : [
        MODEL_ROUTE_POLICIES[modelId]?.primary,
        ...(MODEL_ROUTE_POLICIES[modelId]?.fallbacks ?? []),
      ].filter((provider): provider is ProviderType => Boolean(provider));

  return [...new Set(requested)].filter(
    (provider) =>
      Boolean(getProviderApiKey(provider)) &&
      isModelSupported(modelId, provider) &&
      isModelModeSupported(modelId, provider, mode) &&
      (duration === undefined ||
        isProviderDurationSupported(modelId, provider, duration))
  );
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
