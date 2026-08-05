import { SubscriptionPlan, customers, db, users } from "@/db";
import { and, eq, isNull } from "drizzle-orm";
import { stripe } from "@/payment";

export async function updateUserName(userId: string, name: string) {
  await db.update(users).set({ name }).where(eq(users.id, userId));
}

export async function getCustomerByUserId(userId: string) {
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.authUserId, userId))
    .limit(1);
  return customer ?? null;
}

export async function ensureCustomer(userId: string) {
  const existing = await getCustomerByUserId(userId);
  if (existing) return existing;

  const [created] = await db
    .insert(customers)
    .values({
      authUserId: userId,
      plan: SubscriptionPlan.FREE,
    })
    .onConflictDoNothing({ target: customers.authUserId })
    .returning();

  return created ?? getCustomerByUserId(userId);
}

/** Ensure Checkout reuses one Stripe Customer so Radar can build history. */
export async function ensureStripeCustomer(userId: string) {
  const localCustomer = await ensureCustomer(userId);
  if (!localCustomer) throw new Error("Failed to create local customer");
  if (localCustomer.stripeCustomerId) return localCustomer.stripeCustomerId;

  const [account] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!account) throw new Error("User not found while creating Stripe customer");

  const stripeCustomer = await stripe.customers.create(
    {
      email: account.email,
      name: account.name ?? undefined,
      metadata: { userId },
    },
    { idempotencyKey: `videofly:customer:${userId}` }
  );

  await db
    .update(customers)
    .set({ stripeCustomerId: stripeCustomer.id, updatedAt: new Date() })
    .where(
      and(
        eq(customers.authUserId, userId),
        isNull(customers.stripeCustomerId)
      )
    );

  const updated = await getCustomerByUserId(userId);
  if (!updated?.stripeCustomerId) {
    throw new Error("Failed to persist Stripe customer");
  }
  return updated.stripeCustomerId;
}
