import { NextRequest } from "next/server";
import { videoService } from "@/services/video";
import { requireAuth } from "@/lib/api/auth";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { enforceRateLimit } from "@/services/rate-limit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { uuid } = await params;
    await enforceRateLimit({
      scope: "video-status",
      identifier: user.id,
      limit: 60,
      windowSeconds: 60,
    });

    // Refresh and get latest status
    const result = await videoService.refreshStatus(uuid, user.id);

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
