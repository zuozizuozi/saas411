import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { db } from "@/db";
import { creditPackages, paymentOrders } from "@/db/schema";
import { and, desc, eq, lt } from "drizzle-orm";
import type { CreditTransType } from "@/db/schema";
import { parsePageLimit, parsePositiveCursor } from "@/lib/api/pagination";

/**
 * GET /api/v1/user/billing
 *
 * Get user's purchase history (credit packages)
 * Query params:
 * - limit: number of items per page (default: 20)
 * - cursor: pagination cursor (creditPackages.id)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);

    const limit = parsePageLimit(searchParams.get("limit"));
    const cursor = parsePositiveCursor(searchParams.get("cursor"));

    // Get ORDER_PAY type value
    const orderPayType: CreditTransType = "ORDER_PAY";

    const conditions = [
      eq(creditPackages.userId, user.id),
      eq(creditPackages.transType, orderPayType),
      eq(paymentOrders.userId, user.id),
      eq(creditPackages.orderNo, paymentOrders.orderNo),
    ];
    if (cursor) conditions.push(lt(creditPackages.id, cursor));

    // Only return purchases backed by the immutable Stripe payment ledger.
    const packages = await db
      .select({
        id: creditPackages.id,
        initialCredits: creditPackages.initialCredits,
        paymentStatus: paymentOrders.status,
        amount: paymentOrders.amount,
        currency: paymentOrders.currency,
        createdAt: paymentOrders.createdAt,
      })
      .from(creditPackages)
      .innerJoin(paymentOrders, eq(creditPackages.orderNo, paymentOrders.orderNo))
      .where(and(...conditions))
      .orderBy(desc(creditPackages.createdAt))
      .limit(limit + 1);

    // Check if there's more data
    const hasMore = packages.length > limit;
    const results = hasMore ? packages.slice(0, limit) : packages;

    // Get next cursor
    const nextCursor = hasMore && results.length > 0
      ? String(results[results.length - 1].id)
      : null;

    // Transform to invoice format
    const invoices = results.map((pkg) => {
      const initialCredits = pkg.initialCredits;
      const itemDescription = initialCredits === 100
        ? "100 Credits"
        : initialCredits === 500
        ? "500 Credits"
        : initialCredits === 1000
        ? "1000 Credits"
        : initialCredits === 5000
        ? "5000 Credits"
        : `${initialCredits} Credits`;

      const status = (() => {
        if (pkg.paymentStatus === "PAID") return "paid" as const;
        if (pkg.paymentStatus === "PENDING") return "pending" as const;
        if (pkg.paymentStatus === "PARTIALLY_REFUNDED") {
          return "partially_refunded" as const;
        }
        if (pkg.paymentStatus === "REFUNDED") return "refunded" as const;
        if (pkg.paymentStatus === "DISPUTED") return "disputed" as const;
        if (pkg.paymentStatus === "DISPUTE_WON") return "paid" as const;
        return "failed" as const;
      })();

      return {
        id: String(pkg.id),
        userId: user.id,
        amount: pkg.amount / 100,
        currency: pkg.currency.toUpperCase(),
        status,
        items: [
          {
            type: "credits",
            description: itemDescription,
            quantity: initialCredits,
          },
        ],
        createdAt: pkg.createdAt,
      };
    });

    return apiSuccess({
      user: {
        email: user.email,
        id: user.id,
        createdAt: user.createdAt,
      },
      invoices,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
