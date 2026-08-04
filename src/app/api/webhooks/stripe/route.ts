import { NextResponse, type NextRequest } from "next/server";

import { stripe, type Stripe } from "@/payment";
import { handleEvent } from "@/payment/webhooks";

import { env } from "@/env.mjs";
import { ApiError } from "@/lib/api/error";
import { readRequestTextWithLimit } from "@/lib/api/request-body";

const MAX_STRIPE_WEBHOOK_BYTES = 1024 * 1024;

const handler = async (req: NextRequest) => {
  const signature = req.headers.get("Stripe-Signature");
  try {
    if (!signature) throw new Error("Missing Stripe-Signature header");
    if (!env.STRIPE_WEBHOOK_SECRET) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
    }
    const payload = await readRequestTextWithLimit(req, MAX_STRIPE_WEBHOOK_BYTES);
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    ) as Stripe.DiscriminatedEvent;
    await handleEvent(event);

    console.log("✅ Handled Stripe Event", event.type);
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.log(`❌ Error when handling Stripe Event: ${message}`);
    const status = error instanceof ApiError ? error.status : 400;
    return NextResponse.json({ error: "Webhook processing failed" }, { status });
  }
};

export { handler as POST };
