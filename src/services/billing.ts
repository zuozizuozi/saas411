import { customers, db } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { stripe } from "@/payment";
import { pricingData } from "@/payment/subscriptions";
import type { BillingPeriod } from "@/config/price/price-data";
import { getOnetimeProducts } from "@/config/credits";
import {
  getSubscriptionPriceDetails,
  type SubscriptionPriceDetails,
} from "@/payment/plans";
import {
  calculateProratedUpgradeCredits,
  calculateProrationCharge,
  type ProrationLine,
} from "@/payment/subscription-proration";
import { eq } from "drizzle-orm";
import { ensureCustomer } from "./customer";
import {
  type PurchaseContext,
  recordPendingPaymentOrder,
} from "./payment-risk";

export type UserSubscriptionPlan = {
  title: string;
  description: string;
  benefits: string[];
  limitations: string[];
  prices: Record<BillingPeriod, number>;
  stripeIds: Record<BillingPeriod, string | null>;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  stripeCurrentPeriodEnd: number;
  isPaid: boolean;
  interval: BillingPeriod | null;
  isCanceled?: boolean;
};

export type StripeSubscriptionChangePreview =
  | { kind: "checkout" }
  | { kind: "portal"; url: string }
  | {
      kind: "upgrade";
      targetPriceId: string;
      prorationDate: number;
      amount: number;
      currency: string;
      credits: number;
      currentPlan: string;
      targetPlan: string;
    };

function assertSupportedPrice(priceId: string): SubscriptionPriceDetails {
  const details = getSubscriptionPriceDetails(priceId);
  if (!details) throw new Error("Unknown Stripe price ID");
  return details;
}

function getSubscriptionItem(subscription: Awaited<ReturnType<typeof stripe.subscriptions.retrieve>>) {
  const item = subscription.items.data[0];
  if (!item || subscription.items.data.length !== 1) {
    throw new Error("Subscription must contain exactly one plan");
  }
  return item;
}

async function getOwnedSubscription(userId: string, targetPriceId: string) {
  const target = assertSupportedPrice(targetPriceId);
  const customer = await ensureCustomer(userId);
  if (!customer?.stripeSubscriptionId || !customer.stripeCustomerId) {
    return { customer, target, subscription: null, item: null, current: null };
  }

  const subscription = await stripe.subscriptions.retrieve(
    customer.stripeSubscriptionId
  );
  const stripeCustomerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  if (stripeCustomerId !== customer.stripeCustomerId) {
    throw new Error("Stripe subscription ownership mismatch");
  }
  if (subscription.metadata.userId !== userId) {
    throw new Error("Stripe subscription user mismatch");
  }

  const item = getSubscriptionItem(subscription);
  const current = assertSupportedPrice(item.price.id);
  return { customer, target, subscription, item, current };
}

function isImmediateUpgrade(
  current: SubscriptionPriceDetails,
  target: SubscriptionPriceDetails
) {
  return current.period === target.period && target.rank > current.rank;
}

async function previewUpgradeInvoice(
  subscriptionId: string,
  itemId: string,
  targetPriceId: string,
  prorationDate: number
) {
  return stripe.invoices.retrieveUpcoming({
    subscription: subscriptionId,
    subscription_items: [{ id: itemId, price: targetPriceId }],
    subscription_proration_behavior: "always_invoice",
    subscription_proration_date: prorationDate,
  });
}

function toProrationLines(lines: { data: unknown[] }): ProrationLine[] {
  return lines.data as ProrationLine[];
}

export async function previewStripeSubscriptionChange(
  userId: string,
  targetPriceId: string
): Promise<StripeSubscriptionChangePreview> {
  const { customer, target, subscription, item, current } =
    await getOwnedSubscription(userId, targetPriceId);

  if (!subscription || !item || !current || !customer?.stripeCustomerId) {
    return { kind: "checkout" };
  }

  if (!isImmediateUpgrade(current, target)) {
    const returnUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
      : "/dashboard";
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.stripeCustomerId,
      return_url: returnUrl,
    });
    return { kind: "portal", url: session.url };
  }

  const prorationDate = Math.floor(Date.now() / 1000);
  const invoice = await previewUpgradeInvoice(
    subscription.id,
    item.id,
    targetPriceId,
    prorationDate
  );
  const lines = toProrationLines(invoice.lines);
  const credits = calculateProratedUpgradeCredits(lines, prorationDate);

  return {
    kind: "upgrade",
    targetPriceId,
    prorationDate,
    amount: calculateProrationCharge(lines, prorationDate),
    currency: invoice.currency,
    credits,
    currentPlan: current.name,
    targetPlan: target.name,
  };
}

export async function confirmStripeSubscriptionUpgrade(
  userId: string,
  targetPriceId: string,
  prorationDate: number,
  context: PurchaseContext
) {
  const now = Math.floor(Date.now() / 1000);
  if (prorationDate > now + 30 || now - prorationDate > 10 * 60) {
    throw new Error("Upgrade quote expired. Please request a new quote.");
  }

  const { target, subscription, item, current } = await getOwnedSubscription(
    userId,
    targetPriceId
  );
  if (!subscription || !item || !current || !isImmediateUpgrade(current, target)) {
    throw new Error("This subscription is no longer eligible for that upgrade");
  }

  // Re-preview with the exact timestamp shown to the user so both the charge
  // and the incremental credits remain aligned with Stripe's calculation.
  const preview = await previewUpgradeInvoice(
    subscription.id,
    item.id,
    targetPriceId,
    prorationDate
  );
  const credits = calculateProratedUpgradeCredits(
    toProrationLines(preview.lines),
    prorationDate
  );
  if (credits <= 0) throw new Error("Upgrade has no incremental credits");

  const updated = await stripe.subscriptions.update(
    subscription.id,
    {
      items: [{ id: item.id, price: targetPriceId }],
      payment_behavior: "pending_if_incomplete",
      proration_behavior: "always_invoice",
      proration_date: prorationDate,
      metadata: {
        ...subscription.metadata,
        ...purchaseMetadata(userId, context),
      },
    },
    { idempotencyKey: `subscription-upgrade:${subscription.id}:${targetPriceId}:${prorationDate}` }
  );

  const latestInvoiceId =
    typeof updated.latest_invoice === "string"
      ? updated.latest_invoice
      : updated.latest_invoice?.id;
  const invoice = latestInvoiceId
    ? await stripe.invoices.retrieve(latestInvoiceId)
    : null;

  return {
    success: true as const,
    credits,
    paymentPending: Boolean(updated.pending_update),
    url:
      invoice && invoice.status !== "paid"
        ? invoice.hosted_invoice_url ?? null
        : null,
  };
}

function purchaseMetadata(userId: string, context: PurchaseContext) {
  return {
    userId,
    purchaseIp: context.ip ?? "unknown",
    userAgent: context.userAgent?.slice(0, 500) ?? "unknown",
    termsVersion: context.termsVersion,
    termsAcceptedAt: context.termsAcceptedAt.toISOString(),
  };
}

export async function createStripeSession(
  userId: string,
  planId: string,
  context: PurchaseContext
) {
  assertSupportedPrice(planId);

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
    subscription_data: { metadata: purchaseMetadata(userId, context) },
    cancel_url: returnUrl,
    success_url: returnUrl,
    line_items: [{ price: planId, quantity: 1 }],
  });

  if (!session.url) return { success: false as const, url: null };
  return { success: true as const, url: session.url };
}

export async function createStripeCreditSession(
  userId: string,
  packageId: string,
  context: PurchaseContext
) {
  const product = getOnetimeProducts().find((item) => item.id === packageId);
  if (!product) throw new Error("Unknown credit package");

  const user = await getCurrentUser();
  if (!user || user.id !== userId) {
    return { success: false as const, url: null };
  }

  const returnUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/credits`
    : "/credits";
  const metadata = {
    ...purchaseMetadata(userId, context),
    purchaseType: "credits",
    packageId: product.id,
    credits: String(product.credits),
  };
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: user.email,
    client_reference_id: userId,
    metadata,
    payment_intent_data: { metadata },
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
  await recordPendingPaymentOrder({
    userId,
    orderNo: `stripe_${session.id}`,
    checkoutSessionId: session.id,
    productId: product.id,
    amount: product.price.amount,
    currency: product.price.currency,
    credits: product.credits,
    context,
  });
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

  const stripePlan = custom.stripePriceId
    ? pricingData.find((plan) =>
        Object.values(plan.stripeIds).includes(custom.stripePriceId)
      )
    : undefined;
  const entitlementPlanIndex = {
    FREE: 0,
    BASIC: 1,
    PRO: 2,
    BUSINESS: 3,
  }[entitlementPlan];
  const customPlan = stripePlan ?? pricingData[entitlementPlanIndex];
  const plan = isPaid && customPlan ? customPlan : pricingData[0]!;

  const interval = isPaid && stripePlan
    ? (Object.entries(stripePlan.stripeIds).find(
        ([, priceId]) => priceId === custom.stripePriceId
      )?.[0] as BillingPeriod | undefined) ?? null
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
