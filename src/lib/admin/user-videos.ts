import { db } from "@/db";
import { videos, VideoStatus } from "@/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";

export interface UserVideo {
  id: number;
  uuid: string;
  prompt: string;
  model: string;
  status: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  resolution: string | null;
  creditsUsed: number;
  createdAt: Date;
  completedAt: Date | null;
  errorMessage: string | null;
}

export interface UserVideosResult {
  videos: UserVideo[];
  totalVideos: number;
  totalPages: number;
}

/**
 * 获取指定用户的视频历史记录
 */
export async function getUserVideos({
  userId,
  page = 1,
  limit = 10,
  status,
}: {
  userId: string;
  page?: number;
  limit?: number;
  status?: VideoStatus;
}): Promise<UserVideosResult> {
  const offset = (page - 1) * limit;

  // 构建查询条件
  const whereConditions = [
    eq(videos.userId, userId),
    eq(videos.isDeleted, false),
  ];

  if (status) {
    whereConditions.push(eq(videos.status, status));
  }

  const conditions = and(...whereConditions);

  const totalResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(videos)
    .where(conditions);
  const videosResult = await db
    .select({
      id: videos.id,
      uuid: videos.uuid,
      prompt: videos.prompt,
      model: videos.model,
      status: videos.status,
      videoUrl: videos.videoUrl,
      thumbnailUrl: videos.thumbnailUrl,
      duration: videos.duration,
      resolution: videos.resolution,
      creditsUsed: videos.creditsUsed,
      createdAt: videos.createdAt,
      completedAt: videos.completedAt,
      errorMessage: videos.errorMessage,
    })
    .from(videos)
    .where(conditions)
    .orderBy(desc(videos.createdAt))
    .limit(limit)
    .offset(offset);

  const totalVideos = totalResult[0]?.count || 0;
  const totalPages = Math.ceil(totalVideos / limit);

  return {
    videos: videosResult as UserVideo[],
    totalVideos,
    totalPages,
  };
}

/**
 * 获取用户的视频统计信息
 */
export async function getUserVideoStats(userId: string) {
  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where ${videos.status} = ${VideoStatus.COMPLETED})::int`,
      failed: sql<number>`count(*) filter (where ${videos.status} = ${VideoStatus.FAILED})::int`,
      generating: sql<number>`count(*) filter (where ${videos.status} = ${VideoStatus.GENERATING})::int`,
    })
    .from(videos)
    .where(and(eq(videos.userId, userId), eq(videos.isDeleted, false)));

  const total = Number(stats?.total || 0);
  const completed = Number(stats?.completed || 0);
  const failed = Number(stats?.failed || 0);
  const generating = Number(stats?.generating || 0);

  const successRate = total > 0 ? (completed / total) * 100 : 0;

  return {
    total,
    completed,
    failed,
    generating,
    successRate: Math.round(successRate * 10) / 10,
  };
}
