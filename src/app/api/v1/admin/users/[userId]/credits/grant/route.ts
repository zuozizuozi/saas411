import { eq } from "drizzle-orm";
import { z } from "zod";

import { CreditTransType, db, users } from "@/db";
import { requireAdmin } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/error";
import { readRequestTextWithLimit } from "@/lib/api/request-body";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { creditService } from "@/services/credit";

const grantSchema = z.object({
  requestId: z.string().uuid(),
  credits: z.number().int().min(1).max(1_000_000),
  expiryDays: z.number().int().min(1).max(3_650).nullable(),
  reason: z.string().trim().min(3).max(500),
});

export async function POST(
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
    const parsed = grantSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError("Invalid credit grant", 400, parsed.error.flatten());
    }

    const [target] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!target) throw new ApiError("User not found", 404);

    const orderNo = `ADMIN_GRANT_${parsed.data.requestId}`;
    const result = await creditService.recharge({
      userId,
      credits: parsed.data.credits,
      orderNo,
      transType: CreditTransType.SYSTEM_ADJUST,
      expiryDays: parsed.data.expiryDays,
      operatorUserId: admin.id,
      remark: `Admin grant by ${admin.id}: ${parsed.data.reason}`,
    });
    return apiSuccess({
      packageId: result.packageId,
      userId,
      userEmail: target.email,
      credits: parsed.data.credits,
      expiryDays: parsed.data.expiryDays,
      orderNo,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
