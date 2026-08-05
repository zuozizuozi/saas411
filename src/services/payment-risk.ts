import type Stripe from "stripe";
import {
  and,
  desc,
  eq,
  inArray,
  lt,
  notInArray,
  or,
  sql,
} from "drizzle-orm";

import {
  CreditTransType,
  type PaymentOrder,
  creditTransactions,
  creditPackages,
  db,
  paymentDisputes,
  paymentOrders,
  paymentRiskEvents,
  stripeEvents,
  users,
  videos,
} from "@/db";
import { env } from "@/lib/auth/env.mjs";
import { stripe } from "@/payment";
import { creditService } from "@/services/credit";
import { calculateCreditReversal } from "@/services/payment-reversal";
import {
  assessPaymentRisk,
  type PaymentRiskAssessment,
} from "@/services/payment-risk-policy";

export const PAYMENT_TERMS_VERSION = "2026-08-06";

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

type RiskPaymentIntent = Stripe.PaymentIntent & {
  latest_charge?: string | Stripe.Charge | null;
  review?: string | Stripe.Review | null;
};

type RiskCharge = Stripe.Charge & {
  outcome?: {
    risk_level?: string | null;
    risk_score?: number | null;
  } | null;
  payment_method_details?: {
    card?: {
      three_d_secure?: {
        result?: string | null;
        authentication_flow?: string | null;
        liability_shift?: string | null;
      } | null;
    } | null;
  } | null;
};

export interface StripePaymentRiskSnapshot extends PaymentRiskAssessment {
  paymentIntentId: string | null;
  chargeId: string | null;
  threeDSecureResult: string | null;
  liabilityShift: boolean | null;
}

export async function inspectStripePaymentRisk(
  paymentIntentValue: unknown,
  chargeValue?: unknown
): Promise<StripePaymentRiskSnapshot> {
  const paymentIntentId = stripeObjectId(
    paymentIntentValue as string | { id: string } | null | undefined
  );
  let intent: RiskPaymentIntent | null = null;
  if (paymentIntentId) {
    intent = (await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge", "review"],
    })) as RiskPaymentIntent;
  }

  const expandedCharge =
    intent?.latest_charge && typeof intent.latest_charge !== "string"
      ? (intent.latest_charge as RiskCharge)
      : null;
  const chargeId =
    stripeObjectId(intent?.latest_charge) ??
    stripeObjectId(chargeValue as string | { id: string } | null | undefined);
  const charge = expandedCharge ??
    (chargeId ? ((await stripe.charges.retrieve(chargeId)) as RiskCharge) : null);
  const reviewId = stripeObjectId(intent?.review);
  const riskLevel = charge?.outcome?.risk_level ?? null;
  const riskScore = charge?.outcome?.risk_score ?? null;
  const threeDSecure = charge?.payment_method_details?.card?.three_d_secure;
  const threeDSecureResult = threeDSecure
    ? [threeDSecure.result, threeDSecure.authentication_flow].filter(Boolean).join(":") ||
      "attempted"
    : null;
  const liabilityShift = threeDSecure?.liability_shift
    ? threeDSecure.liability_shift === "possible"
    : null;
  const assessment = assessPaymentRisk({ reviewId, riskLevel, riskScore });

  return {
    ...assessment,
    paymentIntentId,
    chargeId,
    threeDSecureResult,
    liabilityShift,
  };
}

export async function recordPendingPaymentOrder(input: {
  userId: string;
  orderNo: string;
  checkoutSessionId: string;
  productId: string;
  amount: number;
  currency: string;
  credits: number;
  creditExpiryDays: number;
  fulfillmentRemark: string;
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
      creditTransType: CreditTransType.ORDER_PAY,
      creditExpiryDays: input.creditExpiryDays,
      fulfillmentRemark: input.fulfillmentRemark,
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
  creditTransType: "ORDER_PAY" | "SUBSCRIPTION";
  creditExpiryDays: number;
  fulfillmentRemark: string;
  risk: StripePaymentRiskSnapshot;
  fulfilledAt?: Date | null;
  metadata?: Stripe.Metadata | null;
}): Promise<PaymentOrder> {
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
    riskStatus: input.risk.decision,
    riskLevel: input.risk.riskLevel,
    riskScore: input.risk.riskScore,
    riskReason: input.risk.reason,
    reviewId: input.risk.reviewId,
    threeDSecureResult: input.risk.threeDSecureResult,
    liabilityShift: input.risk.liabilityShift,
    riskEvaluatedAt: new Date(),
    creditTransType: input.creditTransType,
    creditExpiryDays: input.creditExpiryDays,
    fulfillmentRemark: input.fulfillmentRemark,
    fulfilledAt: input.fulfilledAt,
    purchaseIp: metadata.purchaseIp,
    userAgent: metadata.userAgent,
    termsVersion: metadata.termsVersion,
    termsAcceptedAt:
      termsAcceptedAt && !Number.isNaN(termsAcceptedAt.getTime())
        ? termsAcceptedAt
        : undefined,
    updatedAt: new Date(),
  };
  const [order] = await db
    .insert(paymentOrders)
    .values(values)
    .onConflictDoUpdate({
      target: paymentOrders.orderNo,
      set: {
        ...values,
        status: sql`case when ${paymentOrders.status} = 'PENDING' then 'PAID'::"PaymentOrderStatus" else ${paymentOrders.status} end`,
        riskStatus: sql`case when ${paymentOrders.riskStatus} in ('BLOCKED', 'EFW', 'RESOLVED') then ${paymentOrders.riskStatus} else ${input.risk.decision}::"PaymentRiskStatus" end`,
        reviewId: sql`coalesce(${input.risk.reviewId}, ${paymentOrders.reviewId})`,
      },
    })
    .returning();
  if (!order) throw new Error(`Failed to record payment order ${input.orderNo}`);
  return order;
}

async function recordPaymentRiskEvent(input: {
  eventKey: string;
  paymentOrderId?: number | null;
  userId?: string | null;
  source: string;
  action: string;
  status: string;
  riskLevel?: string | null;
  riskScore?: number | null;
  stripeObjectId?: string | null;
  reason: string;
  metadata?: Record<string, unknown>;
}) {
  await db
    .insert(paymentRiskEvents)
    .values(input)
    .onConflictDoNothing({ target: paymentRiskEvents.eventKey });
}

async function placeAccountInPaymentReview(userId: string) {
  await db
    .update(users)
    .set({ billingStatus: "PAYMENT_REVIEW", updatedAt: new Date() })
    .where(eq(users.id, userId));
}

async function restoreAccountAfterPaymentReview(userId: string) {
  const [account] = await db
    .select({
      creditDebt: users.creditDebt,
      billingStatus: users.billingStatus,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (
    !account ||
    account.creditDebt > 0 ||
    !["PAYMENT_REVIEW", "DISPUTE_REVIEW"].includes(account.billingStatus)
  ) {
    return;
  }
  const [openRisk] = await db
    .select({ id: paymentOrders.id })
    .from(paymentOrders)
    .where(
      and(
        eq(paymentOrders.userId, userId),
        inArray(paymentOrders.riskStatus, ["REVIEW", "BLOCKED", "EFW"])
      )
    )
    .limit(1);
  const [openDispute] = await db
    .select({ id: paymentDisputes.disputeId })
    .from(paymentDisputes)
    .where(
      and(
        eq(paymentDisputes.userId, userId),
        notInArray(paymentDisputes.status, ["won", "lost", "warning_closed"])
      )
    )
    .limit(1);
  if (!openRisk && !openDispute) {
    await db
      .update(users)
      .set({ billingStatus: "ACTIVE", updatedAt: new Date() })
      .where(eq(users.id, userId));
  }
}

export async function fulfillClearedPaymentOrder(orderId: number) {
  const [order] = await db
    .select()
    .from(paymentOrders)
    .where(eq(paymentOrders.id, orderId))
    .limit(1);
  if (!order) throw new Error(`Payment order not found: ${orderId}`);
  if (order.fulfilledAt) return { held: false as const, order };
  if (!["CLEAR", "RESOLVED"].includes(order.riskStatus)) {
    return { held: true as const, order };
  }
  if (
    !order.creditTransType ||
    ![CreditTransType.ORDER_PAY, CreditTransType.SUBSCRIPTION].includes(
      order.creditTransType as typeof CreditTransType.ORDER_PAY | typeof CreditTransType.SUBSCRIPTION
    ) ||
    !order.creditExpiryDays
  ) {
    throw new Error(`Payment order ${order.orderNo} is missing fulfillment configuration`);
  }

  const creditsToGrant = order.creditsGranted - order.creditsRevoked;
  if (creditsToGrant > 0) {
    await creditService.recharge({
      userId: order.userId,
      credits: creditsToGrant,
      orderNo: order.orderNo,
      transType: order.creditTransType as
        | typeof CreditTransType.ORDER_PAY
        | typeof CreditTransType.SUBSCRIPTION,
      expiryDays: order.creditExpiryDays,
      remark: order.fulfillmentRemark ?? `Stripe payment: ${order.orderNo}`,
    });
  }
  const fulfilledAt = new Date();
  const [fulfilled] = await db
    .update(paymentOrders)
    .set({ fulfilledAt, riskStatus: "CLEAR", updatedAt: fulfilledAt })
    .where(eq(paymentOrders.id, order.id))
    .returning();
  await restoreAccountAfterPaymentReview(order.userId);
  return { held: false as const, order: fulfilled ?? order };
}

export async function applyPaymentRiskAssessment(
  order: PaymentOrder,
  risk: StripePaymentRiskSnapshot
) {
  await recordPaymentRiskEvent({
    eventKey: `assessment:${risk.paymentIntentId ?? order.orderNo}:${risk.decision}`,
    paymentOrderId: order.id,
    userId: order.userId,
    source: "PAYMENT_ASSESSMENT",
    action: risk.decision === "REVIEW" ? "HOLD" : "ALLOW",
    status: risk.decision === "REVIEW" ? "OPEN" : "RESOLVED",
    riskLevel: risk.riskLevel,
    riskScore: risk.riskScore,
    stripeObjectId: risk.paymentIntentId ?? risk.chargeId,
    reason: risk.reason,
    metadata: {
      reviewId: risk.reviewId,
      threeDSecureResult: risk.threeDSecureResult,
      liabilityShift: risk.liabilityShift,
    },
  });
  if (risk.decision === "REVIEW") {
    await placeAccountInPaymentReview(order.userId);
    return { held: true as const, order };
  }
  return fulfillClearedPaymentOrder(order.id);
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
    if (candidateOrderNos.length) {
      [order] = await db
        .select()
        .from(paymentOrders)
        .where(inArray(paymentOrders.orderNo, candidateOrderNos))
        .limit(1);
    }
    const [legacyPackage] = candidateOrderNos.length
      ? order
        ? []
        : await db
          .select()
          .from(creditPackages)
          .where(inArray(creditPackages.orderNo, candidateOrderNos))
          .limit(1)
      : [];
    if (legacyPackage?.orderNo) {
      const risk = await inspectStripePaymentRisk(paymentIntentId, charge.id);
      const creditExpiryDays = legacyPackage.expiredAt
        ? Math.max(
            1,
            Math.ceil(
              (legacyPackage.expiredAt.getTime() - legacyPackage.createdAt.getTime()) /
                (24 * 60 * 60 * 1000)
            )
          )
        : 365;
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
        creditTransType:
          legacyPackage.transType === CreditTransType.SUBSCRIPTION
            ? CreditTransType.SUBSCRIPTION
            : CreditTransType.ORDER_PAY,
        creditExpiryDays,
        fulfillmentRemark: `Backfilled Stripe payment: ${legacyPackage.orderNo}`,
        fulfilledAt: legacyPackage.createdAt,
        risk,
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

async function resolveOpenRiskEvents(
  paymentOrderId: number,
  resolvedBy: string,
  resolutionRemark: string
) {
  await db
    .update(paymentRiskEvents)
    .set({
      status: "RESOLVED",
      resolvedAt: new Date(),
      resolvedBy,
      resolutionRemark,
    })
    .where(
      and(
        eq(paymentRiskEvents.paymentOrderId, paymentOrderId),
        eq(paymentRiskEvents.status, "OPEN")
      )
    );
}

export async function handleRadarReview(
  event: StripeEventEnvelope,
  review: Stripe.Review
) {
  const currentReview = await stripe.reviews.retrieve(review.id);
  const chargeId = stripeObjectId(currentReview.charge);
  if (!chargeId) throw new Error(`Stripe review ${currentReview.id} has no charge`);
  const charge = await stripe.charges.retrieve(chargeId);
  const order = await findOrderForCharge(charge);
  const reason = currentReview.open
    ? `Stripe Radar review opened: ${currentReview.reason}`
    : `Stripe Radar review closed: ${currentReview.closed_reason ?? currentReview.reason}`;

  if (currentReview.open) {
    await db
      .update(paymentOrders)
      .set({
        riskStatus: "REVIEW",
        reviewId: currentReview.id,
        riskReason: reason,
        riskEvaluatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(paymentOrders.id, order.id));
    await recordPaymentRiskEvent({
      eventKey: event.id,
      paymentOrderId: order.id,
      userId: order.userId,
      source: "RADAR_REVIEW",
      action: "HOLD",
      status: "OPEN",
      stripeObjectId: currentReview.id,
      reason,
      metadata: { openedReason: currentReview.opened_reason },
    });
    await placeAccountInPaymentReview(order.userId);
    return;
  }

  if (currentReview.closed_reason === "approved") {
    await db
      .update(paymentOrders)
      .set({
        riskStatus: "RESOLVED",
        reviewId: currentReview.id,
        riskReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(paymentOrders.id, order.id));
    await resolveOpenRiskEvents(order.id, "STRIPE_RADAR", reason);
    await recordPaymentRiskEvent({
      eventKey: event.id,
      paymentOrderId: order.id,
      userId: order.userId,
      source: "RADAR_REVIEW",
      action: "APPROVE_AND_FULFILL",
      status: "RESOLVED",
      stripeObjectId: currentReview.id,
      reason,
    });
    await fulfillClearedPaymentOrder(order.id);
    return;
  }

  if (
    currentReview.closed_reason === "refunded" ||
    currentReview.closed_reason === "refunded_as_fraud"
  ) {
    await handleChargeRefunded(charge);
    await db
      .update(paymentOrders)
      .set({
        riskStatus: "RESOLVED",
        reviewId: currentReview.id,
        riskReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(paymentOrders.id, order.id));
    await resolveOpenRiskEvents(order.id, "STRIPE_RADAR", reason);
    await recordPaymentRiskEvent({
      eventKey: event.id,
      paymentOrderId: order.id,
      userId: order.userId,
      source: "RADAR_REVIEW",
      action: "CLOSE_WITHOUT_FULFILLMENT",
      status: "RESOLVED",
      stripeObjectId: currentReview.id,
      reason,
    });
    await restoreAccountAfterPaymentReview(order.userId);
    return;
  }

  await db
    .update(paymentOrders)
    .set({
      riskStatus: "BLOCKED",
      reviewId: currentReview.id,
      riskReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(paymentOrders.id, order.id));
  await recordPaymentRiskEvent({
    eventKey: event.id,
    paymentOrderId: order.id,
    userId: order.userId,
    source: "RADAR_REVIEW",
    action: "BLOCK",
    status: "OPEN",
    stripeObjectId: currentReview.id,
    reason,
  });
  await placeAccountInPaymentReview(order.userId);
}

export async function handleEarlyFraudWarning(
  event: StripeEventEnvelope,
  warning: Stripe.Radar.EarlyFraudWarning
) {
  const currentWarning = await stripe.radar.earlyFraudWarnings.retrieve(warning.id);
  const chargeId = stripeObjectId(currentWarning.charge);
  if (!chargeId) {
    throw new Error(`Stripe early fraud warning ${currentWarning.id} has no charge`);
  }
  const charge = await stripe.charges.retrieve(chargeId);
  const order = await findOrderForCharge(charge);
  const reason = `Stripe early fraud warning: ${currentWarning.fraud_type}`;
  await db
    .update(paymentOrders)
    .set({
      riskStatus: "EFW",
      earlyFraudWarningId: currentWarning.id,
      riskReason: reason,
      riskEvaluatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(paymentOrders.id, order.id));
  await recordPaymentRiskEvent({
    eventKey: event.id,
    paymentOrderId: order.id,
    userId: order.userId,
    source: "EARLY_FRAUD_WARNING",
    action: currentWarning.actionable ? "HOLD_FOR_REFUND_DECISION" : "HOLD",
    status: "OPEN",
    stripeObjectId: currentWarning.id,
    reason,
    metadata: { actionable: currentWarning.actionable, chargeId },
  });
  await placeAccountInPaymentReview(order.userId);
}

export async function handlePaymentIntentFailed(
  event: StripeEventEnvelope,
  paymentIntent: Stripe.PaymentIntent
) {
  const reason =
    paymentIntent.last_payment_error?.message ?? "Stripe payment intent failed";
  const [order] = await db
    .select()
    .from(paymentOrders)
    .where(eq(paymentOrders.paymentIntentId, paymentIntent.id))
    .limit(1);
  if (order) {
    await db
      .update(paymentOrders)
      .set({
        status: "FAILED",
        riskStatus: "FAILED",
        riskReason: reason,
        riskEvaluatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(paymentOrders.id, order.id));
  }
  await recordPaymentRiskEvent({
    eventKey: event.id,
    paymentOrderId: order?.id,
    userId: order?.userId ?? paymentIntent.metadata.userId,
    source: "PAYMENT_FAILURE",
    action: "DECLINE",
    status: "RESOLVED",
    stripeObjectId: paymentIntent.id,
    reason,
    metadata: { errorCode: paymentIntent.last_payment_error?.code },
  });
}

export async function approvePaymentRiskOrder(
  orderId: number,
  actorUserId: string,
  remark: string
) {
  const [order] = await db
    .select()
    .from(paymentOrders)
    .where(eq(paymentOrders.id, orderId))
    .limit(1);
  if (!order) throw new Error(`Payment order not found: ${orderId}`);
  if (
    !order.fulfilledAt &&
    order.status !== "PAID" &&
    order.status !== "PARTIALLY_REFUNDED"
  ) {
    throw new Error(`Payment order ${order.orderNo} cannot be fulfilled`);
  }
  const reason = remark || "Approved by administrator";
  await db
    .update(paymentOrders)
    .set({ riskStatus: "RESOLVED", riskReason: reason, updatedAt: new Date() })
    .where(eq(paymentOrders.id, order.id));
  await resolveOpenRiskEvents(order.id, actorUserId, reason);
  await recordPaymentRiskEvent({
    eventKey: `manual:${order.id}:approve:${Date.now()}`,
    paymentOrderId: order.id,
    userId: order.userId,
    source: "ADMIN",
    action: "APPROVE_AND_FULFILL",
    status: "RESOLVED",
    reason,
    metadata: { actorUserId },
  });
  return fulfillClearedPaymentOrder(order.id);
}

export async function blockPaymentRiskOrder(
  orderId: number,
  actorUserId: string,
  remark: string
) {
  const [order] = await db
    .select()
    .from(paymentOrders)
    .where(eq(paymentOrders.id, orderId))
    .limit(1);
  if (!order) throw new Error(`Payment order not found: ${orderId}`);
  if (
    !order.fulfilledAt &&
    order.status !== "PAID" &&
    order.status !== "PARTIALLY_REFUNDED"
  ) {
    throw new Error(`Payment order ${order.orderNo} cannot be reviewed`);
  }
  const reason = remark || "Blocked by administrator";
  await db
    .update(paymentOrders)
    .set({ riskStatus: "BLOCKED", riskReason: reason, updatedAt: new Date() })
    .where(eq(paymentOrders.id, order.id));
  await resolveOpenRiskEvents(order.id, actorUserId, reason);
  await recordPaymentRiskEvent({
    eventKey: `manual:${order.id}:block:${Date.now()}`,
    paymentOrderId: order.id,
    userId: order.userId,
    source: "ADMIN",
    action: "BLOCK",
    status: "OPEN",
    reason,
    metadata: { actorUserId },
  });
  await placeAccountInPaymentReview(order.userId);
  return { held: true as const, order };
}

export async function handleChargeRefunded(charge: Stripe.Charge) {
  const order = await findOrderForCharge(charge);
  const { targetCredits, deltaCredits } = calculateCreditReversal({
    amountPaid: order.amount,
    amountReversed: charge.amount_refunded,
    creditsGranted: order.creditsGranted,
    creditsAlreadyRevoked: order.creditsRevoked,
  });
  if (!order.fulfilledAt) {
    const resolved = charge.refunded;
    await db
      .update(paymentOrders)
      .set({
        amountRefunded: charge.amount_refunded,
        creditsRevoked: targetCredits,
        status: resolved ? "REFUNDED" : "PARTIALLY_REFUNDED",
        riskStatus: resolved ? "RESOLVED" : "REVIEW",
        riskReason: `Refund received before fulfillment for charge ${charge.id}`,
        updatedAt: new Date(),
      })
      .where(eq(paymentOrders.id, order.id));
    await recordPaymentRiskEvent({
      eventKey: `refund:${charge.id}:${charge.amount_refunded}`,
      paymentOrderId: order.id,
      userId: order.userId,
      source: "REFUND",
      action: resolved ? "CLOSE_WITHOUT_FULFILLMENT" : "HOLD",
      status: resolved ? "RESOLVED" : "OPEN",
      stripeObjectId: charge.id,
      reason: `Refunded ${charge.amount_refunded}/${order.amount} before credits were granted`,
      metadata: { targetCredits, deltaCredits },
    });
    if (resolved) {
      await restoreAccountAfterPaymentReview(order.userId);
    } else {
      await placeAccountInPaymentReview(order.userId);
    }
    return;
  }
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
      .set({
        status: "DISPUTE_WON",
        riskStatus: "RESOLVED",
        riskReason: `Stripe dispute won: ${currentDispute.id}`,
        updatedAt: new Date(),
      })
      .where(eq(paymentOrders.id, order.id));
    await restoreAccountAfterPaymentReview(order.userId);
    return;
  }

  if (currentDispute.status === "lost") {
    if (order.fulfilledAt) {
      await creditService.revokeOrderCredits({
        paymentOrderId: order.id,
        userId: order.userId,
        orderNo: order.orderNo,
        targetCredits: order.creditsGranted,
        paymentStatus: "DISPUTE_LOST",
        remark: `Stripe dispute lost: ${currentDispute.id}`,
      });
    } else {
      await db
        .update(paymentOrders)
        .set({
          status: "DISPUTE_LOST",
          riskStatus: "BLOCKED",
          riskReason: `Stripe dispute lost before fulfillment: ${currentDispute.id}`,
          creditsRevoked: order.creditsGranted,
          updatedAt: new Date(),
        })
        .where(eq(paymentOrders.id, order.id));
    }
    await db
      .update(users)
      .set({ billingStatus: "PAYMENT_REQUIRED", updatedAt: new Date() })
      .where(eq(users.id, order.userId));
    return;
  }

  await db
    .update(paymentOrders)
    .set({
      status: "DISPUTED",
      riskStatus: "BLOCKED",
      riskReason: `Stripe dispute under review: ${currentDispute.id}`,
      updatedAt: new Date(),
    })
    .where(eq(paymentOrders.id, order.id));
  await db
    .update(users)
    .set({ billingStatus: "DISPUTE_REVIEW", updatedAt: new Date() })
    .where(eq(users.id, order.userId));
  if (event.type === "charge.dispute.created") {
    await alertAdminOfDispute(currentDispute, order.orderNo);
  }
}
