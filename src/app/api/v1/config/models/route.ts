import { getModelCatalog } from "@/config/credits";
import { apiSuccess } from "@/lib/api/response";

export async function GET() {
  const models = getModelCatalog();
  return apiSuccess(models);
}
