# VideoFly Quality Exploration

Date: 2026-08-04
Playbook: Quality Playbook 1.5.6, Phase 1 — Explore
Scope: normal-operation correctness, frontend/backend consistency, security, authorization, and external-call chains

## Exploration Scope and Method

- Repository scale: 672 tracked files, including 465 files below `src/`.
- Deep scope: authentication/authorization, generation UI/API/provider/callback/storage, credit ledger, Stripe billing/webhooks, uploads, and public/private route behavior.
- Deferred depth: marketing visuals and copy, legacy Kubernetes/tRPC functionality, and purely experiential UI improvements.
- Evidence sources: tracked-file role map, source walk, documentation/spec comparison, unit tests, type check, lint, production build, dependency audit, and local browser/API probes.
- Baseline verification: 25 test files and 149 tests passed.
- Baseline verification: TypeScript check passed.
- Baseline verification: lint passed across 372 checked files.
- Baseline verification: production build passed with environment validation explicitly bypassed because the local checkout lacks deploy-time secrets.
- Environment note: a normal build correctly fails without `BETTER_AUTH_SECRET` and `NEXT_PUBLIC_APP_URL`; this is a local deployment prerequisite, not classified as a source defect.
- Dependency audit: `pnpm audit --prod` reported no known production dependency vulnerabilities.
- Browser coverage: `/text-to-video`, `/image-to-video`, `/my-creations`, `/admin`, login redirection, guest generator submission, and representative REST authorization responses.

## Architecture and Domain Summary

- Next.js App Router owns both pages and REST/webhook endpoints.
- Better Auth creates sessions; sensitive REST routes derive the user from request headers.
- Admin authorization re-reads the database flag rather than trusting cached cookie data.
- The generator UI reads the shared model/credit catalog and submits through `/api/v1/video/generate`.
- Server validation rechecks model enablement, duration, aspect ratio, quality, audio support, mode, image count, and image ownership.
- Generation freezes FIFO credits before calling an ordered provider route.
- Provider callbacks and a QStash reconciliation workflow converge provider state into local video state.
- Successful completion downloads provider media, writes it to managed object storage, settles credits, and marks the video complete.
- Stripe Checkout and Billing Portal initiate payment flows; signed webhooks reconcile local plans and credits.
- Upload reservations, ownership checks, file metadata, size limits, and magic-byte checks protect image ingestion.

## Documentation Depth Assessment

- `docs/project-blueprint.md`: deep and recently maintained; useful for intended architecture and operational invariants.
- `docs/security-payment-operations.md`: deep for payment operations and incident handling.
- `docs/VIDEO-OPERATIONS.md`: deep for generation lifecycle and recovery expectations.
- `docs/spec/CREDIT_CALCULATOR.md`: deep for credit calculation behavior.
- `docs/spec/AI_PROVIDER_INTEGRATION.md`: moderate but partially stale relative to the five-provider implementation.
- `README.md`: moderate onboarding coverage but contains a stale callback-secret name.
- `docs/API-INTEGRATION-GUIDE.md`: broad but stale in provider and callback environment examples.
- Documentation is sufficient to derive intended requirements, but code is treated as authoritative where newer operational documents and older integration guides disagree.

## Derived Requirements

- REQ-001: unauthenticated callers must be denied access to user credits, videos, uploads, generation, and settings.
- REQ-002: authenticated users must only read, mutate, retry, delete, or attach media that they own.
- REQ-003: admin APIs and pages must require a current database-backed administrator role.
- REQ-004: generation parameters and credit cost must be validated server-side against the same active model catalog presented by the frontend.
- REQ-005: credit freeze, provider submission, settlement, and release must remain atomic or compensating across every terminal path.
- REQ-006: callbacks must be authenticated and bound to the stored provider, video UUID, and external task ID.
- REQ-007: a lost callback must still converge to COMPLETED or FAILED without leaving paid work and credits frozen indefinitely.
- REQ-008: Stripe events must be signature-verified and idempotent before changing plans or credits.
- REQ-009: every Stripe success, cancellation, and portal return URL must resolve to a real application route.
- REQ-010: remote and user-uploaded media must be ownership-checked, protocol/network constrained, bounded in size, and validated by content.
- REQ-011: the provider enumeration must remain consistent across types, configuration, factories, routing, callback ingress, health data, and tests.
- REQ-012: secrets must be validated, excluded from public bundles, and absent from tracked files.

## Derived Use Cases

- UC-001: a guest explores a generator, submits a valid prompt, and is redirected to login without generating or spending credits.
- UC-002: an authenticated user starts text-to-video generation and sees the same model capabilities and cost enforced by the server.
- UC-003: an authenticated user uploads owned image media and starts image-to-video generation.
- UC-004: a provider sends a valid signed callback; the task is identity-checked, stored, and charged exactly once.
- UC-005: a provider callback is delayed or lost; durable reconciliation reaches a terminal state and resolves the credit hold.
- UC-006: a user buys credits or a subscription; Stripe returns to a real page and signed webhooks update the account once.
- UC-007: an administrator accesses operational endpoints while ordinary and unauthenticated users are rejected.

## Cartesian Requirement/Use-Case Check

- Multi-location requirements were checked against each applicable use case rather than creating one umbrella-only check.
- REQ-001/REQ-002 apply to UC-002, UC-003, UC-006, and UC-007 at page, route, and service boundaries.
- REQ-004/REQ-005 apply independently to UC-002 and UC-003.
- REQ-006 applies to UC-004; REQ-007 applies separately to UC-005 because callback success does not prove fallback convergence.
- REQ-008/REQ-009 apply independently to subscription, credit purchase, portal return, success return, and cancellation return in UC-006.
- REQ-011 was checked across each concrete provider representation rather than only at the factory.
- No multi-site requirement was left represented only by a generic umbrella use case.

## Open Exploration Findings

1. Guest and administrator boundaries behave correctly in sampled runtime paths. `src/lib/api/auth.ts:25` rejects missing sessions, while `src/lib/api/auth.ts:36` and `src/lib/auth/admin-role.ts:12` re-read the database admin bit. Browser/API probes returned 401 for credit/video/generation/upload routes and 403 for an admin API. This is a positive multi-location finding covering page redirects, API middleware, and database-backed role checks.

2. The generator has a real frontend/backend consistency chain. `src/components/tool/generator-panel.tsx:253` loads the shared catalog, `src/components/tool/generator-panel.tsx:286` normalizes per-model options, and `src/components/tool/generator-panel.tsx:310` calculates credits. `src/app/api/v1/video/generate/route.ts:10` constrains the transport payload, and `src/services/video-validation.ts:27` revalidates model capabilities server-side. This positive multi-location finding means unsupported client values cannot rely on frontend controls alone.

3. Image ownership is checked before generation. `src/app/api/v1/video/generate/route.ts:29` deduplicates submitted images and `src/app/api/v1/video/generate/route.ts:32` calls the ownership assertion. Combined with route authentication at line 26, the principal is not supplied by the client. This is positive authorization evidence.

4. Callback authentication and task binding are layered. `src/ai/utils/callback-signature.ts:39` checks age, future skew, and constant-time HMAC equality; `src/app/api/v1/video/callback/[provider]/route.ts:26` rejects invalid signatures; and `src/services/video.ts:379` plus `src/services/video.ts:385` reject provider/task mismatches. This positive multi-location finding limits forged or cross-task completion.

5. The callback provider allowlist is inconsistent with the provider domain. `src/ai/types.ts:3`, `src/ai/provider-config.ts:3`, and `src/ai/index.ts:18` all include `bailian`, but `src/app/api/v1/video/callback/[provider]/route.ts:16` omits it. Bailian currently polls instead of supplying the generic callback URL, so this is latent rather than a reproduced active-model outage; nevertheless, enabling callback delivery for Bailian would receive HTTP 400.

6. Durable reconciliation is finite without a terminal cleanup path. `src/services/video.ts:324` schedules fallback reconciliation after provider submission. `src/app/api/internal/workflows/video-reconcile/route.ts:28` performs only ten polls, sleeps 45 seconds at line 40, and returns `PENDING` at line 43. `src/app/api/internal/workflows/video-reconcile-failed/route.ts:20` only logs exhausted delivery. A task still processing after roughly 7.5 minutes can remain GENERATING with frozen credits unless a later user/admin poll occurs. This is a multi-location normal-operation risk in the paid generation chain.

7. Stripe return URLs target a route that is not present in the built application. `src/services/billing.ts:140` and `src/services/billing.ts:269` construct `/dashboard`; checkout uses it for success and cancel at `src/services/billing.ts:303`, and portal sessions use it at `src/services/billing.ts:277`. The successful production route manifest contains `/my-creations`, `/settings`, and `/credits`, but no `/dashboard`. This is a reproduced route-contract defect after payment or portal use.

8. The callback endpoint lacks the body-size guard already used for Stripe. `src/app/api/v1/video/callback/[provider]/route.ts:40` calls `request.json()` directly, whereas `src/app/api/webhooks/stripe/route.ts:10` defines a 1 MiB limit and reads with that limit at line 19. The callback URL is HMAC protected, lowering exposure, but leaked long-lived signed URLs or a compromised provider can force unbounded JSON parsing. This is a cross-endpoint security inconsistency.

9. Remote-media SSRF protection is substantial but has a DNS rebinding gap. `src/lib/storage.ts:54` enforces HTTPS and rejects private hosts; `src/lib/storage.ts:72` resolves and rejects private IPs; `src/lib/storage.ts:104` repeats validation on redirects; and `src/lib/storage.ts:119` bounds response bytes. The later fetch at `src/lib/storage.ts:108` resolves the hostname again instead of connecting to the previously validated address, leaving a time-of-check/time-of-use DNS rebinding window. Provider/task identity controls reduce, but do not eliminate, the impact.

10. Credit completion uses compensating and idempotent behavior. `src/services/video.ts:341` releases credits if provider submission fails, `src/services/video.ts:555` settles after storage succeeds, and `src/services/video.ts:577` returns the task to GENERATING if completion fails. The credit service separately makes settle/release conditional on hold state (`src/services/credit.ts:359` and `src/services/credit.ts:448`). This is positive multi-location evidence for REQ-005.

11. Callback-secret documentation is inconsistent with executable configuration. `README.md:145` and `docs/API-INTEGRATION-GUIDE.md:55` instruct `AI_CALLBACK_SECRET`, while `.env.example:131` and `src/ai/utils/callback-signature.ts:7` require `CALLBACK_HMAC_SECRET`. Deployments following the stale guides will fail generation when signed callback URLs are created.

12. The configured CSP blocks two installed observability integrations. `next.config.mjs:17` permits Stripe and Vercel Live scripts but not `va.vercel-scripts.com`. Browser exploration reproduced CSP refusal for both Vercel Analytics and Speed Insights scripts. Core generation remained usable, so this is operational visibility loss rather than a primary user-flow failure.

13. No tracked production secret was found in the targeted secret scan. `.env.local` is ignored and contained no application credential used by the audited code. Placeholder database URLs appear in examples and documentation only. This is positive REQ-012 evidence, not proof about external deployment secret stores.

14. The automated suite is strong at unit boundaries but does not execute a real authenticated generation/payment/provider transaction. All 149 tests passed, but the tracked role map contains no production-like browser test with a database session, Stripe webhook, provider callback/poll, storage upload, and ledger assertion in one chain. This is a coverage gap relevant to the remaining phases, not itself a confirmed product defect.

## Quality Risks

- HIGH functional risk: Stripe completes or cancels externally and returns the user to a nonexistent `/dashboard` route.
- HIGH lifecycle risk: provider work can outlive the finite reconciliation window and leave a generation plus credit hold nonterminal.
- MEDIUM security risk: provider callback JSON has no explicit request-size ceiling.
- MEDIUM security risk: remote-media DNS validation is not pinned through the actual connection.
- MEDIUM integration risk: provider additions can update the typed factory but silently miss callback ingress.
- MEDIUM deployment risk: stale callback-secret documentation can produce a production-only failure.
- LOW operational risk: CSP blocks Analytics and Speed Insights, reducing evidence during incidents.
- Coverage risk: passing unit tests do not prove the authenticated paid-generation lifecycle as a whole.

## Pattern Applicability Matrix

| Pattern | Applicability | Decision | Evidence target |
|---|---|---|---|
| 1. Fallback/Degradation Path Parity | High | FULL | callback vs QStash vs user/admin polling; provider fallback outcomes; credit release |
| 2. Dispatcher/Registry Wiring Completeness | Medium | SKIP | central provider factory is small and covered by Pattern 3/4; no separate dynamic plugin dispatcher |
| 3. Cross-Implementation Contract Consistency | High | FULL | five provider adapters, payment/webhook boundaries, upload/storage adapters |
| 4. Enumeration and Representation Completeness | High | FULL | provider union/config/factory/routing/callback/health representations |
| 5. API Surface Consistency | High | FULL | UI payload, REST validation, auth status, Stripe return routes, webhook limits |
| 6. Parsing/Serialization Round-Trip Integrity | Medium | SKIP | no bespoke persisted format dominates the requested normal-operation scope |
| 7. Composition and Middleware Ordering | Medium | SKIP | auth, ownership, validation, freeze, provider call ordering was sampled within open exploration; no broad middleware stack |

FULL count: 4. The required range of exactly 3–4 FULL pattern walks is satisfied.

## Pattern Deep Dive — Fallback/Degradation Path Parity

- Primary success: provider callback enters the signed callback route, verifies provider/task identity, uploads media, settles credits, and marks COMPLETED.
- Degradation path A: frontend polling calls `refreshStatus` and can advance provider state.
- Degradation path B: QStash starts after provider acceptance and polls ten times.
- Degradation path C: administrators can recover nonterminal videos manually.
- Parity break: only callbacks or later polling can terminate a task after QStash's fixed window; the durable path returns PENDING without requeue, timeout failure, or credit release.
- Operational consequence: the path specifically intended to prevent stranded paid work does not guarantee the same terminal outcome as the primary path.
- Candidate generated: CAND-002.

## Pattern Deep Dive — Cross-Implementation Contract Consistency

- Provider adapters share `AIVideoProvider`, common mapping functions, routing filters, and task status conversion.
- Callback-capable implementations require callback ingress to accept the same provider identifier.
- `bailian` is constructible and configurable but absent from the callback allowlist.
- Current Bailian submission does not pass the shared callback URL, so active behavior is polling-based; the inconsistency remains latent until that contract is used.
- Webhook endpoints should share defensive request-body ceilings; Stripe does, the AI callback does not.
- Candidate generated: CAND-003 and CAND-004.

## Pattern Deep Dive — Enumeration and Representation Completeness

- Canonical-looking representations discovered: `ProviderType`, `AI_PROVIDERS`, API-key switch, provider factory, model mappings, routing rules, callback allowlist, provider health aggregation, and documentation.
- The first four executable representations enumerate five providers.
- Callback ingress enumerates four and omits Bailian.
- Older documentation enumerates only Evolink/Kie and is not suitable as a current canonical list.
- The representation is duplicated manually, so compilation cannot force callback completeness.
- Candidate generated: CAND-003.

## Pattern Deep Dive — API Surface Consistency

- Generator UI values are normalized and server-revalidated; no mismatch was found in the sampled active model submission path.
- Guest page submission and protected REST endpoints agree on requiring authentication.
- Admin page/API behavior agrees on denial for unauthenticated users.
- Stripe's API contract exposes external success/cancel/portal returns to `/dashboard`, but the page surface no longer exposes that route.
- Stripe webhook request parsing is explicitly bounded while the provider webhook surface is not.
- Candidate generated: CAND-001 and CAND-004.

## Candidate Bugs for Phase 2

### CAND-001 — Stripe returns to missing dashboard route

- Stage: open-exploration
- Severity hypothesis: HIGH
- Requirements: REQ-009; use case UC-006
- Evidence: `src/services/billing.ts:140`, `src/services/billing.ts:269`, `src/services/billing.ts:303`; production build route manifest contains no `/dashboard`.
- Expected: checkout success/cancel and portal return land on an existing account/billing page.
- Actual: configured return path resolves to a missing route.
- Phase 2 target: generate an executable route-contract test and fix options.

### CAND-002 — Reconciliation exhaustion leaves nonterminal generation and frozen credits

- Stage: risk-analysis + pattern-walk
- Severity hypothesis: HIGH
- Requirements: REQ-005, REQ-007; use case UC-005
- Evidence: `src/services/video.ts:324`, `src/app/api/internal/workflows/video-reconcile/route.ts:28`, `src/app/api/internal/workflows/video-reconcile/route.ts:43`, `src/app/api/internal/workflows/video-reconcile-failed/route.ts:20`.
- Expected: missed callbacks ultimately converge or deliberately fail/refund after a defined maximum age.
- Actual: the durable workflow stops with PENDING and its failure callback only logs delivery failure.
- Phase 2 target: simulate a provider still processing at attempt ten and assert final ledger/video behavior.

### CAND-003 — Provider callback enumeration omits Bailian

- Stage: pattern-walk
- Severity hypothesis: MEDIUM, latent
- Requirements: REQ-006, REQ-011; use case UC-004
- Evidence: `src/ai/types.ts:3`, `src/ai/provider-config.ts:3`, `src/ai/index.ts:18`, `src/app/api/v1/video/callback/[provider]/route.ts:16`.
- Expected: every callback-capable configured provider is accepted or callback support is expressed explicitly in provider metadata.
- Actual: manually duplicated list rejects Bailian.
- Phase 2 target: enumerate canonical provider values against callback acceptance and clarify polling-only capability.

### CAND-004 — AI callback JSON body is unbounded

- Stage: open-exploration + pattern-walk
- Severity hypothesis: MEDIUM
- Requirements: REQ-006, REQ-010; use case UC-004
- Evidence: `src/app/api/v1/video/callback/[provider]/route.ts:40` versus `src/app/api/webhooks/stripe/route.ts:10` and line 19.
- Expected: externally reachable webhook bodies have explicit, early byte ceilings.
- Actual: callback calls `request.json()` without a limit.
- Phase 2 target: oversized signed request test and shared bounded-reader design.

### CAND-005 — Remote-media DNS rebinding window

- Stage: security-risk-analysis
- Severity hypothesis: MEDIUM
- Requirements: REQ-010; use cases UC-004 and UC-005
- Evidence: validated DNS lookup at `src/lib/storage.ts:72`, followed by a separate hostname-resolving fetch at `src/lib/storage.ts:108`.
- Expected: the network destination used by the HTTP connection is the public address that passed validation.
- Actual: DNS can change between validation and connection.
- Phase 2 target: assess runtime support for IP pinning/dispatcher lookup and create a rebinding-focused test seam.

### CAND-006 — Callback-secret documentation names the wrong variable

- Stage: open-exploration
- Severity hypothesis: MEDIUM deployment defect
- Requirements: REQ-006, REQ-012; use case UC-004
- Evidence: `README.md:145`, `docs/API-INTEGRATION-GUIDE.md:55`, `.env.example:131`, `src/ai/utils/callback-signature.ts:7`.
- Expected: all deployment instructions name `CALLBACK_HMAC_SECRET`.
- Actual: two prominent guides name `AI_CALLBACK_SECRET`.
- Phase 2 target: documentation consistency check and correction proposal.

### CAND-007 — CSP blocks installed Vercel observability scripts

- Stage: runtime-open-exploration
- Severity hypothesis: LOW
- Requirement relation: operational diagnostics only; not a core use-case failure
- Evidence: `next.config.mjs:17` and reproduced browser CSP console errors for `va.vercel-scripts.com`.
- Expected: installed Analytics/Speed Insights scripts either load or are intentionally absent.
- Actual: both are emitted and blocked.
- Phase 2 target: determine whether integrations are intentionally enabled before generating a fix.

### CAND-008 — No end-to-end paid-generation chain test

- Stage: coverage-risk-analysis
- Severity hypothesis: test gap, not a product bug
- Requirements: REQ-001 through REQ-011
- Evidence: role map reports 26 test-role files; 149 tests pass, but none spans authenticated request, credit freeze, provider terminal event, storage, settlement, and account response.
- Expected: at least one deterministic integration test protects the revenue-critical state machine.
- Actual: assurance is assembled from unit and manual boundary checks.
- Phase 2 target: generate a minimal contract/integration test plan without requiring live vendors.

## Security Review Snapshot

- Authentication: sampled protected routes reject missing sessions; no client-supplied user ID was observed in the generation entry point.
- Authorization: administrator checks are database-backed; generation image ownership is explicit; video service operations were traced with user IDs.
- Injection: Drizzle query builders dominate audited data access; no high-confidence raw user-string SQL interpolation was found.
- Webhooks: Stripe signatures and callback HMAC/task binding are present; callback size limiting remains a candidate.
- Secrets: no tracked live credential found; server secrets are read from environment variables; stale documentation can cause misconfiguration.
- SSRF: protocol/private-network/redirect/size defenses exist; DNS pinning remains a candidate.
- Payments: webhook signature and idempotent credit/order paths were observed; return-route contract is broken.
- Dependencies: production audit reports no known advisories.
- No CRITICAL issue was established in Phase 1.

## Gate Self-Check

1. Role map exists and accounts for all 672 tracked files: PASS.
2. Deep scope is declared for this 200–500 source-file repository: PASS.
3. Deferred areas and rationale are explicit: PASS.
4. Architecture and domain behavior are summarized: PASS.
5. Documentation depth and staleness are assessed: PASS.
6. At least eight numbered open findings include file/line evidence: PASS (14 findings).
7. At least three findings cross multiple locations: PASS (findings 1, 2, 4, 6, 7, 10, and 11).
8. Quality risks are separated from confirmed behavior: PASS.
9. All seven exploration patterns have an applicability decision: PASS.
10. Exactly three to four patterns are FULL: PASS (4 FULL).
11. At least three FULL patterns have deep dives: PASS (4 deep dives).
12. Candidate bugs include at least two from open/risk analysis and at least one from pattern walking: PASS.
13. Cartesian requirement/use-case expansion is explicitly checked: PASS.

Phase 1 gate result: PASS.
