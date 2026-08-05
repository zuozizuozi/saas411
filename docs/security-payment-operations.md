# Security and payment operations

## Administrator access

- `ADMIN_EMAIL` is the bootstrap/demo administrator. A signed-in account whose
  normalized email matches this value is treated as an admin even if its
  database `isAdmin` flag has not been set yet.
- Other administrators must have `user.isAdmin = true` and can be granted or
  revoked in the admin user page.
- Never use a shared mailbox password. Keep Google/Magic Link access and MFA on
  the mailbox itself, and use a dedicated demo account with no provider or
  infrastructure credentials.

## Customer refunds

There is no customer-facing refund endpoint. A normal refund remains a merchant
decision and is created in Stripe. VideoFly changes balances only after Stripe
sends the signed `charge.refunded` webhook.

For a partial refund, the same proportion of the order's credits is revoked.
Only unused credits from that order are removed. Already-used credits become
`user.credit_debt`; unrelated packages are not confiscated. Accounts with debt
cannot start new generations until an operator resolves the balance.

## Payment risk and fulfillment holds

Stripe payment success is recorded before any credits are issued. The server
retrieves the PaymentIntent and Charge, records Radar risk level/score, review
ID, and 3DS outcome, and then applies the configured policy:

- `normal` risk is fulfilled immediately and idempotently.
- An open Radar Review, a risk level in `PAYMENT_RISK_HOLD_LEVELS`, or a score at
  or above `PAYMENT_RISK_HOLD_SCORE` holds fulfillment and changes the account
  to `PAYMENT_REVIEW`.
- Radar approval or an administrator approval releases the held credits once.
- Early fraud warnings keep the payment blocked for an operator decision. The
  application never creates a Stripe refund automatically.
- Refunds and disputes received before fulfillment close or reduce the held
  grant instead of assuming that a credit package already exists.

Operators use `/{locale}/admin/payment-risk` for the internal audit trail and
open the linked payment/review in Stripe for the source-of-truth decision.
Every manual approve/block action requires a note. Approval can issue held
credits; blocking does not refund the payment.

## Bank disputes / chargebacks

A cardholder can bypass the merchant and file a dispute with their bank. The
application cannot prevent that flow, so it does the following:

1. `charge.dispute.created` creates a case and sets the account to
   `DISPUTE_REVIEW`, blocking new generations without deleting prior work.
2. An immutable evidence snapshot records the purchase context, terms version,
   credit ledger entries, and recent generation delivery history.
3. `ADMIN_EMAIL` receives an alert. The case appears at
   `/{locale}/admin/disputes`, with a direct link to Stripe.
4. The operator reviews the snapshot and uploads the appropriate evidence in
   Stripe. Stripe, the card network, and the issuing bank decide the outcome.
5. A won case restores access when no debt or other open dispute remains. A
   lost case revokes the order's remaining credits, records spent credits as
   debt, and changes the account to `PAYMENT_REQUIRED`.

After an externally verified repayment or manual review, an administrator can
reduce debt and restore access with
`PATCH /api/v1/admin/users/{userId}/billing`. The body is
`{"debtReduction": 100, "restoreAccess": true, "remark": "Stripe repayment ..."}`.
The endpoint refuses to restore access while debt remains and writes an
auditable `SYSTEM_ADJUST` ledger entry.

The evidence snapshot is an internal aid, not a guarantee of winning. Do not
submit prompts or private media unless Stripe specifically requires them and
the privacy policy permits it. IP address and user-agent records are supporting
signals, not conclusive proof of the cardholder's identity.

## Stripe webhook configuration

The production webhook endpoint must include at least:

- `checkout.session.completed`
- `invoice.paid`
- `invoice.payment_succeeded`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `charge.refunded`
- `payment_intent.payment_failed`
- `review.opened`
- `review.closed`
- `radar.early_fraud_warning.created`
- `radar.early_fraud_warning.updated`
- `charge.dispute.created`
- `charge.dispute.updated`
- `charge.dispute.closed`
- `charge.dispute.funds_withdrawn`
- `charge.dispute.funds_reinstated`

Every event is recorded by Stripe event ID before processing. Failed events are
retryable; processed events are ignored on replay.

## Deployment checklist

1. Back up the database.
2. Set and verify `ADMIN_EMAIL`, `RESEND_FROM`, `RESEND_API_KEY`,
   `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYMENT_RISK_HOLD_LEVELS`, and
   `PAYMENT_RISK_HOLD_SCORE`.
3. Back up, then apply every pending migration in `src/db/migrations` in order.
   The payment-risk migration must be live before deploying the matching code.
4. In Stripe test mode, enable Radar's standard protection and 3DS rules, add
   every webhook event listed above, and send test review, early-warning,
   failure, refund, and dispute events.
5. Verify unauthenticated access to `/api/v1/admin/user-videos` returns 401 and
   a non-admin session returns 403.
6. Verify the bootstrap admin can open `/admin/disputes` and
   `/admin/payment-risk`, and that Stripe links point to the intended
   mode/account.
7. Configure a public Terms of Service URL in Stripe before setting
   `STRIPE_REQUIRE_TERMS_CONSENT=true`; run a test Checkout and confirm Stripe
   records consent and the billing address.
8. Upload URLs expire after 15 minutes and sign the declared content length;
   completed files are also checked by image magic bytes. Do not add a blanket
   lifecycle deletion rule to `uploads/`, because completed reference images
   use the same prefix.
