export type BillingProvider = "stripe";

/**
 * Stripe is the only production billing path. Keeping this as code rather
 * than an environment switch prevents two payment providers from issuing
 * credits or subscriptions for the same account.
 */
export const billingProvider: BillingProvider = "stripe";
export const isStripeProvider = true;
