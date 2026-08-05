# BUG-007 Challenge Review

> Date: 2026-08-05 · Trigger: security-class finding, inferred requirement
> Execution note: the playbook's synchronous no-delegation guardrail was honored; two isolated reviewer roles were run sequentially in this session.

## Round 1 — Independent reviewer

This is a real SSRF control gap. `assertSafeRemoteMediaUrlResolved()` validates DNS answers at `src/lib/storage.ts:72-79`, but `fetch(currentUrl)` at lines 104-109 reconnects by hostname and can resolve a different address. Redirects repeat the same check-then-use split.

## Round 2 — Maintainer challenge

The strongest defense is that DNS rebinding is specialized and the code rejects private answers during validation. The defense fails because the security property concerns the address actually connected to; a time-of-check result does not constrain the subsequent resolver call. A correct fix must bind validated resolution to the connection without breaking redirects, proxies, streaming limits, or dispatcher lifecycle.

## Verdict

**Verdict:** CONFIRMED

**Verdict:** CONFIRMED — HIGH. No speculative fix patch is approved until connection pinning is designed and tested.
