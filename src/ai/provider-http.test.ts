import { describe, expect, it } from "vitest";

import { requireProviderTaskId } from "./provider-http";

describe("requireProviderTaskId", () => {
  it("accepts a non-empty provider task id", () => {
    expect(requireProviderTaskId("task_123", "test")).toBe("task_123");
  });

  it.each([undefined, null, "", "   "])("rejects invalid task id %s", (value) => {
    expect(() => requireProviderTaskId(value, "test")).toThrow(
      "test returned an invalid task id"
    );
  });
});
