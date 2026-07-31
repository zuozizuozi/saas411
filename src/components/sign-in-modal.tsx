"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { EmailOtpForm } from "@/components/email-otp-form";
import * as Icons from "@/components/ui/icons";
import { siteConfig } from "@/config/site";
import { useSigninModal } from "@/hooks/use-signin-modal";

interface SignInModalContentProps {
  lang: string;
}

export const SignInModalContent = ({ lang }: SignInModalContentProps) => {
  const t = useTranslations("SignInModal");
  const signInModal = useSigninModal();
  const searchParams = useSearchParams();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const callbackURL =
    searchParams?.get("from") ??
    `/${lang}${siteConfig.routes.defaultLoginRedirect}`;

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      const { error } = await authClient.signIn.social({
        provider: "google",
        callbackURL,
      });
      if (error) throw new Error(error.message);
    } catch (error) {
      console.error("Google signIn error:", error);
      setIsGoogleLoading(false);
      toast.error(t("login_failed"), {
        description: t("google_error"),
      });
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-col items-center justify-center space-y-3 border-b bg-background px-4 py-6 pt-8 text-center">
        <h3 className="font-urban text-2xl font-bold">
          {t("signin_title")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("signin_subtitle")}
        </p>
      </div>

      <div className="flex flex-col space-y-4 bg-secondary/50 px-4 py-8">
        {siteConfig.auth.enableGoogleLogin ? (
          <Button
            variant="default"
            className="w-full"
            disabled={isGoogleLoading}
            onClick={() => void handleGoogleLogin()}
          >
            {isGoogleLoading ? (
              <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Icons.Google className="mr-2 h-4 w-4" />
            )}
            {t("continue_google")}
          </Button>
        ) : null}

        {siteConfig.auth.enableEmailOtpLogin ? (
          <>
            {siteConfig.auth.enableGoogleLogin ? (
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-secondary/50 px-2 text-muted-foreground">
                    {t("or_continue_with")}
                  </span>
                </div>
              </div>
            ) : null}

            <EmailOtpForm
              callbackURL={callbackURL}
              buttonVariant={
                siteConfig.auth.enableGoogleLogin ? "outline" : "default"
              }
              disabled={isGoogleLoading}
              onSuccess={signInModal.onClose}
            />
          </>
        ) : null}

        <p className="text-center text-xs text-muted-foreground">
          {t("terms_notice")}
        </p>
      </div>
    </div>
  );
};
