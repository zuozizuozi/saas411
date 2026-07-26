import { getAvailableModels } from "@/config/credits";
import { getModelRoutePolicy } from "@/ai/routing";
import { isAdmin } from "@/lib/auth/admin";
import { apiError, apiSuccess } from "@/lib/api/response";

/** Read-only operational model catalogue for the Refine admin console. */
export async function GET() {
  if (!(await isAdmin())) {
    return apiError("Admin access required", 403);
  }

  const models = getAvailableModels({ enabledOnly: false }).map((model) => ({
    ...model,
    route: getModelRoutePolicy(model.id),
  }));

  return apiSuccess({ models });
}
