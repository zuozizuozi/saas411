# BUG-010 Challenge Review

> Date: 2026-08-05 · Trigger: inferred requirement, missing connected functionality
> Execution note: the playbook's synchronous no-delegation guardrail was honored; two isolated reviewer roles were run sequentially in this session.

## Round 1 — Independent reviewer

This is a real functional bug. `MyCreationsPage` passes filter state to `useVideos()`, but `src/hooks/use-videos.ts:30-37` uses it only in the query cache key and sends limit/cursor. The client and service do not carry model/sort, and the service always orders newest-first.

## Round 2 — Maintainer challenge

The strongest defense is that filters might be planned UI scaffolding. They are rendered as active controls and trigger refetches, yet return the same result set. A normal user reasonably expects exposed filters to affect results; this is incorrect behavior, not a request for better UX.

## Verdict

**Verdict:** CONFIRMED

**Verdict:** CONFIRMED — MEDIUM. Status, model, and sort must be propagated and applied consistently.
