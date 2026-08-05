import { NextRequest } from "next/server";
import { videoService } from "@/services/video";
import { requireAuth } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/error";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { parsePageLimit } from "@/lib/api/pagination";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const requestedSort = searchParams.get("sortBy");
    if (requestedSort && requestedSort !== "newest" && requestedSort !== "oldest") {
      throw new ApiError("Invalid video sort order", 400);
    }
    const sortBy =
      requestedSort === "oldest"
        ? "oldest"
        : requestedSort === "newest"
          ? "newest"
          : undefined;

    const result = await videoService.listVideos(user.id, {
      limit: parsePageLimit(searchParams.get("limit")),
      cursor: searchParams.get("cursor") || undefined,
      status: searchParams.get("status") || undefined,
      model: searchParams.get("model") || undefined,
      sortBy,
    });

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
