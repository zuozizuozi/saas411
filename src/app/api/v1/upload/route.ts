import { requireAuth } from "@/lib/api/auth";
import { apiError, handleApiError } from "@/lib/api/response";

/**
 * Legacy multipart uploads buffered the request inside the application server.
 * Reference images now use the bounded presign -> PUT -> complete flow.
 */
export async function POST(request: Request) {
  try {
    await requireAuth(request);
    return apiError(
      "Direct uploads are disabled. Use /api/v1/upload/presign and /complete.",
      410
    );
  } catch (error) {
    return handleApiError(error);
  }
}
