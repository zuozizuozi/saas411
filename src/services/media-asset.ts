import { and, desc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";

import { db, mediaAssets } from "@/db";
import { ApiError } from "@/lib/api/error";

export class MediaAssetService {
  async create(input: {
    userId: string;
    storageKey: string;
    url: string;
    fileName: string;
    contentType: string;
    fileSize: number;
  }) {
    const [asset] = await db
      .insert(mediaAssets)
      .values({ uuid: `asset_${nanoid(21)}`, kind: "IMAGE", ...input })
      .onConflictDoNothing({ target: mediaAssets.storageKey })
      .returning();
    if (asset) return asset;
    const [existing] = await db
      .select()
      .from(mediaAssets)
      .where(and(eq(mediaAssets.userId, input.userId), eq(mediaAssets.storageKey, input.storageKey)))
      .limit(1);
    if (!existing) throw new Error("Failed to save media asset");
    return existing;
  }

  async listImages(userId: string, limit = 24) {
    return db
      .select({
        uuid: mediaAssets.uuid,
        url: mediaAssets.url,
        fileName: mediaAssets.fileName,
        contentType: mediaAssets.contentType,
        fileSize: mediaAssets.fileSize,
        createdAt: mediaAssets.createdAt,
      })
      .from(mediaAssets)
      .where(and(eq(mediaAssets.userId, userId), eq(mediaAssets.kind, "IMAGE")))
      .orderBy(desc(mediaAssets.createdAt))
      .limit(Math.min(Math.max(limit, 1), 50));
  }

  async assertOwnedImageUrls(userId: string, urls: string[]) {
    const uniqueUrls = Array.from(new Set(urls));
    if (uniqueUrls.length === 0) return;
    const records = await db
      .select({ url: mediaAssets.url })
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.userId, userId),
          eq(mediaAssets.kind, "IMAGE"),
          inArray(mediaAssets.url, uniqueUrls)
        )
      );
    if (new Set(records.map((record) => record.url)).size !== uniqueUrls.length) {
      throw new ApiError(
        "Every input image must belong to the authenticated user",
        403
      );
    }
  }
}

export const mediaAssetService = new MediaAssetService();
