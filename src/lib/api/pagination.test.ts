import { describe, expect, it } from "vitest";

import { parsePageLimit, parsePageOffset, parsePositiveCursor } from "./pagination";

describe("bounded pagination parameters", () => {
  it("uses safe defaults and accepts boundary values", () => {
    expect(parsePageLimit(null)).toBe(20);
    expect(parsePageLimit("100")).toBe(100);
    expect(parsePageOffset(null)).toBe(0);
    expect(parsePositiveCursor("1")).toBe(1);
  });

  it.each(["0", "101", "1.5", "-1", "1e2", "abc"])(
    "rejects an invalid page limit: %s",
    (value) => {
      expect(() => parsePageLimit(value)).toThrow();
    }
  );

  it("rejects oversized offsets and non-positive cursors", () => {
    expect(() => parsePageOffset("10001")).toThrow();
    expect(() => parsePositiveCursor("0")).toThrow();
  });
});
