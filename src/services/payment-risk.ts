import type Stripe from "stripe";
import {
  and,
  desc,
  eq,
  inArray,
  lt,
  ne,
  notInArray,
  or,
  sql,
} from "drizzle-orm";

import {
  creditTransactions,
  creditPackages,
  db,
  paymentDisputes,
  paymentOrders,
  stripeEvents,
  users,
  videos,
} from "@/db";
import { env } from "@/lib/auth/env.mjs";
import { stripe } from "@/payment";
import { creditService } from "@/services/credit";
import { calculateCreditReversal } from "@/services/payment-reversal";

export const PAYMENT_TERMS_VERSION = "2026-08-04";

export interface PurchaseContext {
  ip?: string;
  userAgent?: string;
  termsVersion: string;
  termsAcceptedAt: Date;
}

export interface StripeEventEnvelope {
  id: string;
  type: string;
  data: { object: unknown };
}

function stripeObjectId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}

export async function recordPendingPaymentOrder(input: {
  userId: string;
  orderNo: string;
  checkoutSessionId: string;
  productId: string;
  amount: number;
  currency: string;
  credits: number;
  context: PurchaseContext;
}) {
  await db
    .insert(paymentOrders)
    .values({
      userId: input.userId,
      orderNo: input.orderNo,
      checkoutSessionId: input.checkoutSessionId,
      productId: input.productId,
      amount: input.amount,
      currency: input.currency.toLowerCase(),
      creditsGranted: input.credits,
      status: "PENDING",
      purchaseIp: input.context.ip,
      userAgent: input.context.userAgent,
      termsVersion: input.context.termsVersion,
      termsAcceptedAt: input.context.termsAcceptedAt,
      updatedAt: new Date(),
    })
    .onConflictDoNothing({ target: paymentOrders.orderNo });
}

export async function recordPaidPaymentOrder(input: {
  userId: string;
  orderNo: string;
  checkoutSessionId?: string | null;
  paymentIntentId?: string | null;
  chargeId?: string | null;
  invoiceId?: string | null;
  productId?: string | null;
  amount: number;
  currency: string;
  credits: number;
  metadata?: Stripe.Metadata | null;
}) {
  const metadata = input.metadata ?? {};
  const termsAcceptedAt = metadata.termsAcceptedAt
    ? new Date(metadata.termsAcceptedAt)
    : undefined;
  const values = {
    userId: input.userId,
    orderNo: input.orderNo,
    checkoutSessionId: input.checkoutSessionId,
    paymentIntentId: input.paymentIntentId,
    chargeId: input.chargeId,
    invoiceId: input.invoiceId,
    productId: input.productId,
    amount: input.amount,
    currency: input.currency.toLowerCase(),
    creditsGranted: input.credits,
    status: "PAID" as const,
    purchaseIp: metadata.purchaseIp,
    userAgent: metadata.userAgent,
    termsVersion: metadata.termsVersion,
    termsAcceptedAt:
      termsAcceptedAt && !Number.isNaN(termsAcceptedAt.getTime())
        ? termsAcceptedAt
        : undefined,
    updatedAt: new Date(),
  };
  await db
    .insert(paymentOrders)
    .values(values)
    .onConflictDoUpdate({
      target: paymentOrders.orderNo,
      set: {
        ...values,
        status: sql`case when ${paymentOrders.status} = 'PENDING' then 'PAID'::"PaymentOrderStatus" else ${paymentOrders.status} end`,
      },
    });
}

async function claimStripeEvent(event: StripeEventEnvelope) {
  const object = event.data.object as { id?: string };
  const inserted = await db
    .insert(stripeEvents)
    .values({
      eventId: event.id,
      eventType: event.type,
      objectId: object.id,
    })
    .onConflictDoNothing({ target: stripeEvents.eventId })
    .returning({ eventId: stripeEvents.eventId });
  if (inserted.length > 0) return true;

  const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
  const reclaimed = await db
    .update(stripeEvents)
    .set({
      status: "PROCESSING",
      attempts: sql`${stripeEvents.attempts} + 1`,
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(stripeEvents.eventId, event.id),
        or(
          eq(stripeEvents.status, "FAILED"),
          and(
            eq(stripeEvents.status, "PROCESSING"),
            lt(stripeEvents.updatedAt, staleBefore)
          )
        )
      )
    )
    .returning({ eventId: stripeEvents.eventId });
  return reclaimed.length > 0;
}

export async function processStripeEventOnce(
  event: StripeEventEnvelope,
  handler: () => Promise<void>
) {
  if (!(await claimStripeEvent(event))) return false;
  try {
    await handler();
    await db
      .update(stripeEvents)
      .set({ status: "PROCESSED", processedAt: new Date(), updatedAt: new Date() })
      .where(eq(stripeEvents.eventId, event.id));
    return true;
  } catch (error) {
    await db
      .update(stripeEvents)
      .set({
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message.slice(0, 1000) : String(error),
        updatedAt: new Date(),
      })
      .where(eq(stripeEvents.eventId, event.id));
    throw error;
  }
}

async function findOrderForCharge(charge: Stripe.Charge) {
  const paymentIntentId = stripeObjectId(charge.payment_intent);
  let [order] = await db
    .select()
    .from(paymentOrders)
    .where(
      paymentIntentId
        ? sql`${paymentOrders.chargeId} = ${charge.id} or ${paymentOrders.paymentIntentId} = ${paymentIntentId}`
        : eq(paymentOrders.chargeId, charge.id)
    )
    .limit(1);
  if (!order) {
    const chargeWithInvoice = charge as Stripe.Charge & {
      invoice?: string | Stripe.Invoice | null;
    };
    const invoiceId = stripeObjectId(chargeWithInvoice.invoice);
    let checkoutSession: Stripe.Checkout.Session | undefined;
    if (paymentIntentId) {
      const sessions = await stripe.checkout.sessions.list({
        payment_intent: paymentIntentId,
        limit: 1,
      });
      checkoutSession = sessions.data[0];
    }
    const candidateOrderNos = [
      checkoutSession ? `stripe_${checkoutSession.id}` : null,
      invoiceId ? `stripe_invoice_${invoiceId}` : null,
      invoiceId ? `stripe_upgrade_invoice_${invoiceId}` : null,
    ].filter((value): value is string => Boolean(value));
    const [legacyPackage] = candidateOrderNos.length
      ? await db
          .select()
          .from(creditPackages)
          .where(inArray(creditPackages.orderNo, candidateOrderNos))
          .limit(1)
      : [];
    if (legacyPackage?.orderNo) {
      await recordPaidPaymentOrder({
        userId: legacyPackage.userId,
        orderNo: legacyPackage.orderNo,
        checkoutSessionId: checkoutSession?.id,
        paymentIntentId,
        chargeId: charge.id,
        invoiceId,
        productId: checkoutSession?.metadata?.packageId,
        amount: charge.amount,
        currency: charge.currency,
        credits: legacyPackage.initialCredits,
        metadata: checkoutSession?.metadata,
      });
      [order] = await db
        .select()
        .from(paymentOrders)
        .where(eq(paymentOrders.orderNo, legacyPackage.orderNo))
        .limit(1);
    }
  }
  if (!order) throw new Error(`No local payment order for Stripe charge ${charge.id}`);
  if (!order.chargeId || (!order.paymentIntentId && paymentIntentId)) {
    await db
      .update(paymentOrders)
      .set({ chargeId: charge.id, paymentIntentId, updatedAt: new Date() })
      .where(eq(paymentOrders.id, order.id));
  }
  return { ...order, chargeId: charge.id, paymentIntentId };
}

export async function handleChargeRefunded(charge: Stripe.Charge) {
  const order = await findOrderForCharge(charge);
  const { targetCredits, deltaCredits } = calculateCreditReversal({
    amountPaid: order.amount,
    amountReversed: charge.amount_refunded,
    creditsGranted: order.creditsGranted,
    creditsAlreadyRevoked: order.creditsRevoked,
  });
  await creditService.revokeOrderCredits({
    paymentOrderId: order.id,
    userId: order.userId,
    orderNo: order.orderNo,
    targetCredits,
    amountRefunded: charge.amount_refunded,
    paymentStatus: charge.refunded ? "REFUNDED" : "PARTIALLY_REFUNDED",
    remark: `Stripe refund for charge ${charge.id}; delta=${deltaCredits}`,
  });
}

async function buildDisputeEvidence(order: typeof paymentOrders.$inferSelect) {
  const [account] = await db
    .select({
      email: users.email,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, order.userId))
    .limit(1);
  const recentVideos = await db
    .select({
      uuid: videos.uuid,
      status: videos.status,
      creditsUsed: videos.creditsUsed,
      createdAt: videos.createdAt,
      completedAt: videos.completedAt,
      videoUrl: videos.videoUrl,
      externalTaskId: videos.externalTaskId,
    })
    .from(videos)
    .where(eq(videos.userId, order.userId))
    .orderBy(desc(videos.createdAt))
    .limit(50);
  const transactions = await db
    .select({
      transNo: creditTransactions.transNo,
      transType: creditTransactions.transType,
      credits: creditTransactions.credits,
      orderNo: creditTransactions.orderNo,
      videoUuid: creditTransactions.videoUuid,
      createdAt: creditTransactions.createdAt,
    })
    .from(creditTransactions)
    .where(eq(creditTransactions.userId, order.userId))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(100);
  return {
    capturedAt: new Date().toISOString(),
    order: {
      orderNo: order.orderNo,
      amount: order.amount,
      currency: order.currency,
      creditsGranted: order.creditsGranted,
      purchaseIp: order.purchaseIp,
      userAgent: order.userAgent,
      termsVersion: order.termsVersion,
      termsAcceptedAt: order.termsAcceptedAt,
    },
    account,
    recentVideos,
    creditTransactions: transactions,
  };
}

async function alertAdminOfDispute(dispute: Stripe.Dispute, orderNo: string) {
  if (!env.ADMIN_EMAIL || !env.RESEND_API_KEY || !env.RESEND_FROM) return;
  try {
    const { resend } = await import("@/lib/email");
    await resend.emails.send({
      from: env.RESEND_FROM,
      to: env.ADMIN_EMAIL,
      subject: `[VideoFly] Stripe dispute ${dispute.id} needs review`,
      text: `Order ${orderNo}\nAmount ${dispute.amount} ${dispute.currency}\nReason ${dispute.reason}\nStatus ${dispute.status}\nOpen: https://dashboard.stripe.com/disputes/${dispute.id}`,
    });
  } catch (error) {
    console.error("Failed to send Stripe dispute alert", error);
  }
}

export async function handleDispute(
  event: StripeEventEnvelope,
  dispute: Stripe.Dispute
) {
  // Stripe does not guarantee webhook delivery order. Always retrieve the
  // current object so a delayed update cannot reopen a won/lost dispute.
  const currentDispute = await stripe.disputes.retrieve(dispute.id);
  const chargeId = stripeObjectId(currentDispute.charge);
  if (!chargeId) {
    throw new Error(`Stripe dispute ${currentDispute.id} has no charge`);
  }
  const charge = await stripe.charges.retrieve(chargeId);
  const order = await findOrderForCharge(charge);
  const existing = await db
    .select({ evidenceSnapshot: paymentDisputes.evidenceSnapshot })
    .from(paymentDisputes)
    .where(eq(paymentDisputes.disputeId, currentDispute.id))
    .limit(1);
  const evidence = existing[0]?.evidenceSnapshot ?? (await buildDisputeEvidence(order));
  const dueBy = currentDispute.evidence_details?.due_by
    ? new Date(currentDispute.evidence_details.due_by * 1000)
    : null;
  const isClosed =
    currentDispute.status === "won" || currentDispute.status === "lost";

  await db
    .insert(paymentDisputes)
    .values({
      disputeId: currentDispute.id,
      paymentOrderId: order.id,
      userId: order.userId,
      chargeId,
      amount: currentDispute.amount,
      currency: currentDispute.currency,
      reason: currentDispute.reason,
      status: currentDispute.status,
      dueBy,
      evidenceSnapshot: evidence,
      lastStripeEventId: event.id,
      closedAt: isClosed ? new Date() : null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: paymentDisputes.disputeId,
      set: {
        status: currentDispute.status,
        dueBy,
        evidenceSnapshot: evidence,
        lastStripeEventId: event.id,
        closedAt: isClosed ? new Date() : null,
        updatedAt: new Date(),
      },
    });

  if (currentDispute.status === "won") {
    await db
      .update(paymentOrders)
      .set({ status: "DISPUTE_WON", updatedAt: new Date() })
      .where(eq(paymentOrders.id, order.id));
    const [account] = await db
      .select({ creditDebt: users.creditDebt })
      .from(users)
      .where(eq(users.id, order.userId))
      .limit(1);
    const [otherOpenDispute] = await db
      .select({ id: paymentDisputes.disputeId })
      .from(paymentDisputes)
      .where(
        and(
          eq(paymentDisputes.userId, order.userId),
          ne(paymentDisputes.disputeId, currentDispute.id),
          notInArray(paymentDisputes.status, ["won", "lost", "warning_closed"])
        )
      )
      .limit(1);
    if ((account?.creditDebt ?? 0) === 0 && !otherOpenDispute) {
      await db
        .update(users)
        .set({ billingStatus: "ACTIVE", updatedAt: new Date() })
        .where(eq(users.id, order.userId));
    }
    return;
  }

  if (currentDispute.status === "lost") {
    await creditService.revokeOrderCredits({
      paymentOrderId: order.id,
      userId: order.userId,
      orderNo: order.orderNo,
      targetCredits: order.creditsGranted,
      paymentStatus: "DISPUTE_LOST",
      remark: `Stripe dispute lost: ${currentDispute.id}`,
    });
    await db
      .update(users)
      .set({ billingStatus: "PAYMENT_REQUIRED", updatedAt: new Date() })
      .where(eq(users.id, order.userId));
    return;
  }

  await db
    .update(paymentOrders)
    .set({ status: "DISPUTED", updatedAt: new Date() })
    .where(eq(paymentOrders.id, order.id));
  await db
    .update(users)
    .set({ billingStatus: "DISPUTE_REVIEW", updatedAt: new Date() })
    .where(eq(users.id, order.userId));
  if (event.type === "charge.dispute.created") {
    await alertAdminOfDispute(currentDispute, order.orderNo);
  }
}
