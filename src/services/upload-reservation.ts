import { and, eq, lt, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

import { db, mediaAssets, uploadReservations } from "@/db";
import { ApiError } from "@/lib/api/error";
import { getStorage } from "@/lib/storage";
import { enforceRateLimit, pruneExpiredRateLimits } from "./rate-limit";

const UPLOAD_URL_TTL_MS = 15 * 60 * 1000;

function positiveEnv(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

const uploadLimits = {
  maxPending: positiveEnv("UPLOAD_MAX_PENDING", 5),
  maxDailyCount: positiveEnv("UPLOAD_DAILY_MAX_COUNT", 100),
  maxDailyBytes: positiveEnv("UPLOAD_DAILY_MAX_BYTES", 500 * 1024 * 1024),
  maxStoredBytes: positiveEnv("UPLOAD_TOTAL_MAX_BYTES", 2 * 1024 * 1024 * 1024),
};

interface ReserveUploadInput {
  userId: string;
  fileName: string;
  contentType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  fileSize: number;
}

const extensionByType = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
} as const;

export class UploadReservationService {
  async reserve(input: ReserveUploadInput) {
    await enforceRateLimit({
      scope: "upload-presign",
      identifier: input.userId,
      limit: 20,
      windowSeconds: 60,
    });
    await this.cleanupExpired({ userId: input.userId, limit: 20 });

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const expiresAt = new Date(now.getTime() + UPLOAD_URL_TTL_MS);
    const startOfDayIso = startOfDay.toISOString();
    const nowIso = now.toISOString();
    const key = `uploads/${input.userId}/${nanoid()}.${extensionByType[input.contentType]}`;

    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`upload-reserve:${input.userId}`}))`
      );

      const [daily] = await tx.execute<{ count: number; bytes: number }>(sql`
        select count(*)::int as "count", coalesce(sum("expected_size"), 0)::bigint as "bytes"
        from ${uploadReservations}
        where ${uploadReservations.userId} = ${input.userId}
          and ${uploadReservations.createdAt} >= ${startOfDayIso}::timestamp
      `);
      const [pending] = await tx.execute<{ count: number }>(sql`
        select count(*)::int as "count"
        from ${uploadReservations}
        where ${uploadReservations.userId} = ${input.userId}
          and ${uploadReservations.status} = 'PENDING'
          and ${uploadReservations.expiresAt} > ${nowIso}::timestamp
      `);
      const [stored] = await tx.execute<{ bytes: number }>(sql`
        select coalesce(sum("file_size"), 0)::bigint as "bytes"
        from ${mediaAssets}
        where ${mediaAssets.userId} = ${input.userId}
      `);

      const dailyCount = Number(daily?.count ?? 0);
      const dailyBytes = Number(daily?.bytes ?? 0);
      const pendingCount = Number(pending?.count ?? 0);
      const storedBytes = Number(stored?.bytes ?? 0);

      if (pendingCount >= uploadLimits.maxPending) {
        throw new ApiError("Too many pending uploads", 429, {
          code: "UPLOAD_PENDING_LIMIT",
          limit: uploadLimits.maxPending,
        });
      }
      if (
        dailyCount >= uploadLimits.maxDailyCount ||
        dailyBytes + input.fileSize > uploadLimits.maxDailyBytes
      ) {
        throw new ApiError("Daily upload quota reached", 429, {
          code: "UPLOAD_DAILY_LIMIT",
          maxCount: uploadLimits.maxDailyCount,
          maxBytes: uploadLimits.maxDailyBytes,
        });
      }
      if (storedBytes + input.fileSize > uploadLimits.maxStoredBytes) {
        throw new ApiError("Upload storage quota reached", 429, {
          code: "UPLOAD_STORAGE_LIMIT",
          maxBytes: uploadLimits.maxStoredBytes,
        });
      }

      const [reservation] = await tx
        .insert(uploadReservations)
        .values({
          userId: input.userId,
          storageKey: key,
          fileName: input.fileName,
          contentType: input.contentType,
          expectedSize: input.fileSize,
          expiresAt,
        })
        .returning();
      if (!reservation) throw new Error("Failed to reserve upload");
      return reservation;
    });
  }

  async getPending(userId: string, storageKey: string) {
    const [reservation] = await db
      .select()
      .from(uploadReservations)
      .where(
        and(
          eq(uploadReservations.userId, userId),
          eq(uploadReservations.storageKey, storageKey),
          eq(uploadReservations.status, "PENDING")
        )
      )
      .limit(1);
    if (!reservation) throw new ApiError("Upload reservation not found", 404);
    if (reservation.expiresAt.getTime() <= Date.now()) {
      throw new ApiError("Upload reservation has expired", 410);
    }
    return reservation;
  }

  async reject(userId: string, storageKey: string) {
    await db
      .update(uploadReservations)
      .set({ status: "FAILED" })
      .where(
        and(
          eq(uploadReservations.userId, userId),
          eq(uploadReservations.storageKey, storageKey),
          eq(uploadReservations.status, "PENDING")
        )
      );
  }

  async complete(input: {
    userId: string;
    storageKey: string;
    publicUrl: string;
    contentType: string;
    fileSize: number;
  }) {
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`upload-complete:${input.storageKey}`}))`
      );
      const [reservation] = await tx
        .select()
        .from(uploadReservations)
        .where(
          and(
            eq(uploadReservations.userId, input.userId),
            eq(uploadReservations.storageKey, input.storageKey),
            eq(uploadReservations.status, "PENDING")
          )
        )
        .limit(1);
      if (!reservation) throw new ApiError("Upload reservation not found", 404);
      if (reservation.expiresAt.getTime() <= Date.now()) {
        throw new ApiError("Upload reservation has expired", 410);
      }

      const [asset] = await tx
        .insert(mediaAssets)
        .values({
          uuid: `asset_${nanoid(21)}`,
          userId: input.userId,
          kind: "IMAGE",
          storageKey: input.storageKey,
          url: input.publicUrl,
          fileName: reservation.fileName,
          contentType: input.contentType,
          fileSize: input.fileSize,
        })
        .returning();
      if (!asset) throw new Error("Failed to save media asset");

      await tx
        .update(uploadReservations)
        .set({ status: "COMPLETED", completedAt: new Date() })
        .where(eq(uploadReservations.id, reservation.id));
      return asset;
    });
  }

  async cleanupExpired(options: { userId?: string; limit?: number } = {}) {
    const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
    const conditions = [
      eq(uploadReservations.status, "PENDING"),
      lt(uploadReservations.expiresAt, new Date()),
    ];
    if (options.userId) conditions.push(eq(uploadReservations.userId, options.userId));

    const expired = await db
      .select({ id: uploadReservations.id, storageKey: uploadReservations.storageKey })
      .from(uploadReservations)
      .where(and(...conditions))
      .limit(limit);
    const storage = getStorage();
    let deleted = 0;
    for (let index = 0; index < expired.length; index += 10) {
      const batch = expired.slice(index, index + 10);
      await Promise.all(
        batch.map(async (reservation) => {
          try {
            await storage.deleteObject(reservation.storageKey);
            await db
              .update(uploadReservations)
              .set({ status: "EXPIRED" })
              .where(
                and(
                  eq(uploadReservations.id, reservation.id),
                  eq(uploadReservations.status, "PENDING")
                )
              );
            deleted += 1;
          } catch (error) {
            console.error("[Upload cleanup] Failed to delete expired object", {
              reservationId: reservation.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        })
      );
    }
    await pruneExpiredRateLimits();
    return { scanned: expired.length, deleted };
  }
}

export const uploadReservationService = new UploadReservationService();
export { uploadLimits };
