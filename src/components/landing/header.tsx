"use client";

import Image from "next/image";
import { ChevronDown, Gem, Globe, ImagePlay, Menu, Type } from "lucide-react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useSigninModal } from "@/hooks/use-signin-modal";
import { LocaleLink } from "@/i18n/navigation";
import { authClient, type User } from "@/lib/auth/client";
import { useCredits } from "@/stores/credits-store";

export function LandingHeader({ user }: { user?: User | null }) {
  const locale = useLocale();
  const isZh = locale === "zh";
  const router = useRouter();
  const signInModal = useSigninModal();
  const { balance } = useCredits();
  const tools = [
    { label: isZh ? "文生视频" : "Text to Video", href: "/text-to-video", icon: Type },
    { label: isZh ? "图生视频" : "Image to Video", href: "/image-to-video", icon: ImagePlay },
  ];
  const switchLocale = (next: "en" | "zh") => {
    const current = window.location.pathname + window.location.search + window.location.hash;
    const stripped = current.replace(/^\/zh(?=\/|$)/, "") || "/";
    router.push(next === "zh" ? `/zh${stripped === "/" ? "" : stripped}` : stripped);
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#030712]/70 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6">
        <LocaleLink href="/" className="flex items-center gap-2.5 font-bold text-white"><Image src="/logo.svg" alt="VideoFly" width={30} height={30} className="rounded-lg" /><span className="text-lg">VideoFly</span></LocaleLink>
        <nav className="hidden items-center gap-7 lg:flex">
          <LocaleLink href="/" className="text-sm text-white/70 hover:text-white">{isZh ? "首页" : "Home"}</LocaleLink>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><button type="button" className="flex items-center gap-1 text-sm text-white/70 hover:text-white">{isZh ? "视频工具" : "Video tools"}<ChevronDown className="h-4 w-4" /></button></DropdownMenuTrigger>
            <DropdownMenuContent className="w-52 border-slate-700 bg-slate-950 text-white">
              {tools.map(({ label, href, icon: Icon }) => <DropdownMenuItem key={href} asChild className="focus:bg-slate-800 focus:text-white"><LocaleLink href={href} className="flex items-center gap-2.5"><Icon className="h-4 w-4 text-blue-400" />{label}</LocaleLink></DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
          <LocaleLink href="/pricing" className="text-sm text-white/70 hover:text-white">{isZh ? "定价" : "Pricing"}</LocaleLink>
          <LocaleLink href="/my-creations" className="text-sm text-white/70 hover:text-white">{isZh ? "我的创作" : "My creations"}</LocaleLink>
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="flex h-9 items-center gap-1.5 px-2 text-sm text-white/65 hover:text-white"><Globe className="h-4 w-4" />{locale.toUpperCase()}</button></DropdownMenuTrigger><DropdownMenuContent align="end" className="border-slate-700 bg-slate-950 text-white"><DropdownMenuItem onSelect={() => switchLocale("en")} className="focus:bg-slate-800 focus:text-white">English</DropdownMenuItem><DropdownMenuItem onSelect={() => switchLocale("zh")} className="focus:bg-slate-800 focus:text-white">中文</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
          {user && <LocaleLink href="/credits" className="flex h-9 items-center gap-1.5 rounded-md border border-white/10 px-2.5 text-sm text-white"><Gem className="h-4 w-4 text-amber-400" />{balance?.availableCredits ?? 0}</LocaleLink>}
          {user ? <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-sm font-semibold text-white">{(user.name?.[0] || user.email?.[0] || "U").toUpperCase()}</button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48 border-slate-700 bg-slate-950 text-white"><DropdownMenuItem asChild className="focus:bg-slate-800 focus:text-white"><LocaleLink href="/my-creations">{isZh ? "我的创作" : "My creations"}</LocaleLink></DropdownMenuItem><DropdownMenuItem asChild className="focus:bg-slate-800 focus:text-white"><LocaleLink href="/settings">{isZh ? "账户设置" : "Account"}</LocaleLink></DropdownMenuItem><DropdownMenuSeparator className="bg-slate-700" /><DropdownMenuItem onSelect={async () => { await authClient.signOut(); router.refresh(); }} className="text-red-400 focus:bg-red-500/10">{isZh ? "退出登录" : "Sign out"}</DropdownMenuItem></DropdownMenuContent></DropdownMenu> : <><button type="button" onClick={signInModal.onOpen} className="h-9 px-3 text-sm text-white/75 hover:text-white">{isZh ? "登录" : "Login"}</button><Button onClick={signInModal.onOpen} className="h-9 rounded-md bg-blue-600 px-4 text-white hover:bg-blue-500">{isZh ? "免费开始" : "Start for Free"}</Button></>}
        </div>

        <Sheet>
          <SheetTrigger asChild><button type="button" aria-label={isZh ? "打开菜单" : "Open menu"} className="flex h-10 w-10 items-center justify-center rounded-md text-white lg:hidden"><Menu className="h-5 w-5" /></button></SheetTrigger>
          <SheetContent className="w-72 border-slate-800 bg-[#070b15] text-white">
            <SheetHeader><SheetTitle className="text-left text-white">VideoFly</SheetTitle></SheetHeader>
            <div className="mt-7 space-y-2"><LocaleLink href="/" className="block rounded-lg px-3 py-2.5 hover:bg-slate-800">{isZh ? "首页" : "Home"}</LocaleLink>{tools.map(({ label, href, icon: Icon }) => <LocaleLink key={href} href={href} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 hover:bg-slate-800"><Icon className="h-4 w-4 text-blue-400" />{label}</LocaleLink>)}<LocaleLink href="/pricing" className="block rounded-lg px-3 py-2.5 hover:bg-slate-800">{isZh ? "定价" : "Pricing"}</LocaleLink><LocaleLink href="/my-creations" className="block rounded-lg px-3 py-2.5 hover:bg-slate-800">{isZh ? "我的创作" : "My creations"}</LocaleLink></div>
            <div className="mt-6 border-t border-slate-800 pt-6">{user ? <button type="button" onClick={async () => { await authClient.signOut(); router.refresh(); }} className="w-full rounded-lg px-3 py-2.5 text-left text-red-400 hover:bg-red-500/10">{isZh ? "退出登录" : "Sign out"}</button> : <Button onClick={signInModal.onOpen} className="w-full bg-blue-600 text-white hover:bg-blue-500">{isZh ? "免费开始" : "Start for Free"}</Button>}</div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
