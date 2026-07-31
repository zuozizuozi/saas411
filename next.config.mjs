// @ts-check
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const canonicalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
const canonicalOrigin = canonicalAppUrl
  ? new URL(canonicalAppUrl).origin
  : "https://seedance.co.com";
const canonicalHostname = new URL(canonicalOrigin).hostname;

if (!process.env.SKIP_ENV_VALIDATION) {
  await import("./src/env.mjs");
  await import("./src/lib/auth/env.mjs");
}

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,
  pageExtensions: ["ts", "tsx"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: `www.${canonicalHostname}` }],
        destination: `${canonicalOrigin}/:path*`,
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "www.twillot.com" },
      { protocol: "https", hostname: "cdnv2.ruguoapp.com" },
      { protocol: "https", hostname: "www.setupyourpay.com" },
    ],
  },
  /** We already do linting and typechecking as separate tasks in CI */
  typescript: { ignoreBuildErrors: true },
  output: "standalone",
};

// Compose plugins
export default withNextIntl(config);
