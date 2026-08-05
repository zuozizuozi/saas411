import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("CreditsPage payment return URL", () => {
  const source = readFileSync(
    new URL("./credits-page.tsx", import.meta.url),
    "utf8",
  );

  it("sanitizes returnTo before passing it to the Next.js router", () => {
    expect(source).toContain('getSafeAuthCallbackURL(returnTo, "")');
    expect(source).not.toContain("decodeURIComponent(returnTo)");
  });
});
