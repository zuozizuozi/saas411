"use client";

import Image from "next/image";
import Link from "next/link";
import { Gem, Menu } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { userMenuItems } from "@/config/navigation";
import { useSigninModal } from "@/hooks/use-signin-modal";
import { useLocaleRouter } from "@/i18n/navigation";
import { authClient, type User } from "@/lib/auth/client";
import { useCredits } from "@/stores/credits-store";
import { LOW_CREDIT_FIXED_THRESHOLD } from "@/config/low-credit";

interface HeaderSimpleProps {
  user?: Pick<User, "name" | "image" | "email"> | null;
  lang?: string;
  mobileMenuOpen?: boolean;
  onMobileMenuToggle?: () => void;
}

export function HeaderSimple({ user, lang = "en", onMobileMenuToggle }: HeaderSimpleProps) {
  const { balance } = useCredits();
  const signInModal = useSigninModal();
  const router = useLocaleRouter();
  const navigation = useTranslations("Navigation");
  const common = useTranslations("Common");
  const account = useTranslations("UserAccountNav");
  const credits = useTranslations("Credits");
  const isLowCredit =
    Boolean(balance) &&
    (balance?.availableCredits ?? 0) < LOW_CREDIT_FIXED_THRESHOLD;

  return (
    <header className="sticky top-0 z-40 flex h-[60px] shrink-0 items-center justify-between border-b border-slate-800 bg-[#070b15]/95 px-3 backdrop-blur-xl sm:px-4">
      <div className="flex items-center gap-2 lg:hidden">
        <button type="button" onClick={onMobileMenuToggle} aria-label={navigation("openMenu")} className="flex h-9 w-9 items-center justify-center rounded-md text-slate-300 hover:bg-slate-800"><Menu className="h-5 w-5" /></button>
        <Link href={`/${lang}`} className="flex items-center gap-2 font-semibold text-white"><Image src="/logo.svg" alt="seedance.co" width={24} height={24} className="rounded-md" /><span className="hidden min-[360px]:inline">seedance.co</span></Link>
      </div>
      <div className="hidden text-sm text-slate-400 lg:block">{navigation("studio")}</div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <LanguageSwitcher />

        {user && balance && <Link href={`/${lang}/credits`} title={isLowCredit ? credits("lowBalance") : credits("balance")} className={`hidden h-9 items-center gap-1.5 rounded-md border px-2.5 text-sm sm:flex ${isLowCredit ? "border-amber-500/60 bg-amber-500/10 text-amber-200" : "border-slate-700 text-slate-200"}`}><Gem className="h-4 w-4 text-amber-400" />{balance.availableCredits}</Link>}

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><button type="button" className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-800 text-sm font-semibold text-white">{user.image ? <img src={user.image} alt="" className="h-full w-full object-cover" /> : (user.name?.[0] || user.email?.[0] || "U").toUpperCase()}</button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 border-slate-700 bg-slate-900 text-white">
              {user.email && <div className="truncate px-2 py-1.5 text-xs text-slate-400">{user.email}</div>}
              <DropdownMenuSeparator className="bg-slate-700" />
              {userMenuItems.map((item) => <DropdownMenuItem key={item.id} asChild className="focus:bg-slate-800 focus:text-white"><Link href={`/${lang}${item.href}`}>{item.title}</Link></DropdownMenuItem>)}
              <DropdownMenuSeparator className="bg-slate-700" />
              <DropdownMenuItem onSelect={async () => { await authClient.signOut(); router.push(`/${lang}`); router.refresh(); }} className="text-red-400 focus:bg-red-500/10 focus:text-red-300">{account("sign_out")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <>
            <button type="button" onClick={signInModal.onOpen} className="hidden h-9 px-2 text-sm font-medium text-slate-200 hover:text-white sm:block">{common("login")}</button>
            <Button size="sm" onClick={signInModal.onOpen} className="h-9 rounded-md bg-blue-600 px-3 text-white hover:bg-blue-500">{navigation("createAccount")}</Button>
          </>
        )}
      </div>
    </header>
  );
}
