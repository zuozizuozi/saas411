/**
 * Accept only an application-local callback path.
 *
 * OAuth and email sign-in entry points may receive `from` from the URL. Keeping
 * callbacks relative prevents protocol-relative and absolute open redirects.
 */
export function getSafeAuthCallbackURL(
  candidate: string | null | undefined,
  fallback: string,
): string {
  const value = candidate?.trim();
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  try {
    const parsed = new URL(value, "https://seedance.co.com");
    if (parsed.origin !== "https://seedance.co.com") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
