# Stripe Pricing Checklist

The application keeps the existing environment-variable names for database and
deployment compatibility. Their customer-facing plan names are now:

| Internal environment prefix | Customer-facing plan |
| --- | --- |
| `BASIC` | Go |
| `PRO` | Plus |
| `BUSINESS` | Pro |

## Recurring prices

Create three recurring prices on each Stripe product. Prices must be in USD.

| Plan | Monthly | Quarterly (`interval=month`, `interval_count=3`) | Yearly |
| --- | ---: | ---: | ---: |
| Go | $9.90 | $28.22 | $106.92 |
| Plus | $29.90 | $85.22 | $322.92 |
| Pro | $79.90 | $227.72 | $862.92 |

## Vercel environment variables

Add `STRIPE_API_KEY` (the live `sk_live_...` secret) and
`STRIPE_WEBHOOK_SECRET` (the signing secret for the production webhook endpoint)
as Sensitive variables. Add the resulting Stripe Price IDs to Production and
Preview:

```text
NEXT_PUBLIC_STRIPE_BASIC_MONTHLY_PRICE_ID
NEXT_PUBLIC_STRIPE_BASIC_QUARTERLY_PRICE_ID
NEXT_PUBLIC_STRIPE_BASIC_YEARLY_PRICE_ID

NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID
NEXT_PUBLIC_STRIPE_PRO_QUARTERLY_PRICE_ID
NEXT_PUBLIC_STRIPE_PRO_YEARLY_PRICE_ID

NEXT_PUBLIC_STRIPE_BUSINESS_MONTHLY_PRICE_ID
NEXT_PUBLIC_STRIPE_BUSINESS_QUARTERLY_PRICE_ID
NEXT_PUBLIC_STRIPE_BUSINESS_YEARLY_PRICE_ID
```

The one-time Starter, Standard, and Premium packs use Stripe Checkout inline
prices, so they do not need separate Price ID environment variables.

## Credit grants

| Plan | Monthly | Quarterly | Yearly |
| --- | ---: | ---: | ---: |
| Go | 280 | 840 | 3,360 |
| Plus | 900 | 2,700 | 10,800 |
| Pro | 2,520 | 7,560 | 30,240 |

- Monthly grants expire after 31 days.
- Quarterly grants expire after 93 days.
- Yearly grants expire after 366 days.
- Stripe invoice IDs make recurring grants idempotent.

## Release verification

- [ ] `STRIPE_API_KEY` and `STRIPE_WEBHOOK_SECRET` are present in the Production deployment (not only saved for future deployments).
- [ ] All nine recurring Price IDs are configured in Vercel.
- [ ] Stripe webhook receives `invoice.payment_succeeded`.
- [ ] Stripe webhook also receives `invoice.paid` and `customer.subscription.updated`.
- [ ] Same-period upgrades create an immediate prorated invoice and grant only incremental credits.
- [ ] Monthly checkout grants the monthly amount.
- [ ] Quarterly checkout charges once and grants three months of credits.
- [ ] Yearly checkout charges once and grants twelve months of credits.
- [ ] Replaying the same invoice does not grant credits twice.
- [ ] All three one-time packs can be purchased without a subscription.
- [ ] A failed video generation releases frozen credits.
- [ ] Pricing cards show the full quarterly/yearly charge below the monthly equivalent.
