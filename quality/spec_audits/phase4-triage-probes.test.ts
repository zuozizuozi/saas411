import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Phase 4 executable triage probes", () => {
  it("rejects the BUG-001 404 claim: middleware lines 12 and 41 redirect /dashboard", () => {
    const body = source("src/middleware.ts");
    expect(body).toContain('"/dashboard": "/text-to-video"');
    expect(body).toContain("return NextResponse.redirect(url)");
    expect(body).toContain('"/((?!api|_next|.*\\\\..*).*)"');
  });

  it.fails("confirms BUG-002 at reconcile line 43: exhaustion must not return PENDING", () => {
    const body = source("src/app/api/internal/workflows/video-reconcile/route.ts");
    expect(body).not.toContain('return { status: "PENDING", reason: "reconciliation-window-exhausted" }');
  });

  it("establishes BUG-003 intent facts: Bailian line 397 omits callbackUrl and ingress line 16 rejects it", () => {
    const mapping = source("src/ai/model-mapping.ts");
    const transformer = mapping.slice(
      mapping.indexOf("function bailianParamsTransformer"),
      mapping.indexOf("// ============================================================================", mapping.indexOf("function bailianParamsTransformer"))
    );
    const callback = source("src/app/api/v1/video/callback/[provider]/route.ts");
    expect(transformer).not.toContain("callbackUrl");
    expect(callback).toContain('["evolink", "kie", "apimart", "zhipu"]');
  });

  it.fails("confirms BUG-004 at callback line 40: callback JSON must use a bounded reader", () => {
    const body = source("src/app/api/v1/video/callback/[provider]/route.ts");
    expect(body).toContain("readRequestTextWithLimit");
    expect(body).not.toContain("await request.json()");
  });

  it.fails("confirms BUG-005 at README line 145: callback secret name must match executable code", () => {
    expect(source("README.md")).not.toContain("AI_CALLBACK_SECRET");
    expect(source("docs/API-INTEGRATION-GUIDE.md")).not.toContain("AI_CALLBACK_SECRET");
  });

  it.fails("confirms BUG-006 at CSP line 17: emitted Vercel scripts need their script origin", () => {
    const layout = source("src/app/layout.tsx");
    const config = source("next.config.mjs");
    expect(layout).toContain("<Analytics />");
    expect(layout).toContain("<SpeedInsights />");
    expect(config).toContain("https://va.vercel-scripts.com");
  });

  it.fails("confirms BUG-007 at storage lines 75 and 108: fetch must bind to a validated DNS answer", () => {
    const body = source("src/lib/storage.ts");
    expect(body).toMatch(/lookup\(url\.hostname/);
    expect(body).not.toContain('fetch(currentUrl, { redirect: "manual", signal })');
    expect(body).toMatch(/dispatcher|connect:\s*\{|lookup:\s*\(/);
  });

  it.fails("confirms BUG-008 at credit history lines 22-30: every API alias must have a locale key", () => {
    const route = source("src/app/api/v1/credit/history/route.ts");
    const mappingBlock = route.slice(route.indexOf("const transTypeMapping"), route.indexOf("export async function GET"));
    const aliases = [...mappingBlock.matchAll(/:\s*"([a-z_]+)"/g)].map((match) => match[1]);
    const messages = JSON.parse(source("src/messages/en.json"));
    const keys = Object.keys(messages.dashboard.credits.types);
    expect(aliases.filter((alias) => !keys.includes(alias))).toEqual([]);
  });

  it.fails("confirms BUG-009 at upstash line 10: scheduler and handler must require the same credentials", () => {
    const scheduler = source("src/lib/upstash.ts");
    expect(scheduler).toContain("QSTASH_CURRENT_SIGNING_KEY");
    expect(scheduler).toContain("QSTASH_NEXT_SIGNING_KEY");
  });

  it.fails("confirms BUG-010 at use-videos lines 33-36: status/model/sort must reach the list contract", () => {
    const hook = source("src/hooks/use-videos.ts");
    const query = hook.slice(hook.indexOf("apiClient.getVideos"), hook.indexOf("});", hook.indexOf("apiClient.getVideos")));
    expect(query).toContain("status:");
    expect(query).toContain("model:");
    expect(query).toContain("sortBy:");
  });
});
