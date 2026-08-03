# Multilingual Module Specification

## Scope

- Reference: `https://evolink.ai/zh`
- Target: seedance.co locale routing and language selector only.
- Do not copy EvoLink branding, marketing copy, fonts, colors, or assets.

## Reference behavior

- The selector is a globe/language button in the site header.
- The menu is click-driven and anchored to the right side of the trigger.
- Each option shows a short locale mark and a native language name.
- The current locale has a highlighted background, stronger text, and a check mark.
- Selecting a locale keeps the current pathname, query string, and hash while changing the locale prefix.
- Default English uses no URL prefix. Other languages use a locale prefix.
- The menu is available in both desktop and compact/mobile headers.

## Supported locales

| Locale | Mark | Native name | hreflang |
| --- | --- | --- | --- |
| en | EN | English | en |
| fr | FR | Français | fr |
| de | DE | Deutsch | de |
| zh | 中 | 中文 | zh-CN |
| ja | JA | 日本語 | ja |
| ko | KO | 한국어 | ko |
| es | ES | Español | es |

## seedance.co implementation

- Keep `next-intl` as the routing and message runtime.
- Centralize locale metadata and use one reusable language selector.
- Use `LocaleLink`/locale router instead of handwritten path replacement.
- Persist locale preference with the existing `NEXT_LOCALE` cookie.
- Generate canonical and hreflang alternates for every supported locale.
- Non-English translation files may be partial; missing keys must deep-fallback to English so pages never render missing-message errors.
- Core header actions and the primary generator/marketing messages must not claim free generation.

## Accessibility

- Trigger has an explicit localized `aria-label`.
- Menu items expose native language names.
- Current locale is marked with a check icon and `aria-current` semantics where supported.
- Disabled or unavailable locales are not shown.

## Responsive behavior

- Desktop: locale mark plus optional native name depending on available width.
- Mobile: compact mark-only trigger; full native names remain in the menu.
- Menu remains within the viewport and right-aligned.

