function normalizePath(path: string): string {
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  return withLeadingSlash.length > 1
    ? withLeadingSlash.replace(/\/$/, "")
    : withLeadingSlash;
}

export function isAdminHrefActive(pathname: string, href: string): boolean {
  const normalizedPathname = normalizePath(pathname);
  const normalizedHref = normalizePath(href);

  if (normalizedHref === "/admin") {
    return normalizedPathname === normalizedHref;
  }

  return (
    normalizedPathname === normalizedHref ||
    normalizedPathname.startsWith(`${normalizedHref}/`)
  );
}
