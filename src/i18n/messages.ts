import { supplementalMessages } from "@/i18n/supplemental-messages";

type Messages = Record<string, unknown>;

function mergeMessages(base: Messages, override: Messages): Messages {
  const merged: Messages = { ...base };

  for (const [key, value] of Object.entries(override)) {
    const baseValue = merged[key];
    if (
      value &&
      baseValue &&
      typeof value === "object" &&
      typeof baseValue === "object" &&
      !Array.isArray(value) &&
      !Array.isArray(baseValue)
    ) {
      merged[key] = mergeMessages(baseValue as Messages, value as Messages);
    } else {
      merged[key] = value;
    }
  }

  return merged;
}

/**
 * Every locale inherits the complete English catalog. This lets us ship a
 * language progressively without rendering missing-message errors.
 */
async function getMessagesForLocale(locale: string) {
  const defaultMessages = (await import(`@/messages/en.json`)).default as Messages;
  const supplemental = supplementalMessages[locale] ?? {};
  if (locale === "en") return mergeMessages(defaultMessages, supplemental);

  try {
    const messages = (await import(`@/messages/${locale}.json`)).default as Messages;
    return mergeMessages(mergeMessages(defaultMessages, messages), supplemental);
  } catch {
    console.warn(`Translation for locale "${locale}" not found, falling back to "en"`);
    return mergeMessages(defaultMessages, supplemental);
  }
}

export { getMessagesForLocale };
