import {
  and,
  desc,
  eq,
  gte,
  isNull,
  sql,
} from "drizzle-orm";

import {
  CreditTransType,
  creditTransactions,
  db,
  generationRiskEvents,
  paymentOrders,
  users,
} from "@/db";
import {
  GENERATION_RISK_POLICY,
  assessAnnualCreditVelocity,
} from "@/config/generation-risk";
import { siteConfig } from "@/config/site";
import { env } from "@/lib/auth/env.mjs";
import { ApiError } from "@/lib/api/error";
import { getSubscriptionPriceDetails } from "@/payment/plans";

type RiskEmailJob = {
  eventId: number;
  level: "LOW" | "HIGH";
  userEmail: string;
  consumedCredits: number;
  grantedCredits: number;
  windowHours: number;
};

function riskReason(job: Omit<RiskEmailJob, "eventId" | "userEmail">) {
  const percentage = Math.floor((job.consumedCredits * 100) / job.grantedCredits);
  return `Annual credits consumed unusually quickly: ${job.consumedCredits}/${job.grantedCredits} (${percentage}%) within ${job.windowHours} hours`;
}

async function sendRiskAlert(job: RiskEmailJob) {
  if (!env.ADMIN_EMAIL) {
    console.warn("[GenerationRisk] ADMIN_EMAIL is not configured; alert skipped");
    return;
  }

  const percentage = Math.floor((job.consumedCredits * 100) / job.grantedCredits);
  const adminUrl = `${env.NEXT_PUBLIC_APP_URL}/zh/admin/users?search=${encodeURIComponent(job.userEmail)}`;
  const { resend } = await import("@/lib/email");
  await resend.emails.send({
    from: env.RESEND_FROM,
    to: env.ADMIN_EMAIL,
    subject: `[VideoFly] ${job.level === "HIGH" ? "Generation paused" : "Credit velocity warning"}: ${job.userEmail}`,
    text: [
      `User: ${job.userEmail}`,
      `Severity: ${job.level}`,
      `Consumed: ${job.consumedCredits}/${job.grantedCredits} credits (${percentage}%)`,
      `Window: ${job.windowHours} hours`,
      job.level === "HIGH"
        ? "New video generation has been paused automatically."
        : "No restriction has been applied.",
      `Review: ${adminUrl}`,
    ].join("\n"),
  });
}

async function deliverRiskEmail(job: RiskEmailJob | null) {
  if (!job) return;
  try {
    await sendRiskAlert(job);
    await db
      .update(generationRiskEvents)
      .set({ emailSentAt: new Date() })
      .where(eq(generationRiskEvents.id, job.eventId));
  } catch (error) {
    console.error("[GenerationRisk] Failed to send administrator alert", error);
  }
}

export class GenerationRiskService {
  async pauseManually(params: {
    userId: string;
    adminUserId: string;
    reason: string;
  }) {
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`generation-control:${params.userId}`}))`
      );
      const [account] = await tx
        .select({ generationStatus: users.generationStatus })
        .from(users)
        .where(eq(users.id, params.userId))
        .limit(1);
      if (!account) throw new ApiError("User not found", 404);
      if (account.generationStatus === "PAUSED") {
        throw new ApiError("Video generation is already paused", 409);
      }

      const now = new Date();
      await tx
        .update(users)
        .set({
          generationStatus: "PAUSED",
          generationPauseSource: "MANUAL",
          generationPauseReason: params.reason,
          generationPausedAt: now,
          generationPausedBy: params.adminUserId,
          updatedAt: now,
        })
        .where(eq(users.id, params.userId));
      await tx.insert(generationRiskEvents).values({
        userId: params.userId,
        source: "MANUAL",
        action: "PAUSE",
        level: "HIGH",
        status: "OPEN",
        actorUserId: params.adminUserId,
        reason: params.reason,
      });
      return { generationStatus: "PAUSED" as const, pauseSource: "MANUAL" as const };
    });
  }

  async resume(params: {
    userId: string;
    adminUserId: string;
    reason: string;
  }) {
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`generation-control:${params.userId}`}))`
      );
      const [account] = await tx
        .select({
          generationStatus: users.generationStatus,
          generationPauseSource: users.generationPauseSource,
        })
        .from(users)
        .where(eq(users.id, params.userId))
        .limit(1);
      if (!account) throw new ApiError("User not found", 404);
      if (account.generationStatus !== "PAUSED") {
        throw new ApiError("Video generation is not paused", 409);
      }

      const now = new Date();
      const exemptUntil =
        account.generationPauseSource === "CREDIT_VELOCITY"
          ? new Date(
              now.getTime() +
                GENERATION_RISK_POLICY.manualRecoveryExemptionHours * 60 * 60 * 1000
            )
          : null;
      await tx
        .update(users)
        .set({
          generationStatus: "ACTIVE",
          generationPauseSource: null,
          generationPauseReason: null,
          generationPausedAt: null,
          generationPausedBy: null,
          generationRiskExemptUntil: exemptUntil,
          updatedAt: now,
        })
        .where(eq(users.id, params.userId));
      await tx
        .update(generationRiskEvents)
        .set({
          status: "RESOLVED",
          resolvedAt: now,
          resolvedBy: params.adminUserId,
          resolutionRemark: params.reason,
        })
        .where(
          and(
            eq(generationRiskEvents.userId, params.userId),
            eq(generationRiskEvents.action, "PAUSE"),
            eq(generationRiskEvents.status, "OPEN")
          )
        );
      await tx.insert(generationRiskEvents).values({
        userId: params.userId,
        source: "MANUAL",
        action: "RESUME",
        status: "RESOLVED",
        actorUserId: params.adminUserId,
        reason: params.reason,
        resolvedAt: now,
        resolvedBy: params.adminUserId,
        resolutionRemark: params.reason,
      });
      return {
        generationStatus: "ACTIVE" as const,
        riskExemptUntil: exemptUntil?.toISOString() ?? null,
      };
    });
  }

  async evaluateCreditVelocity(userId: string) {
    const emailJob = await db.transaction(async (tx): Promise<RiskEmailJob | null> => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`generation-control:${userId}`}))`
      );
      const [account] = await tx
        .select({
          email: users.email,
          generationStatus: users.generationStatus,
          generationPauseSource: users.generationPauseSource,
          generationRiskExemptUntil: users.generationRiskExemptUntil,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!account) return null;

      if (
        account.generationStatus === "PAUSED" &&
        account.generationPauseSource === "CREDIT_VELOCITY"
      ) {
        const [pendingEmail] = await tx
          .select()
          .from(generationRiskEvents)
          .where(
            and(
              eq(generationRiskEvents.userId, userId),
              eq(generationRiskEvents.action, "PAUSE"),
              eq(generationRiskEvents.status, "OPEN"),
              isNull(generationRiskEvents.emailSentAt)
            )
          )
          .orderBy(desc(generationRiskEvents.createdAt))
          .limit(1);
        return pendingEmail?.consumedCredits && pendingEmail.grantedCredits && pendingEmail.windowHours
          ? {
              eventId: pendingEmail.id,
              level: "HIGH",
              userEmail: account.email,
              consumedCredits: pendingEmail.consumedCredits,
              grantedCredits: pendingEmail.grantedCredits,
              windowHours: pendingEmail.windowHours,
            }
          : null;
      }
      if (account.generationStatus === "PAUSED") return null;

      const now = new Date();
      if (
        account.generationRiskExemptUntil &&
        account.generationRiskExemptUntil > now
      ) {
        return null;
      }

      const cutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);
      const recentOrders = await tx
        .select()
        .from(paymentOrders)
        .where(
          and(
            eq(paymentOrders.userId, userId),
            eq(paymentOrders.status, "PAID"),
            gte(paymentOrders.createdAt, cutoff)
          )
        )
        .orderBy(desc(paymentOrders.createdAt));
      const annualOrder = recentOrders.find(
        (order) => getSubscriptionPriceDetails(order.productId ?? undefined)?.period === "year"
      );
      if (!annualOrder || annualOrder.creditsGranted <= 0) return null;

      const [consumption] = await tx
        .select({
          credits: sql<number>`coalesce(sum(case when ${creditTransactions.credits} < 0 then -${creditTransactions.credits} else 0 end), 0)::int`,
        })
        .from(creditTransactions)
        .where(
          and(
            eq(creditTransactions.userId, userId),
            eq(creditTransactions.transType, CreditTransType.VIDEO_CONSUME),
            gte(creditTransactions.createdAt, annualOrder.createdAt)
          )
        );
      const consumedCredits = Number(consumption?.credits ?? 0);
      const elapsedHours = Math.max(
        0,
        (now.getTime() - annualOrder.createdAt.getTime()) / (60 * 60 * 1000)
      );
      const assessment = assessAnnualCreditVelocity({
        consumedCredits,
        grantedCredits: annualOrder.creditsGranted,
        elapsedHours,
      });
      if (assessment.level === "NONE") return null;

      if (assessment.level === "LOW") {
        const [existing] = await tx
          .select()
          .from(generationRiskEvents)
          .where(
            and(
              eq(generationRiskEvents.userId, userId),
              eq(generationRiskEvents.paymentOrderId, annualOrder.id),
              eq(generationRiskEvents.action, "WARNING"),
              eq(generationRiskEvents.level, "LOW")
            )
          )
          .orderBy(desc(generationRiskEvents.createdAt))
          .limit(1);
        if (existing?.emailSentAt) return null;
        if (existing) {
          return {
            eventId: existing.id,
            level: "LOW",
            userEmail: account.email,
            consumedCredits,
            grantedCredits: annualOrder.creditsGranted,
            windowHours: assessment.windowHours,
          };
        }

        const job = {
          level: "LOW" as const,
          consumedCredits,
          grantedCredits: annualOrder.creditsGranted,
          windowHours: assessment.windowHours,
        };
        const [event] = await tx
          .insert(generationRiskEvents)
          .values({
            userId,
            source: "CREDIT_VELOCITY",
            action: "WARNING",
            level: "LOW",
            status: "NOTIFIED",
            paymentOrderId: annualOrder.id,
            reason: riskReason(job),
            consumedCredits,
            grantedCredits: annualOrder.creditsGranted,
            windowHours: assessment.windowHours,
          })
          .returning({ id: generationRiskEvents.id });
        return event
          ? { eventId: event.id, userEmail: account.email, ...job }
          : null;
      }

      const job = {
        level: "HIGH" as const,
        consumedCredits,
        grantedCredits: annualOrder.creditsGranted,
        windowHours: assessment.windowHours,
      };
      const reason = riskReason(job);
      await tx
        .update(users)
        .set({
          generationStatus: "PAUSED",
          generationPauseSource: "CREDIT_VELOCITY",
          generationPauseReason: reason,
          generationPausedAt: now,
          generationPausedBy: null,
          updatedAt: now,
        })
        .where(eq(users.id, userId));
      const [event] = await tx
        .insert(generationRiskEvents)
        .values({
          userId,
          source: "CREDIT_VELOCITY",
          action: "PAUSE",
          level: "HIGH",
          status: "OPEN",
          paymentOrderId: annualOrder.id,
          reason,
          consumedCredits,
          grantedCredits: annualOrder.creditsGranted,
          windowHours: assessment.windowHours,
        })
        .returning({ id: generationRiskEvents.id });
      return event ? { eventId: event.id, userEmail: account.email, ...job } : null;
    });

    await deliverRiskEmail(emailJob);
  }

  async scanRecentAnnualAccounts(limit = 500) {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const recentOrders = await db
      .select({ userId: paymentOrders.userId, productId: paymentOrders.productId })
      .from(paymentOrders)
      .where(
        and(
          eq(paymentOrders.status, "PAID"),
          gte(paymentOrders.createdAt, cutoff)
        )
      )
      .orderBy(desc(paymentOrders.createdAt))
      .limit(Math.min(Math.max(limit, 1), 1_000));
    const userIds = Array.from(
      new Set(
        recentOrders
          .filter(
            (order) =>
              getSubscriptionPriceDetails(order.productId ?? undefined)?.period === "year"
          )
          .map((order) => order.userId)
      )
    );
    for (const candidateUserId of userIds) {
      await this.evaluateCreditVelocity(candidateUserId);
    }
    return { scannedUsers: userIds.length };
  }
}

export const generationRiskService = new GenerationRiskService();

export function generationPausedDetails(input: {
  source: string | null;
  reason: string | null;
}) {
  return {
    code: "GENERATION_PAUSED",
    pauseSource: input.source,
    reason: input.reason,
    supportEmail: siteConfig.supportEmail ?? "support@seedance.co",
  };
}
