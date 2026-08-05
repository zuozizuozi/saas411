import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

it("ends an exhausted durable reconciliation through the failure/release path", () => {
  const source = readFileSync(
    join(process.cwd(), "src/app/api/internal/workflows/video-reconcile/route.ts"),
    "utf8"
  );

  expect(source).toContain("attempt < 80");
  expect(source).toContain("failGeneration");
  expect(source).toContain("wait-for-active-upload-lease");
  expect(source).not.toContain(
    'status: "PENDING", reason: "reconciliation-window-exhausted"'
  );
});
