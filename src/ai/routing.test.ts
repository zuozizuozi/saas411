import { afterEach, describe, expect, it, vi } from "vitest";

import { getProviderCandidates, isRetryableProviderError } from "./routing";

describe("AI provider routing", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("routes AI Video through Bailian first and Zhipu second", () => {
    vi.stubEnv("DEFAULT_AI_PROVIDER", "");
    vi.stubEnv("BAILIAN_API_KEY", "sk-bailian");
    vi.stubEnv("ZHIPU_API_KEY", "zhipu-key");

    expect(getProviderCandidates("zhipu-video", "text-to-video")).toEqual([
      "bailian",
      "zhipu",
    ]);
    expect(getProviderCandidates("zhipu-video", "image-to-video")).toEqual([
      "bailian",
      "zhipu",
    ]);
  });

  it("filters fallback providers by their real duration capability", () => {
    vi.stubEnv("DEFAULT_AI_PROVIDER", "");
    vi.stubEnv("BAILIAN_API_KEY", "sk-bailian");
    vi.stubEnv("ZHIPU_API_KEY", "zhipu-key");

    expect(
      getProviderCandidates("zhipu-video", "text-to-video", 10)
    ).toEqual(["bailian", "zhipu"]);
    expect(
      getProviderCandidates("zhipu-video", "text-to-video", 12)
    ).toEqual(["bailian"]);
    expect(
      getProviderCandidates("zhipu-video", "text-to-video", 30)
    ).toEqual([]);
  });

  it("routes all launch Seedance models through EvoLink", () => {
    vi.stubEnv("DEFAULT_AI_PROVIDER", "");
    vi.stubEnv("EVOLINK_API_KEY", "evolink-key");

    expect(
      getProviderCandidates("seedance-2.0-mini", "text-to-video", 15)
    ).toEqual(["evolink"]);
    expect(
      getProviderCandidates("seedance-2.0", "image-to-video", 4)
    ).toEqual(["evolink"]);
    expect(
      getProviderCandidates("seedance-1.5-pro", "text-to-video", 12)
    ).toEqual(["evolink"]);
    expect(
      getProviderCandidates("seedance-1.5-pro", "text-to-video", 13)
    ).toEqual([]);
  });

  it("falls back to model routing when a global pin cannot run Seedance", () => {
    vi.stubEnv("DEFAULT_AI_PROVIDER", "bailian");
    vi.stubEnv("BAILIAN_API_KEY", "sk-bailian");
    vi.stubEnv("EVOLINK_API_KEY", "evolink-key");

    expect(
      getProviderCandidates("seedance-2.0-mini", "text-to-video", 5)
    ).toEqual(["evolink"]);
  });

  it("keeps authentication errors terminal but retries rate limits", () => {
    expect(
      isRetryableProviderError(
        new Error("Bailian rate limit exceeded. Please retry later.")
      )
    ).toBe(true);
    expect(
      isRetryableProviderError(
        new Error("Bailian authentication failed. Check BAILIAN_API_KEY.")
      )
    ).toBe(false);
  });
});
