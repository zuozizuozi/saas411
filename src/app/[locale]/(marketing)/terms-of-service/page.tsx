import { getTranslations } from "next-intl/server";
import type { Locale } from "@/config/i18n-config";
import { siteConfig } from "@/config/site";
import { buildAlternates } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const alternates = buildAlternates("/terms-of-service", locale);
  const t = await getTranslations({ locale, namespace: "Legal.Terms" });

  return {
    title: t("title"),
    alternates: {
      canonical: alternates.canonical,
      languages: alternates.languages,
    },
  };
}

export default async function TermsOfServicePage() {
    const t = await getTranslations("Legal.Terms");
    const supportEmail = siteConfig.supportEmail ?? "support@seedance.co";

    return (
        <div className="container mx-auto px-4 py-12 max-w-4xl">
            <h1 className="text-3xl font-bold mb-8">{t("title")}</h1>
            <div className="prose dark:prose-invert">
                <p>{t("lastUpdated", { year: new Date().getFullYear() })}</p>

                <h2>{t("acceptanceTitle")}</h2>
                <p>{t("acceptanceBody")}</p>

                <h2>{t("licenseTitle")}</h2>
                <p>{t("licenseBody")}</p>

                <h2>{t("disclaimerTitle")}</h2>
                <p>{t("disclaimerBody")}</p>

                <h2>{t("limitationsTitle")}</h2>
                <p>{t("limitationsBody")}</p>

                <h2>{t("contactTitle")}</h2>
                <p>
                  {t.rich("contactBody", {
                    email: (chunks) => <a href={`mailto:${supportEmail}`}>{chunks}</a>,
                    address: supportEmail,
                  })}
                </p>
            </div>
        </div>
    );
}
