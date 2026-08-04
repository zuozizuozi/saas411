import { z } from "zod";

import { requireAdmin } from "@/lib/api/auth";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { creditService } from "@/services/credit";

const schema = z.object({
  debtReduction: z.number().int().min(0).default(0),
  restoreAccess: z.boolean().default(false),
  remark: z.string().trim().min(3).max(500),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const admin = await requireAdmin(request);
    const { userId } = await params;
    const input = schema.parse(await request.json());
    const result = await creditService.resolvePaymentRestriction({
      userId,
      adminUserId: admin.id,
      ...input,
    });
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
