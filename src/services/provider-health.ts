import { desc, gte } from "drizzle-orm";

import type { ProviderType } from "@/ai";
import { db, providerEvents } from "@/db";

type HealthSummary = {
  provider: ProviderType;
  attempts: number;
  failures: number;
  failureRate: number;
  averageLatencyMs: number;
  creditsQuoted: number;
  degraded: boolean;
};

export class ProviderHealthService {
  async record(input: {
    provider: ProviderType;
    model: string;
    videoUuid?: string;
    operation: "submit" | "poll";
    success: boolean;
    latencyMs: number;
    creditsQuoted?: number;
    errorMessage?: string;
  }) {
    await db.insert(providerEvents).values({
      ...input,
      creditsQuoted: input.creditsQuoted ?? 0,
      errorMessage: input.errorMessage?.slice(0, 1000),
    });
  }

  async summaries(windowMinutes = 60): Promise<HealthSummary[]> {
    const since = new Date(Date.now() - windowMinutes * 60_000);
    const events = await db
      .select()
      .from(providerEvents)
      .where(gte(providerEvents.createdAt, since))
      .orderBy(desc(providerEvents.createdAt))
      .limit(2000);

    const grouped = new Map<ProviderType, typeof events>();
    for (const event of events) {
      const provider = event.provider as ProviderType;
      grouped.set(provider, [...(grouped.get(provider) ?? []), event]);
    }

    return [...grouped.entries()].map(([provider, rows]) => {
      const failures = rows.filter((row) => !row.success).length;
      const failureRate = rows.length > 0 ? failures / rows.length : 0;
      return {
        provider,
        attempts: rows.length,
        failures,
        failureRate,
        averageLatencyMs: Math.round(
          rows.reduce((sum, row) => sum + row.latencyMs, 0) / rows.length
        ),
        creditsQuoted: rows.reduce((sum, row) => sum + row.creditsQuoted, 0),
        degraded: rows.length >= 5 && failureRate >= 0.6,
      };
    });
  }

  async prioritize(candidates: ProviderType[]): Promise<ProviderType[]> {
    if (candidates.length < 2) return candidates;
    const summaries = await this.summaries(10);
    const degraded = new Set(
      summaries.filter((summary) => summary.degraded).map((summary) => summary.provider)
    );
    return [...candidates].sort(
      (left, right) => Number(degraded.has(left)) - Number(degraded.has(right))
    );
  }
}

export const providerHealthService = new ProviderHealthService();
