import { describe, expect, it } from "vitest";

import { getVideoProgress } from "./video-progress";

describe("getVideoProgress", () => {
  it("uses and clamps live provider progress for active generation", () => {
    expect(getVideoProgress("PENDING", 0)).toBe(0);
    expect(getVideoProgress("GENERATING", 42.4)).toBe(42);
    expect(getVideoProgress("GENERATING", 120)).toBe(98);
    expect(getVideoProgress("GENERATING", -5)).toBe(0);
  });

  it("reserves 99% for local finalization and 100% for completion", () => {
    expect(getVideoProgress("UPLOADING", 100)).toBe(99);
    expect(getVideoProgress("RETRYING", 80)).toBe(99);
    expect(getVideoProgress("COMPLETED", 12)).toBe(100);
  });

  it("does not invent provider progress when none is available", () => {
    expect(getVideoProgress("PENDING")).toBe(0);
    expect(getVideoProgress("GENERATING")).toBe(0);
    expect(getVideoProgress("FAILED", 75)).toBe(0);
  });
});

