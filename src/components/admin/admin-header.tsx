"use client";

import { HeaderSimple } from "@/components/layout/header-simple";
import { useSession } from "@/lib/auth/client";

export function AdminHeader({ locale }: { locale: string }) {
  const { data } = useSession();

  return <HeaderSimple user={data?.user ?? null} lang={locale} />;
}
