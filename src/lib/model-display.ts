const PUBLIC_MODEL_NAMES: Record<string, string> = {
  "zhipu-video": "AI Video",
};

/** Keep provider and internal routing names out of user-facing generation UI. */
export function getPublicModelName(modelId?: string | null): string {
  if (!modelId) return "N/A";
  return PUBLIC_MODEL_NAMES[modelId] || modelId;
}
