import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";

import { siteConfig } from "@/config/site";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { creditService } from "@/services/credit";
import { env } from "./env.mjs";

const toLogString = (value: unknown) => {
  if (value === null || value === undefined) return String(value);
  if (typeof value === "string") return value;
  const normalized =
    value instanceof Error
      ? {
          name: value.name,
          message: value.message,
          stack: value.stack,
          status: (value as unknown as Record<string, unknown>).status,
          statusText: (value as unknown as Record<string, unknown>).statusText,
          error: (value as unknown as Record<string, unknown>).error,
        }
      : value;
  const seen = new WeakSet();
  try {
    return JSON.stringify(normalized, (_key, item) => {
      if (typeof item === "bigint") return item.toString();
      if (typeof item === "function") return "[Function]";
      if (typeof item === "object" && item !== null) {
        if (seen.has(item)) return "[Circular]";
        seen.add(item);
      }
      return item;
    });
  } catch {
    return String(normalized);
  }
};

const debugLogger =
  process.env.NODE_ENV === "development"
    ? {
        level: "debug" as const,
        log: (
          level: "debug" | "info" | "warn" | "error",
          message: string,
          ...args: unknown[]
        ) => {
          const suffix = args.length
            ? ` ${args.map(toLogString).join(" ")}`
            : "";
          const line = `[Better Auth] ${message}${suffix}`.trimEnd();
          if (level === "error") console.error(line);
          else if (level === "warn") console.warn(line);
          else console.log(line);
        },
      }
    : undefined;

type AuthPlugin = ReturnType<typeof nextCookies> | ReturnType<typeof emailOTP>;

const plugins: AuthPlugin[] = [
  emailOTP({
    sendVerificationOTP: async ({ email, otp, type }) => {
      const { resend } = await import("@/lib/email");
      const emailDomain = email.split("@").at(-1) ?? "unknown";
      const purpose = {
        "sign-in": "sign in to",
        "email-verification": "verify your email for",
        "forget-password": "reset your password for",
        "change-email": "change the email address for",
      }[type];
      const subject = `${otp} is your ${siteConfig.name} verification code`;
      const { error } = await resend.emails.send({
        from: env.RESEND_FROM,
        to: email,
        subject,
        html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px"><h1 style="font-size:24px;text-align:center">${siteConfig.name}</h1><p>Enter this code to ${purpose} your account:</p><p style="font-size:36px;font-weight:700;letter-spacing:10px;text-align:center;background:#f4f4f5;border-radius:8px;padding:16px">${otp}</p><p>This code expires in 5 minutes and can only be used once.</p><p>If you did not request this code, you can safely ignore this email.</p></div>`,
        text: `${subject}\n\nEnter this code to ${purpose} your account: ${otp}\n\nThis code expires in 5 minutes and can only be used once.`,
        headers: { "X-Entity-Ref-ID": crypto.randomUUID() },
      });
      if (error) {
        console.error("[Auth OTP] delivery rejected", {
          emailDomain,
          type,
          message: error.message,
        });
        throw new Error("Verification email delivery failed");
      }
      console.info("[Auth OTP] delivery accepted", { emailDomain, type });
    },
    otpLength: 6,
    expiresIn: 300,
    allowedAttempts: 3,
    storeOTP: "hashed",
  }),
  // Better Auth requires nextCookies to run last so it can forward every
  // Set-Cookie header produced by the plugins above (including email OTP).
  ...(process.env.NODE_ENV === "development" ? [] : [nextCookies()]),
];

const skipEnvironmentValidation = Boolean(process.env.SKIP_ENV_VALIDATION);
const buildOnlySecret =
  "videofly-build-only-secret-never-use-at-runtime";

export const auth = betterAuth({
  baseURL:
    env.NEXT_PUBLIC_APP_URL ??
    (skipEnvironmentValidation ? "http://localhost:3000" : undefined),
  basePath: "/api/auth",
  secret:
    env.BETTER_AUTH_SECRET ??
    (skipEnvironmentValidation ? buildOnlySecret : undefined),
  logger: debugLogger,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  plugins,
  hooks: {
    after: createAuthMiddleware(async (context) => {
      const userId = context.context?.newSession?.user?.id;
      if (!userId) return;
      try {
        await creditService.grantNewUserCredits(userId);
      } catch (error) {
        console.error("[Auth] Failed to grant new user credits:", error);
      }
    }),
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      prompt: "select_account",
    },
  },
  user: {
    additionalFields: {
      isAdmin: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
    },
  },
  session: {
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
});

export type User = typeof auth.$Infer.Session.user & {
  isAdmin?: boolean | null;
};

type BaseSession = typeof auth.$Infer.Session;
export type Session = {
  session: BaseSession["session"];
  user: User;
};
