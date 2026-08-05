import { afterEach, describe, expect, it, vi } from "vitest";

import { getWorkflowConfig, isWorkflowEnabled } from "./upstash";

const workflowEnvKeys = [
  "QSTASH_TOKEN",
  "QSTASH_CURRENT_SIGNING_KEY",
  "QSTASH_NEXT_SIGNING_KEY",
  "QSTASH_URL",
  "NEXT_PUBLIC_APP_URL",
] as const;

function clearWorkflowEnv() {
  for (const key of workflowEnvKeys) vi.stubEnv(key, "");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("QStash workflow configuration", () => {
  it("stays disabled when no QStash credentials are present", () => {
    clearWorkflowEnv();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.com");

    expect(getWorkflowConfig()).toBeNull();
    expect(isWorkflowEnabled()).toBe(false);
  });

  it("rejects a partial credential set", () => {
    clearWorkflowEnv();
    vi.stubEnv("QSTASH_TOKEN", "token");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.com");

    expect(() => getWorkflowConfig()).toThrow(/incomplete qstash/i);
  });

  it("enables sender and receiver only with the complete shared configuration", () => {
    clearWorkflowEnv();
    vi.stubEnv("QSTASH_TOKEN", "token");
    vi.stubEnv("QSTASH_CURRENT_SIGNING_KEY", "current");
    vi.stubEnv("QSTASH_NEXT_SIGNING_KEY", "next");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.com/");

    expect(getWorkflowConfig()).toMatchObject({
      token: "token",
      currentSigningKey: "current",
      nextSigningKey: "next",
      appUrl: "https://example.com",
    });
    expect(isWorkflowEnabled()).toBe(true);
  });
});
