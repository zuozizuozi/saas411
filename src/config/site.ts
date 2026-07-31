/**
 * Site configuration
 * Central place for website settings, auth providers, and features
 */
export interface SiteConfig {
  name: string;
  supportEmail?: string;
  description: string;
  url: string;
  ogImage: string;
  links: {
    github?: string;
    twitter?: string;
    discord?: string;
  };
  auth: {
    enableGoogleLogin: boolean;
    enableEmailOtpLogin: boolean;
    defaultProvider: "google" | "email";
  };
  routes: {
    defaultLoginRedirect: string;
  };
}

export const siteConfig: SiteConfig = {
  name: "seedance.co",
  supportEmail: "support@seedance.co.com",
  description: "AI Video Generation Platform - Create stunning videos with Sora 2, Veo 3.1, and more",
  url: process.env.NEXT_PUBLIC_APP_URL || "https://seedance.co.com",
  ogImage: "/og.png",
  links: {},
  auth: {
    enableGoogleLogin: true,
    enableEmailOtpLogin: true,
    defaultProvider: "google",
  },
  routes: {
    defaultLoginRedirect: "/text-to-video",
  },
};

// Helper to get enabled auth providers
export function getEnabledAuthProviders() {
  const providers: string[] = [];
  if (siteConfig.auth.enableGoogleLogin) providers.push("google");
  if (siteConfig.auth.enableEmailOtpLogin) providers.push("email");
  return providers;
}
