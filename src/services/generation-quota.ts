import { and, count, eq, gte, inArray, sql } from "drizzle-orm";

import { db, VideoStatus, videos } from "@/db";
import { ApiError } from "@/lib/api/error";
import { creditService } from "./credit";

type Plan = "FREE" | "BASIC" | "PRO" | "BUSINESS";

const QUOTAS: Record<Plan, { maxConcurrent: number; maxDailyPerModel: number }> = {
  FREE: { maxConcurrent: 1, maxDailyPerModel: 8 },
  BASIC: { maxConcurrent: 1, maxDailyPerModel: 40 },
  PRO: { maxConcurrent: 2, maxDailyPerModel: 80 },
  BUSINESS: { maxConcurrent: 5, maxDailyPerModel: 500 },
};

/**
 * Product-level protection. Credits decide whether a user can pay; quotas
 * decide whether the platform can safely accept the work right now.
 */
export class GenerationQuotaService {
  /**
   * Reserve the quota slot and create the pending video in one transaction.
   * A transaction-scoped PostgreSQL advisory lock serializes submissions for
   * one user, which is compatible with Supabase's transaction pooler and
   * prevents concurrent browser tabs from passing the same count check.
   */
  async reserveVideo(
    userId: string,
    model: string,
    values: typeof videos.$inferInsert
  ): Promise<{ uuid: string; id: number }> {
    const [created] = await this.reserveVideos(userId, model, [values]);
    if (!created) throw new Error("Failed to create video record");
    return created;
  }

  async reserveVideos(
    userId: string,
    model: string,
    values: Array<typeof videos.$inferInsert>
  ): Promise<Array<{ uuid: string; id: number }>> {
    if (values.length === 0) return [];
    const balance = await creditService.getBalance(userId);
    const plan = (balance.plan ?? "FREE") as Plan;
    const quota = QUOTAS[plan] ?? QUOTAS.FREE;
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`video-generation:${userId}`}))`
      );

      const [active] = await tx
        .select({ value: count() })
        .from(videos)
        .where(
          and(
            eq(videos.userId, userId),
            inArray(videos.status, [
              VideoStatus.PENDING,
              VideoStatus.GENERATING,
              VideoStatus.UPLOADING,
            ])
          )
        );

      if ((active?.value ?? 0) + values.length > quota.maxConcurrent) {
        throw new ApiError("Too many active video generations", 429, {
          code: "GENERATION_CONCURRENCY_LIMIT",
          limit: quota.maxConcurrent,
        });
      }

      const [daily] = await tx
        .select({ value: count() })
        .from(videos)
        .where(
          and(
            eq(videos.userId, userId),
            eq(videos.model, model),
            gte(videos.createdAt, startOfDay)
          )
        );

      if ((daily?.value ?? 0) + values.length > quota.maxDailyPerModel) {
        throw new ApiError("Daily model generation limit reached", 429, {
          code: "MODEL_DAILY_LIMIT",
          limit: quota.maxDailyPerModel,
          model,
        });
      }

      const created = await tx.insert(videos).values(values).returning({
        uuid: videos.uuid,
        id: videos.id,
      });
      if (created.length !== values.length) {
        throw new Error("Failed to reserve every video in the batch");
      }
      return created;
    });
  }

  getPolicy(plan: Plan) {
    return QUOTAS[plan] ?? QUOTAS.FREE;
  }
}

export const generationQuotaService = new GenerationQuotaService();
