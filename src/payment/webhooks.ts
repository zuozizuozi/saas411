import type Stripe from "stripe";
import { eq } from "drizzle-orm";

import { getOnetimeProducts } from "@/config/credits";
import { SubscriptionPlan, customers, db } from "@/db";
import { CreditTransType, creditService } from "@/services/credit";
import { ensureCustomer } from "@/services/customer";
import { stripe } from ".";
import {
  getSubscriptionCreditGrant,
  getSubscriptionPlan,
  isSubscriptionCreditInvoiceReason,
} from "./plans";
import { calculateProratedUpgradeCredits } from "./subscription-proration";

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

  await creditService.recharge({
    userId,
    credits: product.credits,
    orderNo: `stripe_${session.id}`,
    transType: CreditTransType.ORDER_PAY,
    expiryDays: product.expireDays,
    remark: `Stripe credit purchase: ${product.name}`,
  });
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

    await creditService.recharge({
      userId,
      credits,
      orderNo: `stripe_upgrade_invoice_${invoice.id}`,
      transType: CreditTransType.SUBSCRIPTION,
      expiryDays: targetGrant.expiryDays,
      remark: `Stripe prorated subscription upgrade: ${targetGrant.name}`,
    });
    return true;
  }

  const priceId = subscription.items.data[0]?.price.id;
  const grant = getSubscriptionCreditGrant(priceId);
  if (!grant) throw new Error(`Unknown Stripe subscription price: ${priceId}`);

  await creditService.recharge({
    userId,
    credits: grant.credits,
    orderNo: `stripe_invoice_${invoice.id}`,
    transType: CreditTransType.SUBSCRIPTION,
    expiryDays: grant.expiryDays,
    remark: `Stripe subscription credits: ${grant.name}`,
  });
  return true;
}

export async function handleEvent(event: Stripe.DiscriminatedEvent) {
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
