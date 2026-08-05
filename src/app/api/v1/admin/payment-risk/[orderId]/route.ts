import { z } from "zod";

import { requireAdmin } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/error";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import {
  approvePaymentRiskOrder,
  blockPaymentRiskOrder,
} from "@/services/payment-risk";

const schema = z.object({
  decision: z.enum(["APPROVE", "BLOCK"]),
  remark: z.string().trim().min(3).max(500),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const admin = await requireAdmin(request);
    const orderId = Number.parseInt((await params).orderId, 10);
    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      throw new ApiError("Invalid payment order id", 400);
    }
    const input = schema.parse(await request.json());
    const result =
      input.decision === "APPROVE"
        ? await approvePaymentRiskOrder(orderId, admin.id, input.remark)
        : await blockPaymentRiskOrder(orderId, admin.id, input.remark);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
