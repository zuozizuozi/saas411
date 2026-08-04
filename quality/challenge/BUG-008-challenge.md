# BUG-008 Challenge Review

> Date: 2026-08-05 · Trigger: inferred requirement, sibling-representation divergence
> Execution note: the playbook's synchronous no-delegation guardrail was honored; two isolated reviewer roles were run sequentially in this session.

## Round 1 — Independent reviewer

This is a real frontend/backend contract bug. The API emits lowercase aliases at `src/app/api/v1/credit/history/route.ts:21-30`, while `src/components/credits/credit-history.tsx:19-55` keys presentation by uppercase database values. The type and locale vocabularies also differ, including no complete presentation path for `payment_reversal`.

## Round 2 — Maintainer challenge

The strongest defense is the UI fallback at `credit-history.tsx:97`, which prevents a crash. A fallback does not preserve the promised label, icon, color, or translation; normal records can display raw identifiers and inconsistent semantics. This is directly visible account data, not cosmetic optimization.

## Verdict

**Verdict:** CONFIRMED

**Verdict:** CONFIRMED — MEDIUM. The fix should choose one canonical public vocabulary and map it totally.
