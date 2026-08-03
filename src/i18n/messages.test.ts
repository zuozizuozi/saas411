import { describe, expect, it } from "vitest";

import { i18n } from "@/config/i18n-config";
import { getMessagesForLocale } from "@/i18n/messages";

type CoreMessages = {
  Metadata: { title: string };
  Navigation: { createAccount: string };
  GeneratorPanel: { generate: string };
  Hero: { creditsHint: string; startCreating: string };
};

function flattenMessages(value: unknown, prefix = "", result: Record<string, unknown> = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    result[prefix] = value;
    return result;
  }

  for (const [key, child] of Object.entries(value)) {
    flattenMessages(child, prefix ? `${prefix}.${key}` : key, result);
  }
  return result;
}

function placeholders(value: unknown) {
  return typeof value === "string"
    ? [...value.matchAll(/\{([\w]+)\}/g)].map((match) => match[1]).sort()
    : [];
}

describe("localized message catalogs", () => {
  it.each(i18n.locales)("loads the %s catalog with core product copy", async (locale) => {
    const messages = await getMessagesForLocale(locale) as CoreMessages;

    expect(messages.Metadata.title).toContain("seedance.co");
    expect(messages.Navigation.createAccount).toBeTruthy();
    expect(messages.GeneratorPanel.generate).toBeTruthy();
    expect(messages.Hero.creditsHint.toLowerCase()).not.toContain("free");
  });

  it.each(i18n.locales.filter((locale) => locale !== "en"))(
    "uses a real localized core catalog for %s",
    async (locale) => {
      const en = await getMessagesForLocale("en") as CoreMessages;
      const messages = await getMessagesForLocale(locale) as CoreMessages;

      expect(messages.Metadata.title).not.toBe(en.Metadata.title);
      expect(messages.Navigation.createAccount).not.toBe(en.Navigation.createAccount);
    }
  );

  it.each(i18n.locales)("keeps the complete key, type, and placeholder contract for %s", async (locale) => {
    const en = flattenMessages(await getMessagesForLocale("en"));
    const messages = flattenMessages(await getMessagesForLocale(locale));

    expect(Object.keys(messages).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en)) {
      expect(typeof messages[key], key).toBe(typeof en[key]);
      expect(placeholders(messages[key]), key).toEqual(placeholders(en[key]));
    }
  });

  it.each(i18n.locales.filter((locale) => locale !== "en"))(
    "does not silently leave most of the %s catalog in English",
    async (locale) => {
      const en = flattenMessages(await getMessagesForLocale("en"));
      const messages = flattenMessages(await getMessagesForLocale(locale));
      const unchanged = Object.keys(en).filter(
        (key) => typeof en[key] === "string" && en[key] === messages[key]
      );

      expect(unchanged.length).toBeLessThan(50);
    }
  );

  it.each(i18n.locales)("uses the current brand and model catalog in %s", async (locale) => {
    const messages = JSON.stringify(await getMessagesForLocale(locale));

    expect(messages).not.toMatch(/VideoFly|seedance\.tv|seedance\.co\.com/i);
    expect(messages).not.toMatch(/Sora 2|Veo 3\.1/);
    expect(messages).toContain("Seedance 2.0 Mini");
  });

  it("keeps Chinese and English paid-access messaging aligned", async () => {
    const en = await getMessagesForLocale("en") as CoreMessages;
    const zh = await getMessagesForLocale("zh") as CoreMessages;

    expect(en.Hero.creditsHint).toMatch(/purchase credits|subscribe/i);
    expect(zh.Hero.creditsHint).toMatch(/购买积分|订阅/);
    expect(en.Hero.startCreating).not.toMatch(/free/i);
    expect(zh.Hero.startCreating).not.toMatch(/免费/);
  });
});
