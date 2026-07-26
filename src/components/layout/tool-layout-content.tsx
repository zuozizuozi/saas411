"use client";

import { HeaderSimple } from "@/components/layout/header-simple";
import { useMobileMenu } from "@/components/layout/mobile-menu-context";
import { Sidebar } from "@/components/layout/sidebar";

interface ToolLayoutContentProps { children: React.ReactNode; lang: string; user: any }

export function ToolLayoutContent({ children, lang, user }: ToolLayoutContentProps) {
  const { mobileMenuOpen, setMobileMenuOpen } = useMobileMenu();
  return (
    <div className="flex min-h-screen bg-[#030712] text-slate-100">
      <Sidebar lang={lang} mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <HeaderSimple user={user} lang={lang} mobileMenuOpen={mobileMenuOpen} onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />
        <main className="flex min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
