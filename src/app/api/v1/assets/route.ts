import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { mediaAssetService } from "@/services/media-asset";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const parsedLimit = Number.parseInt(
      request.nextUrl.searchParams.get("limit") || "24",
      10
    );
    const assets = await mediaAssetService.listImages(user.id, parsedLimit);
    return apiSuccess({ assets });
  } catch (error) {
    return handleApiError(error);
  }
}
