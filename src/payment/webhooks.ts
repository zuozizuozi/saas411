import type Stripe from "stripe";
import { eq } from "drizzle-orm";

import { getOnetimeProducts, getProductExpiryDays } from "@/config/credits";
import { SubscriptionPlan, customers, db } from "@/db";
import { CreditTransType } from "@/services/credit";
import { ensureCustomer } from "@/services/customer";
import { stripe } from ".";
import {
  getSubscriptionCreditGrant,
  getSubscriptionPlan,
  isSubscriptionCreditInvoiceReason,
} from "./plans";
import { calculateProratedUpgradeCredits } from "./subscription-proration";
import {
  applyPaymentRiskAssessment,
  handleChargeRefunded,
  handleDispute,
  handleEarlyFraudWarning,
  handlePaymentIntentFailed,
  handleRadarReview,
  inspectStripePaymentRisk,
  processStripeEventOnce,
  recordPaidPaymentOrder,
  type StripeEventEnvelope,
} from "@/services/payment-risk";

async function syncSubscription(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.userId;
  if (!userId) throw new Error("Missing user id in Stripe subscription metadata");

  const localCustomer = await ensureCustomer(userId);
  if (!localCustomer) throw new Error("Failed to create local customer");

  const priceId = subscription.items.data[0]?.price.id;
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  const active = ["active", "trialing", "past_due"].includes(subscription.status);

  await db
    .update(customers)
    .set({
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: active ? priceId : null,
      stripeCurrentPeriodEnd: active
        ? new Date(subscription.current_period_end * 1000)
        : new Date(),
      plan: active ? getSubscriptionPlan(priceId) : SubscriptionPlan.FREE,
      updatedAt: new Date(),
    })
    .where(eq(customers.id, localCustomer.id));
}

async function fulfillCreditPurchase(session: Stripe.Checkout.Session) {
  const { packageId, purchaseType, userId } = session.metadata ?? {};
  if (purchaseType !== "credits" || !packageId || !userId) return false;
  if (session.payment_status !== "paid") {
    throw new Error(`Stripe credit session is not paid: ${session.id}`);
  }

  const product = getOnetimeProducts().find((item) => item.id === packageId);
  if (!product) throw new Error(`Unknown credit package: ${packageId}`);

  const risk = await inspectStripePaymentRisk(session.payment_intent);
  const order = await recordPaidPaymentOrder({
    userId,
    orderNo: `stripe_${session.id}`,
    checkoutSessionId: session.id,
    paymentIntentId: risk.paymentIntentId,
    chargeId: risk.chargeId,
    productId: product.id,
    amount: session.amount_total ?? product.price.amount,
    currency: session.currency ?? product.price.currency,
    credits: product.credits,
    creditTransType: CreditTransType.ORDER_PAY,
    creditExpiryDays: getProductExpiryDays(product),
    fulfillmentRemark: `Stripe credit purchase: ${product.name}`,
    risk,
    metadata: session.metadata,
  });
  await applyPaymentRiskAssessment(order, risk);
  return true;
}

async function fulfillSubscriptionInvoice(
  invoice: Stripe.Invoice,
  subscription: Stripe.Subscription
) {
  if (invoice.status !== "paid") {
    throw new Error(`Stripe subscription invoice is not paid: ${invoice.id}`);
  }
  if (!isSubscriptionCreditInvoiceReason(invoice.billing_reason)) {
    return false;
  }

  const userId = subscription.metadata.userId;
  if (!userId) throw new Error("Missing user id in Stripe subscription metadata");
  const invoiceData = invoice as Stripe.Invoice & {
    payment_intent?: string | Stripe.PaymentIntent | null;
    charge?: string | Stripe.Charge | null;
  };
  const risk = await inspectStripePaymentRisk(
    invoiceData.payment_intent,
    invoiceData.charge
  );

  if (invoice.billing_reason === "subscription_update") {
    const lines = await stripe.invoices.listLineItems(invoice.id, { limit: 100 });
    const credits = calculateProratedUpgradeCredits(lines.data);
    if (credits <= 0) return false;

    const targetLine = lines.data.find(
      (line) => line.proration && line.amount > 0 && line.price?.id
    );
    const targetGrant = getSubscriptionCreditGrant(targetLine?.price?.id);
    if (!targetGrant) {
      throw new Error(`Unknown Stripe upgrade price: ${targetLine?.price?.id}`);
    }

    const order = await recordPaidPaymentOrder({
      userId,
      orderNo: `stripe_upgrade_invoice_${invoice.id}`,
      paymentIntentId: risk.paymentIntentId,
      chargeId: risk.chargeId,
      invoiceId: invoice.id,
      productId: targetLine?.price?.id,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      credits,
      creditTransType: CreditTransType.SUBSCRIPTION,
      creditExpiryDays: targetGrant.expiryDays,
      fulfillmentRemark: `Stripe prorated subscription upgrade: ${targetGrant.name}`,
      risk,
      metadata: subscription.metadata,
    });
    await applyPaymentRiskAssessment(order, risk);
    return true;
  }

  const priceId = subscription.items.data[0]?.price.id;
  const grant = getSubscriptionCreditGrant(priceId);
  if (!grant) throw new Error(`Unknown Stripe subscription price: ${priceId}`);

  const order = await recordPaidPaymentOrder({
    userId,
    orderNo: `stripe_invoice_${invoice.id}`,
    paymentIntentId: risk.paymentIntentId,
    chargeId: risk.chargeId,
    invoiceId: invoice.id,
    productId: priceId,
    amount: invoice.amount_paid,
    currency: invoice.currency,
    credits: grant.credits,
    creditTransType: CreditTransType.SUBSCRIPTION,
    creditExpiryDays: grant.expiryDays,
    fulfillmentRemark: `Stripe subscription credits: ${grant.name}`,
    risk,
    metadata: subscription.metadata,
  });
  await applyPaymentRiskAssessment(order, risk);
  return true;
}

async function handleEventPayload(event: Stripe.DiscriminatedEvent) {
  if (event.type === "review.opened" || event.type === "review.closed") {
    await handleRadarReview(
      event as unknown as StripeEventEnvelope,
      event.data.object as Stripe.Review
    );
    return;
  }

  if (
    event.type === "radar.early_fraud_warning.created" ||
    event.type === "radar.early_fraud_warning.updated"
  ) {
    await handleEarlyFraudWarning(
      event as unknown as StripeEventEnvelope,
      event.data.object as Stripe.Radar.EarlyFraudWarning
    );
    return;
  }

  if (event.type === "payment_intent.payment_failed") {
    await handlePaymentIntentFailed(
      event as unknown as StripeEventEnvelope,
      event.data.object as Stripe.PaymentIntent
    );
    return;
  }

  if (event.type === "charge.refunded") {
    await handleChargeRefunded(event.data.object as Stripe.Charge);
    return;
  }

  if (
    event.type === "charge.dispute.created" ||
    event.type === "charge.dispute.updated" ||
    event.type === "charge.dispute.closed" ||
    event.type === "charge.dispute.funds_withdrawn" ||
    event.type === "charge.dispute.funds_reinstated"
  ) {
    await handleDispute(
      event as unknown as StripeEventEnvelope,
      event.data.object as Stripe.Dispute
    );
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (await fulfillCreditPurchase(session)) return;

    if (session.subscription) {
      const subscription = await stripe.subscriptions.retrieve(
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription.id
      );
      await syncSubscription(subscription);
    }
    return;
  }

  if (event.type === "invoice.payment_succeeded" || event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    if (!invoice.subscription) return;
    const subscription = await stripe.subscriptions.retrieve(
      typeof invoice.subscription === "string"
        ? invoice.subscription
        : invoice.subscription.id
    );
    await syncSubscription(subscription);
    await fulfillSubscriptionInvoice(invoice, subscription);
    return;
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    await syncSubscription(event.data.object as Stripe.Subscription);
  }
}

export async function handleEvent(event: Stripe.DiscriminatedEvent) {
  await processStripeEventOnce(
    event as unknown as StripeEventEnvelope,
    () => handleEventPayload(event)
  );
}
