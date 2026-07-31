"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { authClient } from "@/lib/auth/client";
import { cn } from "@/components/ui";
import { buttonVariants } from "@/components/ui/button";
import { EmailOtpForm } from "@/components/email-otp-form";
import * as Icons from "@/components/ui/icons";

interface UserAuthFormProps extends React.HTMLAttributes<HTMLDivElement> {
  lang: string;
  disabled?: boolean;
}

export function UserAuthForm({
  className,
  lang,
  disabled,
  ...props
}: UserAuthFormProps) {
  const t = useTranslations("Login");
  const [isGoogleLoading, setIsGoogleLoading] = React.useState(false);
  const searchParams = useSearchParams();
  const callbackURL = searchParams?.get("from") ?? `/${lang}/my-creations`;

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      <EmailOtpForm
        callbackURL={callbackURL}
        disabled={isGoogleLoading || disabled}
      />
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            {t("signin_others")}
          </span>
        </div>
      </div>
      <button
        type="button"
        className={cn(buttonVariants({ variant: "outline" }))}
        onClick={() => {
          setIsGoogleLoading(true);
          authClient.signIn
            .social({
              provider: "google",
              callbackURL,
            })
            .catch((error) => {
              console.error("Google signIn error:", error);
              setIsGoogleLoading(false);
            });
        }}
        disabled={isGoogleLoading || disabled}
      >
        {isGoogleLoading ? (
          <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Icons.Google className="mr-2 h-4 w-4" />
        )}{" "}
        {t("continue_google")}
      </button>
    </div>
  );
}
