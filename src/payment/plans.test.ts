import { describe, expect, it } from "vitest";

import { isSubscriptionCreditInvoiceReason } from "./plans";

describe("isSubscriptionCreditInvoiceReason", () => {
  it.each(["subscription_create", "subscription_cycle"])(
    "grants recurring credits for %s",
    (reason) => {
      expect(isSubscriptionCreditInvoiceReason(reason)).toBe(true);
    }
  );

  it.each([null, "subscription_update", "manual", "upcoming"])(
    "does not grant credits for %s",
    (reason) => {
      expect(isSubscriptionCreditInvoiceReason(reason)).toBe(false);
    }
  );
});
