import { NextRequest } from "next/server";

import { creditService, type CreditTransType } from "@/services/credit";

import { requireAuth } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/error";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { parsePageLimit, parsePageOffset } from "@/lib/api/pagination";

const allowedTransTypes = new Set<CreditTransType>([
  "NEW_USER",
  "ORDER_PAY",
  "SUBSCRIPTION",
  "VIDEO_CONSUME",
  "REFUND",
  "EXPIRED",
  "SYSTEM_ADJUST",
  "PAYMENT_REVERSAL",
]);

// Map database enum values to frontend expected format
const transTypeMapping: Record<CreditTransType, string> = {
  NEW_USER: "new_user",
  ORDER_PAY: "order_pay",
  SUBSCRIPTION: "subscription",
  VIDEO_CONSUME: "video_generate",
  REFUND: "video_refund",
  EXPIRED: "expired",
  SYSTEM_ADJUST: "admin_adjust",
  PAYMENT_REVERSAL: "payment_reversal",
};

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);

    const limit = parsePageLimit(searchParams.get("limit"));
    const offset = parsePageOffset(
      searchParams.get("cursor") ?? searchParams.get("offset")
    );
    const requestedType = searchParams.get("type") as CreditTransType | null;
    if (requestedType && !allowedTransTypes.has(requestedType)) {
      throw new ApiError("Invalid credit transaction type", 400);
    }

    const result = await creditService.getHistory(user.id, {
      limit,
      offset,
      transType: requestedType ?? undefined,
    });

    // Transform transType to frontend-expected format
    const transformedRecords = result.records.map((record) => ({
      id: record.id.toString(), // Ensure ID is string
      userId: record.userId,
      credits: record.credits,
      balanceAfter: record.balanceAfter,
      transType: transTypeMapping[record.transType] ?? record.transType.toLowerCase(),
      videoUuid: record.videoUuid,
      remark: record.remark,
      createdAt: record.createdAt,
    }));

    const hasMore = offset + limit < result.total;
    const nextCursor = hasMore ? (offset + limit).toString() : null;

    return apiSuccess({
      transactions: transformedRecords,
      total: result.total,
      hasMore,
      nextCursor,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
