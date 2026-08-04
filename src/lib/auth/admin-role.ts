import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { env } from "./env.mjs";

/**
 * Read the current admin flag from the database.
 *
 * Admin authorization must not rely on Better Auth's cookie cache because
 * role grants and revocations need to take effect immediately.
 */
export async function hasAdminRole(userId: string): Promise<boolean> {
  const [user] = await db
    .select({ isAdmin: users.isAdmin, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return false;
  const bootstrapAdminEmail = env.ADMIN_EMAIL?.trim().toLowerCase();
  return (
    user.isAdmin === true ||
    (Boolean(bootstrapAdminEmail) &&
      user.email.trim().toLowerCase() === bootstrapAdminEmail)
  );
}
