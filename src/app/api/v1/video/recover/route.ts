import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { z } from "zod";

import { db, videos, VideoStatus } from "@/db";
import { requireAdmin } from "@/lib/api/auth";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { videoService } from "@/services/video";

const recoverSchema = z.object({
  videoUuid: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

const activeStatuses = [
  VideoStatus.PENDING,
  VideoStatus.GENERATING,
  VideoStatus.UPLOADING,
];

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const records = await db
      .select({
        uuid: videos.uuid,
        userId: videos.userId,
        provider: videos.provider,
        externalTaskId: videos.externalTaskId,
        status: videos.status,
        errorMessage: videos.errorMessage,
        createdAt: videos.createdAt,
        updatedAt: videos.updatedAt,
      })
      .from(videos)
      .where(inArray(videos.status, activeStatuses))
      .orderBy(desc(videos.updatedAt))
      .limit(50);
    return apiSuccess({ records });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const input = recoverSchema.parse(await request.json().catch(() => ({})));
    const staleBefore = new Date(Date.now() - 10 * 60 * 1000);
    const records = await db
      .select()
      .from(videos)
      .where(
        input.videoUuid
          ? and(
              eq(videos.uuid, input.videoUuid),
              inArray(videos.status, activeStatuses)
            )
          : and(
              inArray(videos.status, activeStatuses),
              lt(videos.updatedAt, staleBefore)
            )
      )
      .orderBy(desc(videos.updatedAt))
      .limit(input.limit);

    const results = [];
    for (const video of records) {
      try {
        if (!video.externalTaskId) {
          const result = await videoService.failGeneration(
            video.uuid,
            "Generation submission did not produce a provider task"
          );
          results.push({ uuid: video.uuid, ...result });
          continue;
        }
        const result = await videoService.refreshStatus(video.uuid, video.userId);
        results.push({ uuid: video.uuid, ...result });
      } catch (error) {
        results.push({
          uuid: video.uuid,
          status: video.status,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return apiSuccess({ recovered: results.length, results });
  } catch (error) {
    return handleApiError(error);
  }
}
