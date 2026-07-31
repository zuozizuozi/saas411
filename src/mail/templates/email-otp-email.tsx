import type { BaseEmailProps } from "@/mail/types";
import EmailLayout from "@/mail/components/email-layout";
import { Text } from "@react-email/components";
import { createTranslator } from "use-intl/core";

interface EmailOtpEmailProps extends BaseEmailProps {
  name?: string;
  otp: string;
}

export default function EmailOtpEmail({
  name = "there",
  otp,
  locale,
  messages,
}: EmailOtpEmailProps) {
  const t = createTranslator({
    locale,
    messages,
    namespace: "Mail.emailOtp",
  });

  return (
    <EmailLayout locale={locale} messages={messages}>
      <Text className="text-base text-gray-900">
        {t("greeting", { name })}
      </Text>
      <Text className="mt-8 text-2xl font-bold text-gray-900">
        {t("title")}
      </Text>
      <Text className="text-base text-gray-900">{t("body")}</Text>
      <Text className="text-base text-gray-900">{t("instruction")}</Text>
      <Text className="my-8 rounded-lg bg-gray-100 px-6 py-4 text-center text-4xl font-bold tracking-[0.3em] text-gray-900">
        {otp}
      </Text>
      <Text className="mt-8 text-sm text-gray-500">{t("validity")}</Text>
      <Text className="mt-4 text-sm text-gray-500">{t("security")}</Text>
      <Text className="mt-4 text-sm text-gray-500">{t("footer")}</Text>
    </EmailLayout>
  );
}

EmailOtpEmail.PreviewProps = {
  locale: "en",
  messages: {
    Mail: {
      common: {
        team: "{name} Team",
        copyright: "© {year} All Rights Reserved.",
      },
      emailOtp: {
        greeting: "Hi {name},",
        title: "Your seedance.co verification code",
        body: "We received a request to sign in to your seedance.co account.",
        instruction: "Enter this verification code to continue:",
        validity: "This code expires in 5 minutes.",
        security: "For your security, the code can only be used once.",
        footer: "If you didn't request this, please ignore this email.",
      },
    },
  },
  name: "John Doe",
  otp: "123456",
};
