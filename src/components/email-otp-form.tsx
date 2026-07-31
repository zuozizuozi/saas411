"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { authClient } from "@/lib/auth/client";
import { cn } from "@/components/ui";
import { Button } from "@/components/ui/button";
import * as Icons from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EmailOtpFormProps {
  callbackURL: string;
  buttonVariant?: "default" | "outline";
  disabled?: boolean;
  onSuccess?: () => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_PATTERN = /^\d{6}$/;
const RESEND_COOLDOWN_SECONDS = 60;

export function EmailOtpForm({
  callbackURL,
  buttonVariant = "default",
  disabled = false,
  onSuccess,
}: EmailOtpFormProps) {
  const t = useTranslations("EmailOtp");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => {
      setResendIn((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const sendCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError(t("invalid_email"));
      return;
    }

    setError("");
    setIsSending(true);
    try {
      const { error: sendError } =
        await authClient.emailOtp.sendVerificationOtp({
          email: normalizedEmail,
          type: "sign-in",
        });
      if (sendError) throw new Error(sendError.message);

      setEmail(normalizedEmail);
      setStep("otp");
      setOtp("");
      setResendIn(RESEND_COOLDOWN_SECONDS);
      toast.success(t("code_sent"), {
        description: t("check_inbox", { email: normalizedEmail }),
      });
    } catch (sendError) {
      console.error("Email OTP send error:", sendError);
      setError(t("send_error"));
    } finally {
      setIsSending(false);
    }
  };

  const verifyCode = async () => {
    if (!OTP_PATTERN.test(otp)) {
      setError(t("invalid_code"));
      return;
    }

    setError("");
    setIsVerifying(true);
    try {
      const { error: verifyError } = await authClient.signIn.emailOtp({
        email,
        otp,
      });
      if (verifyError) throw new Error(verifyError.message);

      onSuccess?.();
      window.location.assign(callbackURL);
    } catch (verifyError) {
      console.error("Email OTP verification error:", verifyError);
      setError(t("verify_error"));
    } finally {
      setIsVerifying(false);
    }
  };

  const resetEmail = () => {
    setStep("email");
    setOtp("");
    setError("");
    setResendIn(0);
  };

  const isBusy = disabled || isSending || isVerifying;

  return step === "email" ? (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void sendCode();
      }}
    >
      <div className="grid gap-1">
        <Label className="sr-only" htmlFor="login-email">
          {t("email_label")}
        </Label>
        <Input
          id="login-email"
          placeholder={t("email_placeholder")}
          type="email"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect="off"
          disabled={isBusy}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setError("");
          }}
          className={cn(error ? "border-red-500" : undefined)}
        />
        {error ? <p className="px-1 text-xs text-red-600">{error}</p> : null}
      </div>
      <Button type="submit" variant={buttonVariant} disabled={isBusy}>
        {isSending ? (
          <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Icons.Mail className="mr-2 h-4 w-4" />
        )}
        {isSending ? t("sending") : t("send_code")}
      </Button>
    </form>
  ) : (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void verifyCode();
      }}
    >
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="truncate text-muted-foreground">
          {t("sent_to", { email })}
        </span>
        <button
          type="button"
          onClick={resetEmail}
          disabled={isBusy}
          className="shrink-0 font-medium text-primary hover:underline disabled:opacity-50"
        >
          {t("change_email")}
        </button>
      </div>
      <div className="grid gap-1">
        <Label className="sr-only" htmlFor="login-otp">
          {t("code_label")}
        </Label>
        <Input
          id="login-otp"
          placeholder={t("code_placeholder")}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          disabled={isBusy}
          value={otp}
          onChange={(event) => {
            setOtp(event.target.value.replace(/\D/g, "").slice(0, 6));
            setError("");
          }}
          className={cn(
            "text-center text-lg tracking-[0.4em]",
            error ? "border-red-500" : undefined,
          )}
          autoFocus
        />
        {error ? <p className="px-1 text-xs text-red-600">{error}</p> : null}
      </div>
      <Button type="submit" variant={buttonVariant} disabled={isBusy}>
        {isVerifying ? (
          <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />
        ) : null}
        {isVerifying ? t("verifying") : t("verify")}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={isBusy || resendIn > 0}
        onClick={() => void sendCode()}
      >
        {resendIn > 0
          ? t("resend_in", { seconds: resendIn })
          : t("resend")}
      </Button>
    </form>
  );
}
