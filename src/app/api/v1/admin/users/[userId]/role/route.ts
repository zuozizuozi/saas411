import { count, eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { ApiError } from "@/lib/api/error";
import { requireAdmin } from "@/lib/api/auth";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    await requireAdmin(request);
    const { userId } = await params;
    const body = (await request.json()) as { isAdmin?: unknown };

    if (typeof body.isAdmin !== "boolean") {
      throw new ApiError("isAdmin must be a boolean", 400);
    }
    const nextIsAdmin = body.isAdmin;

    const updatedUser = await db.transaction(async (tx) => {
      const [target] = await tx
        .select({ id: users.id, email: users.email, isAdmin: users.isAdmin })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!target) throw new ApiError("User not found", 404);

      if (target.isAdmin && !nextIsAdmin) {
        const [result] = await tx
          .select({ count: count() })
          .from(users)
          .where(eq(users.isAdmin, true));

        if ((result?.count ?? 0) <= 1) {
          throw new ApiError("Cannot remove the last administrator", 409);
        }
      }

      const [updated] = await tx
        .update(users)
        .set({ isAdmin: nextIsAdmin, updatedAt: new Date() })
        .where(eq(users.id, target.id))
        .returning({
          id: users.id,
          email: users.email,
          isAdmin: users.isAdmin,
        });

      return updated;
    });

    return apiSuccess({ user: updatedUser });
  } catch (error) {
    return handleApiError(error);
  }
}
