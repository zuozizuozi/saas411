import { z } from "zod";

import { requireAdmin } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/error";
import { readRequestTextWithLimit } from "@/lib/api/request-body";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { generationRiskService } from "@/services/generation-risk";

const generationControlSchema = z.object({
  action: z.enum(["PAUSE", "RESUME"]),
  reason: z.string().trim().min(3).max(500),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const admin = await requireAdmin(request);
    const { userId } = await params;
    const rawBody = await readRequestTextWithLimit(request, 16 * 1024);
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      throw new ApiError("Invalid JSON body", 400);
    }
    const parsed = generationControlSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError("Invalid generation control request", 400, parsed.error.flatten());
    }

    const result = parsed.data.action === "PAUSE"
      ? await generationRiskService.pauseManually({
          userId,
          adminUserId: admin.id,
          reason: parsed.data.reason,
        })
      : await generationRiskService.resume({
          userId,
          adminUserId: admin.id,
          reason: parsed.data.reason,
        });
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
