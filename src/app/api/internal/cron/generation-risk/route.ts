import { timingSafeEqual } from "node:crypto";

import { generationRiskService } from "@/services/generation-risk";

function hasValidCronSecret(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || !authorization?.startsWith("Bearer ")) return false;
  const provided = Buffer.from(authorization.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: "Generation risk scan is not configured" }, { status: 503 });
  }
  if (!hasValidCronSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await generationRiskService.scanRecentAnnualAccounts();
  return Response.json({ success: true, data: result });
}
