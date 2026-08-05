# BUG-005 Challenge Review

> Date: 2026-08-05 · Trigger: inferred requirement, documentation/runtime divergence
> Execution note: the playbook's synchronous no-delegation guardrail was honored; two isolated reviewer roles were run sequentially in this session.

## Round 1 — Independent reviewer

This is a real deployment defect. `README.md:145` and `docs/API-INTEGRATION-GUIDE.md:55` instruct operators to set `AI_CALLBACK_SECRET`, while `src/ai/utils/callback-signature.ts:7-12` reads only `CALLBACK_HMAC_SECRET` and fails if it is absent or weak.

## Round 2 — Maintainer challenge

The strongest defense is that `.env.example` and other documents use the correct variable, so experienced operators may discover the mismatch. That does not make the prominent setup instructions safe: following them literally leaves callback signing nonfunctional.

## Verdict

**Verdict:** CONFIRMED

**Verdict:** CONFIRMED — MEDIUM. This is an operationally observable configuration-chain failure.
