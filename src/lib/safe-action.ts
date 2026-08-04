import { createSafeActionClient } from "next-safe-action";

import { getServerSession } from "@/lib/auth";

export const actionClient = createSafeActionClient({
  handleServerError: (e) => {
    console.error("[Server Action] request failed", e);
    if (process.env.NODE_ENV === "development" && e instanceof Error) {
      return { success: false, error: e.message };
    }
    return { success: false, error: "Request failed" };
  },
});

export const userActionClient = actionClient.use(async ({ next }) => {
  const session = await getServerSession();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  return next({ ctx: { user: session.user } });
});

export const adminActionClient = userActionClient.use(async ({ next, ctx }) => {
  if (!ctx.user?.isAdmin) {
    throw new Error("Forbidden");
  }
  return next({ ctx });
});
