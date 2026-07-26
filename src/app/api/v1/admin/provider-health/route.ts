import { ApiError } from "@/lib/api/error";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { isAdmin } from "@/lib/auth/admin";
import { providerHealthService } from "@/services/provider-health";

export async function GET() {
  try {
    if (!(await isAdmin())) throw new ApiError("Forbidden", 403);
    return apiSuccess({ providers: await providerHealthService.summaries(60) });
  } catch (error) {
    return handleApiError(error);
  }
}
