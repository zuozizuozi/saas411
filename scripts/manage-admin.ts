#!/usr/bin/env tsx

import { count, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";

type Action = "list" | "grant" | "revoke";

const action = process.argv[2] as Action | undefined;
const email = process.argv[3]?.trim().toLowerCase();

function usage() {
  console.error("Usage:");
  console.error("  pnpm script:list-admins");
  console.error("  pnpm script:set-admin -- user@example.com");
  console.error("  pnpm script:remove-admin -- user@example.com");
}

async function listAdmins() {
  const admins = await db
    .select({ email: users.email, updatedAt: users.updatedAt })
    .from(users)
    .where(eq(users.isAdmin, true))
    .orderBy(users.email);

  if (admins.length === 0) {
    console.log("No administrators configured.");
    return;
  }

  console.table(admins);
}

async function updateAdminRole(isAdmin: boolean) {
  if (!email) {
    usage();
    process.exitCode = 1;
    return;
  }

  await db.transaction(async (tx) => {
    const [target] = await tx
      .select({ id: users.id, email: users.email, isAdmin: users.isAdmin })
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);

    if (!target) {
      throw new Error(`User not found: ${email}. The user must sign in once first.`);
    }

    if (target.isAdmin && !isAdmin) {
      const [result] = await tx
        .select({ count: count() })
        .from(users)
        .where(eq(users.isAdmin, true));

      if ((result?.count ?? 0) <= 1) {
        throw new Error("Cannot remove the last administrator.");
      }
    }

    await tx
      .update(users)
      .set({ isAdmin, updatedAt: new Date() })
      .where(eq(users.id, target.id));

    console.log(
      `${target.email}: ${isAdmin ? "administrator granted" : "administrator revoked"}`,
    );
  });
}

async function run() {
  if (action === "list") return listAdmins();
  if (action === "grant") return updateAdminRole(true);
  if (action === "revoke") return updateAdminRole(false);

  usage();
  process.exitCode = 1;
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
