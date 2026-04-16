import { Suspense } from "react";

import { getCurrentUser } from "@/lib/auth";

import { ModalProvider } from "@/components/modal-provider";
import { LandingFooter } from "@/components/landing/footer";
import { LandingHeader } from "@/components/landing/header";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col">
      <div className="fixed inset-0 -z-20 overflow-hidden bg-[#05060a]">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 8%, rgba(129, 92, 246, 0.28), transparent 28%), radial-gradient(circle at 16% 32%, rgba(56, 189, 248, 0.14), transparent 26%), radial-gradient(circle at 80% 36%, rgba(236, 72, 153, 0.16), transparent 24%), radial-gradient(circle at 50% 68%, rgba(99, 102, 241, 0.16), transparent 34%), linear-gradient(180deg, #06070b 0%, #090a11 42%, #07080d 100%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.16] mix-blend-soft-light"
          style={{
            backgroundImage: "url('/images/noise.webp')",
            backgroundSize: "180px 180px",
          }}
        />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-60" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/40 to-transparent" />
      </div>

      <Suspense fallback={<div className="h-16 border-b border-white/10" />}>
        <LandingHeader user={user ?? null} />
      </Suspense>

      <ModalProvider>
        <main className="relative z-10 flex-1">{children}</main>
      </ModalProvider>

      <LandingFooter />
    </div>
  );
}
