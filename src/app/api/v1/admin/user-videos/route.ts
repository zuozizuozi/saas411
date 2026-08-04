import { NextRequest, NextResponse } from "next/server";

import { getUserVideos, getUserVideoStats } from "@/lib/admin/user-videos";
import { requireAdmin } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/response";
import { VideoStatus } from "@/db";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const searchParams = new URL(request.url).searchParams;
    const userId = searchParams.get("userId");
    const page = Number(searchParams.get("page") || "1");
    const rawStatus = searchParams.get("status");
    const status = rawStatus && rawStatus !== "all" ? rawStatus : undefined;

    if (!userId) {
      return NextResponse.json({ error: "Missing user ID" }, { status: 400 });
    }

    if (!Number.isInteger(page) || page < 1 || page > 10_000) {
      return NextResponse.json({ error: "Invalid page" }, { status: 400 });
    }

    if (
      status &&
      !Object.values(VideoStatus).includes(status as VideoStatus)
    ) {
      return NextResponse.json({ error: "Invalid video status" }, { status: 400 });
    }

    const videosData = await getUserVideos({
      userId,
      page,
      limit: 10,
      status: status as VideoStatus | undefined,
    });
    const stats = await getUserVideoStats(userId);

    return NextResponse.json({
      videos: videosData.videos,
      totalVideos: videosData.totalVideos,
      totalPages: videosData.totalPages,
      stats,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
