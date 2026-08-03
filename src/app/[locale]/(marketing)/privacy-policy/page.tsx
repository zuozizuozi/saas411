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
  const alternates = buildAlternates("/privacy-policy", locale);
  const t = await getTranslations({ locale, namespace: "Legal.Privacy" });

  return {
    title: t("title"),
    alternates: {
      canonical: alternates.canonical,
      languages: alternates.languages,
    },
  };
}

export default async function PrivacyPolicyPage() {
    const t = await getTranslations("Legal.Privacy");
    const supportEmail = siteConfig.supportEmail ?? "support@seedance.co";

    return (
        <div className="container mx-auto px-4 py-12 max-w-4xl">
            <h1 className="text-3xl font-bold mb-8">{t("title")}</h1>
            <div className="prose dark:prose-invert">
                <p>{t("lastUpdated", { year: new Date().getFullYear() })}</p>

                <h2>{t("introductionTitle")}</h2>
                <p>{t("introductionBody")}</p>

                <h2>{t("collectionTitle")}</h2>
                <p>{t("collectionBody")}</p>

                <h2>{t("usageTitle")}</h2>
                <p>{t("usageBody")}</p>

                <h2>{t("securityTitle")}</h2>
                <p>{t("securityBody")}</p>

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
