import { customers, db } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { stripe } from "@/payment";
import { pricingData } from "@/payment/subscriptions";
import { getOnetimeProducts } from "@/config/credits";
import { eq } from "drizzle-orm";
import { ensureCustomer } from "./customer";

export type UserSubscriptionPlan = {
  title: string;
  description: string;
  benefits: string[];
  limitations: string[];
  prices: {
    monthly: number;
    yearly: number;
  };
  stripeIds: {
    monthly: string | null;
    yearly: string | null;
  };
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  stripeCurrentPeriodEnd: number;
  isPaid: boolean;
  interval: "month" | "year" | null;
  isCanceled?: boolean;
};

export async function createStripeSession(userId: string, planId: string) {
  const requestedPlan = pricingData.some(
    (plan) => plan.stripeIds.monthly === planId || plan.stripeIds.yearly === planId
  );
  if (!requestedPlan) {
    throw new Error("Unknown Stripe price ID");
  }

  // Every Stripe flow needs a local customer row before the webhook arrives.
  // This also makes a first purchase work for users who never opened settings.
  const customer = await ensureCustomer(userId);

  const returnUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
    : "/dashboard";

  if (customer?.plan && customer.plan !== "FREE" && customer.stripeCustomerId) {
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.stripeCustomerId,
      return_url: returnUrl,
    });
    return { success: true as const, url: session.url };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { success: false as const, url: null };
  }
  const email = user.email!;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: email,
    client_reference_id: userId,
    subscription_data: { metadata: { userId } },
    cancel_url: returnUrl,
    success_url: returnUrl,
    line_items: [{ price: planId, quantity: 1 }],
  });

  if (!session.url) return { success: false as const, url: null };
  return { success: true as const, url: session.url };
}

export async function createStripeCreditSession(userId: string, packageId: string) {
  const product = getOnetimeProducts().find((item) => item.id === packageId);
  if (!product) throw new Error("Unknown credit package");

  const user = await getCurrentUser();
  if (!user || user.id !== userId) {
    return { success: false as const, url: null };
  }

  const returnUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/credits`
    : "/credits";
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: user.email,
    client_reference_id: userId,
    metadata: {
      purchaseType: "credits",
      packageId: product.id,
      credits: String(product.credits),
      userId,
    },
    cancel_url: returnUrl,
    success_url: `${returnUrl}?checkout=success`,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: product.price.currency.toLowerCase(),
          unit_amount: product.price.amount,
          product_data: { name: product.name },
        },
      },
    ],
  });

  if (!session.url) return { success: false as const, url: null };
  return { success: true as const, url: session.url };
}

export async function getUserPlans(userId: string): Promise<UserSubscriptionPlan | undefined> {
  const [custom] = await db
    .select({
      plan: customers.plan,
      stripeSubscriptionId: customers.stripeSubscriptionId,
      stripeCurrentPeriodEnd: customers.stripeCurrentPeriodEnd,
      stripeCustomerId: customers.stripeCustomerId,
      stripePriceId: customers.stripePriceId,
    })
    .from(customers)
    .where(eq(customers.authUserId, userId))
    .limit(1);

  if (!custom) {
    return {
      ...pricingData[0]!,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      stripePriceId: null,
      stripeCurrentPeriodEnd: 0,
      isPaid: false,
      interval: null,
      isCanceled: false,
    };
  }

  const entitlementPlan = custom.plan ?? "FREE";
  const periodIsCurrent =
    !custom.stripeCurrentPeriodEnd ||
    custom.stripeCurrentPeriodEnd.getTime() + 86_400_000 > Date.now();
  const isPaid = entitlementPlan !== "FREE" && periodIsCurrent;

  const stripePlan =
    pricingData.find((plan) => plan.stripeIds.monthly === custom.stripePriceId) ??
    pricingData.find((plan) => plan.stripeIds.yearly === custom.stripePriceId);
  const entitlementPlanIndex = {
    FREE: 0,
    BASIC: 1,
    PRO: 2,
    BUSINESS: 3,
  }[entitlementPlan];
  const customPlan = stripePlan ?? pricingData[entitlementPlanIndex];
  const plan = isPaid && customPlan ? customPlan : pricingData[0]!;

  const interval = isPaid
      ? stripePlan?.stripeIds.monthly === custom.stripePriceId
        ? "month"
      : stripePlan?.stripeIds.yearly === custom.stripePriceId
        ? "year"
        : null
    : null;

  let isCanceled = false;
  if (isPaid && custom.stripeSubscriptionId) {
    const stripePlan = await stripe.subscriptions.retrieve(
      custom.stripeSubscriptionId
    );
    isCanceled = stripePlan.cancel_at_period_end;
  }

  return {
    ...plan,
    ...custom,
    stripeCurrentPeriodEnd: custom.stripeCurrentPeriodEnd?.getTime() ?? 0,
    isPaid,
    interval,
    isCanceled,
  };
}

export async function getMySubscription(userId: string) {
  const [customer] = await db
    .select({
      plan: customers.plan,
      stripeCurrentPeriodEnd: customers.stripeCurrentPeriodEnd,
    })
    .from(customers)
    .where(eq(customers.authUserId, userId))
    .limit(1);

  if (!customer) return null;
  return {
    plan: customer.plan,
    endsAt: customer.stripeCurrentPeriodEnd,
  };
}
