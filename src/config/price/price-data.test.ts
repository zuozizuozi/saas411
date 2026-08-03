import { describe, expect, it } from "vitest";

import { CREDIT_PACKAGES, SUBSCRIPTION_PRODUCTS } from "../pricing-user";
import { priceDataMap } from "./price-data";

describe("pricing catalogue", () => {
  it("publishes the approved monthly, quarterly, and yearly prices", () => {
    expect(priceDataMap.en.map(({ id, prices, credits }) => ({ id, prices, credits })))
      .toEqual([
        {
          id: "go",
          prices: { month: 9.9, quarter: 28.22, year: 106.92 },
          credits: { month: 280, quarter: 840, year: 3360 },
        },
        {
          id: "plus",
          prices: { month: 29.9, quarter: 85.22, year: 322.92 },
          credits: { month: 900, quarter: 2700, year: 10800 },
        },
        {
          id: "pro",
          prices: { month: 79.9, quarter: 227.72, year: 862.92 },
          credits: { month: 2520, quarter: 7560, year: 30240 },
        },
      ]);
  });

  it("keeps capabilities identical across all paid subscription tiers", () => {
    const featureSets = SUBSCRIPTION_PRODUCTS.map((product) => product.features);
    for (const featureSet of featureSets.slice(1)) {
      expect(featureSet).toEqual(featureSets[0]);
    }
    expect(featureSets[0]).not.toContain("api_access");
    expect(featureSets[0]).not.toContain("priority_support");
    expect(featureSets[0]).not.toContain("commercial_use");
    expect(featureSets[0]).not.toContain("no_watermark");
  });

  it("allows every registered user to purchase any one-time pack", () => {
    expect(CREDIT_PACKAGES.map(({ priceUsd, credits, allowFreeUser }) => ({
      priceUsd,
      credits,
      allowFreeUser,
    }))).toEqual([
      { priceUsd: 14.9, credits: 280, allowFreeUser: true },
      { priceUsd: 39.9, credits: 900, allowFreeUser: true },
      { priceUsd: 99.9, credits: 2520, allowFreeUser: true },
    ]);
  });
});
