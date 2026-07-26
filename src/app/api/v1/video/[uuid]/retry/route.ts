import { requireAuth } from "@/lib/api/auth";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { videoService } from "@/services/video";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { uuid } = await params;
    return apiSuccess(await videoService.retryVideo(uuid, user.id));
  } catch (error) {
    return handleApiError(error);
  }
}
