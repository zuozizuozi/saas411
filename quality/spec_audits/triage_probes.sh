#!/usr/bin/env sh
set -eu

# Executable evidence for Phase 4 triage. Each test names the exact source line
# whose current behavior confirms or rejects the disputed finding.
pnpm vitest run quality/spec_audits/phase4-triage-probes.test.ts
