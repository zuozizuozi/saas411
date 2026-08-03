import { permanentRedirect } from "next/navigation";
import type { Locale } from "@/config/i18n-config";

export default async function PrivacyPage({
    params,
}: {
    params: Promise<{ locale: Locale }>;
}) {
    const { locale } = await params;
    permanentRedirect(`/${locale}/privacy-policy`);
}
