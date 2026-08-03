import { describe, expect, it } from "vitest";

import { i18n, localeConfig } from "@/config/i18n-config";
import { buildAlternates } from "@/lib/seo";

describe("localized SEO alternates", () => {
  it("emits hreflang URLs for every supported locale", () => {
    const alternates = buildAlternates("/pricing", "fr");

    for (const locale of i18n.locales) {
      expect(alternates.languages[localeConfig[locale].hreflang]).toBeTruthy();
    }
    expect(alternates.languages["x-default"]).toBeTruthy();
    expect(alternates.canonical).toContain("/fr/pricing");
  });
});
