import { beforeAll, describe, expect, it } from "vitest";

describe("subscription upgrade proration", () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_STRIPE_BASIC_MONTHLY_PRICE_ID = "price_go";
    process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID = "price_plus";
  });

  it("grants only the remaining-period credit difference", async () => {
    const { calculateProratedUpgradeCredits } = await import(
      "./subscription-proration"
    );
    const credits = calculateProratedUpgradeCredits([
      {
        amount: -495,
        proration: true,
        price: { id: "price_go", unit_amount: 990 },
        quantity: 1,
      },
      {
        amount: 1495,
        proration: true,
        price: { id: "price_plus", unit_amount: 2990 },
        quantity: 1,
      },
    ]);

    expect(credits).toBe(310);
  });

  it("never removes credits on a downgrade", async () => {
    const { calculateProratedUpgradeCredits } = await import(
      "./subscription-proration"
    );
    expect(
      calculateProratedUpgradeCredits([
        {
          amount: -1495,
          proration: true,
          price: { id: "price_plus", unit_amount: 2990 },
        },
        {
          amount: 495,
          proration: true,
          price: { id: "price_go", unit_amount: 990 },
        },
      ])
    ).toBe(0);
  });
});
