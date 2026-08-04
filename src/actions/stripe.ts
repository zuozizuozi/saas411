"use server";

import { z } from "zod";
import { headers } from "next/headers";

import { userActionClient } from "@/lib/safe-action";
import {
  createStripeCreditSession,
  createStripeSession,
  confirmStripeSubscriptionUpgrade,
  getMySubscription,
  getUserPlans,
  previewStripeSubscriptionChange,
} from "@/services/billing";
import { PAYMENT_TERMS_VERSION } from "@/services/payment-risk";
import { enforceRateLimit } from "@/services/rate-limit";

async function getPurchaseContext() {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  return {
    ip: forwardedFor?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || undefined,
    userAgent: requestHeaders.get("user-agent")?.slice(0, 500) || undefined,
    termsVersion: PAYMENT_TERMS_VERSION,
    termsAcceptedAt: new Date(),
  };
}

export const createStripeSessionAction = userActionClient
  .schema(z.object({ planId: z.string().min(1) }))
  .action(async ({ parsedInput, ctx }) => {
    await enforceRateLimit({
      scope: "stripe-checkout",
      identifier: ctx.user.id,
      limit: 5,
      windowSeconds: 300,
    });
    const result = await createStripeSession(
      ctx.user.id,
      parsedInput.planId,
      await getPurchaseContext()
    );
    return { success: result.success, url: result.url };
  });

export const createStripeCreditSessionAction = userActionClient
  .schema(z.object({ packageId: z.string().min(1) }))
  .action(async ({ parsedInput, ctx }) => {
    await enforceRateLimit({
      scope: "stripe-checkout",
      identifier: ctx.user.id,
      limit: 5,
      windowSeconds: 300,
    });
    return createStripeCreditSession(
      ctx.user.id,
      parsedInput.packageId,
      await getPurchaseContext()
    );
  });

export const previewStripeSubscriptionChangeAction = userActionClient
  .schema(z.object({ planId: z.string().min(1) }))
  .action(async ({ parsedInput, ctx }) => {
    await enforceRateLimit({
      scope: "stripe-preview",
      identifier: ctx.user.id,
      limit: 20,
      windowSeconds: 60,
    });
    return previewStripeSubscriptionChange(ctx.user.id, parsedInput.planId);
  });

export const confirmStripeSubscriptionUpgradeAction = userActionClient
  .schema(
    z.object({
      planId: z.string().min(1),
      prorationDate: z.number().int().positive(),
    })
  )
  .action(async ({ parsedInput, ctx }) => {
    await enforceRateLimit({
      scope: "stripe-change",
      identifier: ctx.user.id,
      limit: 5,
      windowSeconds: 300,
    });
    return confirmStripeSubscriptionUpgrade(
      ctx.user.id,
      parsedInput.planId,
      parsedInput.prorationDate,
      await getPurchaseContext()
    );
  });

export const getUserPlansAction = userActionClient
  .schema(z.object({}))
  .action(async ({ ctx }) => {
    const plan = await getUserPlans(ctx.user.id);
    return { success: true, plan };
  });

export const getMySubscriptionAction = userActionClient
  .schema(z.object({}))
  .action(async ({ ctx }) => {
    const subscription = await getMySubscription(ctx.user.id);
    return { success: true, subscription };
  });
