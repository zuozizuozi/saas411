import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";

import { db, securityRateLimits } from "@/db";
import { ApiError } from "@/lib/api/error";

interface RateLimitInput {
  scope: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
}

function buildRateLimitKey(scope: string, identifier: string) {
  const normalizedScope = scope.replace(/[^a-z0-9:_-]/gi, "-").slice(0, 80);
  const digest = createHash("sha256").update(identifier).digest("hex");
  return `${normalizedScope}:${digest}`;
}

/**
 * Atomically consumes one request from a fixed-window counter in PostgreSQL.
 * The hashed identifier avoids persisting raw IP addresses or email addresses.
 */
export async function enforceRateLimit(input: RateLimitInput) {
  if (input.limit < 1 || input.windowSeconds < 1) {
    throw new Error("Invalid rate-limit configuration");
  }

  const key = buildRateLimitKey(input.scope, input.identifier);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + input.windowSeconds * 1000);
  const nowIso = now.toISOString();
  const expiresAtIso = expiresAt.toISOString();

  const [result] = await db.execute<{ count: number; expiresAt: string }>(sql`
    insert into ${securityRateLimits} ("key", "count", "window_started_at", "expires_at")
    values (${key}, 1, ${nowIso}::timestamp, ${expiresAtIso}::timestamp)
    on conflict ("key") do update set
      "count" = case
        when ${securityRateLimits.expiresAt} <= ${nowIso}::timestamp then 1
        else least(${securityRateLimits.count} + 1, ${input.limit + 1})
      end,
      "window_started_at" = case
        when ${securityRateLimits.expiresAt} <= ${nowIso}::timestamp then ${nowIso}::timestamp
        else ${securityRateLimits.windowStartedAt}
      end,
      "expires_at" = case
        when ${securityRateLimits.expiresAt} <= ${nowIso}::timestamp then ${expiresAtIso}::timestamp
        else ${securityRateLimits.expiresAt}
      end
    returning "count"::int as "count", "expires_at"::text as "expiresAt"
  `);

  if (!result || Number(result.count) > input.limit) {
    const resetAt = result?.expiresAt ? new Date(result.expiresAt) : expiresAt;
    const retryAfter = Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000));
    throw new ApiError("Too many requests. Please try again later.", 429, {
      code: "RATE_LIMITED",
      retryAfter,
    });
  }
}

export async function pruneExpiredRateLimits() {
  const cutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await db.execute(sql`
    delete from ${securityRateLimits}
    where ${securityRateLimits.expiresAt} < ${cutoffIso}::timestamp
  `);
}
