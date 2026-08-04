// @ts-check
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const canonicalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
const canonicalOrigin = canonicalAppUrl
  ? new URL(canonicalAppUrl).origin
  : "https://seedance.co.com";
const canonicalHostname = new URL(canonicalOrigin).hostname;
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self' https://checkout.stripe.com",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""} https://js.stripe.com https://vercel.live`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data: https:",
  "connect-src 'self' https: wss:",
  "frame-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
  "worker-src 'self' blob:",
  "upgrade-insecure-requests",
].join("; ");

if (!process.env.SKIP_ENV_VALIDATION) {
  await import("./src/env.mjs");
  await import("./src/lib/auth/env.mjs");
}

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,
  poweredByHeader: false,
  pageExtensions: ["ts", "tsx"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
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
  // Production builds must fail when TypeScript finds an error.
  typescript: { ignoreBuildErrors: false },
  output: "standalone",
};

// Compose plugins
export default withNextIntl(config);
