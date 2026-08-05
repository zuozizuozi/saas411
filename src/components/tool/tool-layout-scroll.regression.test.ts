import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

it("gives the authenticated tool grid a definite flex height for panel scrolling", () => {
  const source = readFileSync(
    join(process.cwd(), "src/components/tool/tool-page-layout.tsx"),
    "utf8"
  );

  expect(source).toContain(
    'className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[440px_minmax(0,1.2fr)]"'
  );
  expect(source).not.toContain(
    'className="grid h-fit min-h-0 max-h-[calc(100svh-92px)]'
  );
});
