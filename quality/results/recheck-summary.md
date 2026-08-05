# Recheck Results

> Recheck of `quality/BUGS.md` from 2026-08-04  
> Recheck run: 2026-08-05  
> Skill version: 1.5.6

## Summary

| Status | Count |
|---|---:|
| Fixed | 8 |
| Partially fixed | 0 |
| Still open | 0 |
| Inconclusive | 0 |
| **Total** | **8** |

## Per-Bug Results

| Bug | Severity | Status | Evidence |
|---|---|---|---|
| BUG-002 | HIGH | FIXED | 60-minute terminal policy and upload-lease race guard; regression passes |
| BUG-004 | MEDIUM | FIXED | 1 MiB bounded reader returns 413; malformed JSON returns 400 |
| BUG-005 | MEDIUM | FIXED | Active guides use `CALLBACK_HMAC_SECRET` |
| BUG-006 | LOW | FIXED | CSP permits the enabled Vercel observability scripts |
| BUG-007 | HIGH | FIXED | Validated IP is used by the actual proxy/direct Undici connection |
| BUG-008 | MEDIUM | FIXED | API/UI/types/all seven locales use one complete vocabulary |
| BUG-009 | HIGH | FIXED | Sender and receivers share one complete QStash configuration contract |
| BUG-010 | MEDIUM | FIXED | Filters and sort reach the database query and cursor direction matches order |

## Still Open — Details

None. Live paid-provider, payment, and object-storage smoke tests remain a deployment gate rather than an open source-code bug.
