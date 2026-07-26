# Video generation operations

## Model routing

`src/ai/routing.ts` is the single policy layer for the provider order of each
video model. The generation service selects only providers that both have an
API key and support the requested text-to-video or image-to-video mode.

Leave `DEFAULT_AI_PROVIDER` unset to enable per-model routing and fallback.
Setting it pins the entire product to that provider for a controlled migration
or incident response.

To add a model, update its provider capability, model mapping, credits config,
and the route policy together. The admin endpoint
`GET /api/v1/admin/models` exposes the resulting route to administrators.

## Quotas and credits

`src/services/generation-quota.ts` limits concurrent and daily tasks by
subscription plan before credits are frozen. Credits remain the billing source
of truth: a task freezes them before submission, settles on success, and
releases them when submission fails.

The current quota values are product defaults and should be adjusted after
real provider cost and capacity data is available.

Batch output creates one provider task and one credit hold per output. Free
accounts receive one slot; paid plans can request two outputs in one batch.

## Durable reconciliation

When QStash is configured, each submitted task schedules an Upstash Workflow
that rechecks provider status for missed callbacks. Configure all four
`QSTASH_*` variables in `.env.example` and expose the application URL publicly.
The workflow is a recovery path; provider callback signatures remain required
for the normal completion path.

## Vercel, Supabase, R2, and Stripe

Use Supabase's transaction-pooler connection string on port 6543 for
`DATABASE_URL`. The Postgres client disables prepared statements so it remains
compatible with Supavisor.

For a brand-new empty Supabase project, run `pnpm db:push` once to establish the
complete Drizzle schema. For an existing VideoFly database, run
`pnpm db:migrate` to apply the additive media, batch, provider-health, and
idempotency migration. Do not run the additive migration against an empty
database because this repository predates a full baseline migration.

Browser image uploads use a short-lived R2 presigned PUT URL, avoiding Vercel's
request-body limit. Configure R2 bucket CORS to allow `PUT` from the production
site and local development origin, with the `Content-Type` header. Set an R2
lifecycle rule for generated videos and abandoned uploads according to the
product retention policy.

Stripe is the only runtime billing provider. Configure subscriptions to call
`/api/webhooks/stripe`; one-time credit packs use Checkout price data and the
same signed webhook. The `credit_packages.order_no` unique index makes repeated
Stripe delivery idempotent. Paid subscription invoices grant the configured
monthly or yearly credits exactly once using the Stripe invoice ID.

## Admin shell

The existing Better Auth server-side admin guard remains authoritative. Refine
is mounted as the admin application shell so model, credit, user, and video
resources can be migrated progressively without replacing the current pages.
