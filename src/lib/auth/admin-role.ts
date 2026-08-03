import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";

/**
 * Read the current admin flag from the database.
 *
 * Admin authorization must not rely on Better Auth's cookie cache because
 * role grants and revocations need to take effect immediately.
 */
export async function hasAdminRole(userId: string): Promise<boolean> {
  const [user] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user?.isAdmin === true;
}
