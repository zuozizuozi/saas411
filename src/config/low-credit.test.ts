import { describe, expect, it } from "vitest";

import {
  LOW_CREDIT_FIXED_THRESHOLD,
  getLowCreditState,
} from "./low-credit";

describe("low credit reminder", () => {
  it("blocks when the current request cannot be funded", () => {
    expect(getLowCreditState(40, 68)).toMatchObject({
      canGenerate: false,
      shouldWarn: false,
      remainingAfterGeneration: 0,
    });
  });

  it("warns without blocking when the remaining balance is low", () => {
    expect(getLowCreditState(150, 68)).toMatchObject({
      canGenerate: true,
      shouldWarn: true,
      remainingAfterGeneration: 82,
      warningThreshold: LOW_CREDIT_FIXED_THRESHOLD,
    });
  });

  it("uses the current request cost as the dynamic threshold", () => {
    expect(getLowCreditState(350, 150)).toMatchObject({
      canGenerate: true,
      shouldWarn: false,
      remainingAfterGeneration: 200,
      warningThreshold: 150,
    });
  });
});
