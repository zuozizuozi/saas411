import { describe, expect, it } from "vitest";

import {
  assessLocalContentSafety,
  parseExternalModerationDecision,
} from "./content-safety-policy";

describe("local content safety policy", () => {
  it("blocks explicit English sexual content", () => {
    expect(assessLocalContentSafety("Generate explicit pornographic sex")).toMatchObject({
      allowed: false,
      categories: expect.arrayContaining(["sexual"]),
    });
  });

  it("blocks Chinese sexual content", () => {
    expect(assessLocalContentSafety("生成一段全裸色情视频")).toMatchObject({
      allowed: false,
      categories: expect.arrayContaining(["sexual"]),
    });
  });

  it("detects sexual content involving minors", () => {
    expect(assessLocalContentSafety("underage schoolgirl erotic nude scene")).toMatchObject({
      allowed: false,
      categories: expect.arrayContaining(["sexual_minors"]),
    });
  });

  it("allows safe negations and benign medical context", () => {
    expect(assessLocalContentSafety("A fully clothed actor, no nudity or sexual content").allowed).toBe(true);
    expect(assessLocalContentSafety("A breast cancer awareness animation").allowed).toBe(true);
  });
});

describe("external moderation response parser", () => {
  it("parses safe and unsafe structured responses", () => {
    expect(parseExternalModerationDecision({ safe: true })?.allowed).toBe(true);
    expect(
      parseExternalModerationDecision({ flagged: true, categories: { sexual: 0.92 } })
    ).toMatchObject({ allowed: false });
  });

  it("returns null for an ambiguous vendor payload", () => {
    expect(parseExternalModerationDecision({ result: "completed" })).toBeNull();
  });
});
