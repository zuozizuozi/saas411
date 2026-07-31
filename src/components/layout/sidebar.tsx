"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock3, FolderOpen, Gem, ImagePlay, Sparkles, Type, User } from "lucide-react";

import { cn } from "@/components/ui";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { sidebarNavigation } from "@/config/navigation";
import { useUpgradeModal } from "@/hooks/use-upgrade-modal";

const iconMap = { ImagePlay, Type, FolderOpen, Gem, User };

interface SidebarProps {
  lang?: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ lang = "en", mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const pathWithoutLang = pathname.replace(new RegExp(`^/${lang}`), "");
  const { openModal } = useUpgradeModal();
  const isZh = lang === "zh";

  const navigation = (
    <div className="flex h-full flex-col bg-[#070b15]">
      <Link href={`/${lang}`} className="flex h-[60px] shrink-0 items-center gap-2.5 border-b border-slate-800 px-4 text-white">
        <Image src="/logo.svg" alt="seedance.co" width={28} height={28} className="rounded-lg" />
        <span className="text-lg font-bold tracking-tight">seedance.co</span>
      </Link>

      <nav className="custom-scrollbar flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-5 flex items-center gap-2 px-2 text-sm font-semibold text-slate-200">
          <Sparkles className="h-4 w-4 text-blue-400" />
          {isZh ? "创作工作室" : "AI Studio"}
        </div>
        {sidebarNavigation.map((group) => (
          <div key={group.id} className="mb-5">
            {group.title && <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{group.id === "video" ? (isZh ? "视频" : "Video") : group.title}</div>}
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = iconMap[item.icon as keyof typeof iconMap];
                const active = pathWithoutLang === item.href;
                const titleMap: Record<string, string> = { txt2vid: "文生视频", img2vid: "图生视频", creations: "我的创作", credits: "积分", settings: "账户" };
                return (
                  <Link key={item.id} href={`/${lang}${item.href}`} onClick={onMobileClose} className={cn("flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors", active ? "bg-blue-600/15 text-blue-300" : "text-slate-400 hover:bg-slate-800/70 hover:text-white")}>
                    {Icon && <Icon className="h-4 w-4 shrink-0" />}
                    <span>{isZh ? titleMap[item.id] : item.title}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        <Link href={`/${lang}/my-creations`} className="mt-1 flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm text-slate-400 transition-colors hover:bg-slate-800/70 hover:text-white">
          <Clock3 className="h-4 w-4" />{isZh ? "生成历史" : "Generation history"}
        </Link>
      </nav>

      <div className="shrink-0 p-3">
        <button type="button" onClick={() => openModal({ reason: "upgrade" })} className="w-full rounded-xl border border-blue-500/25 bg-gradient-to-br from-blue-600/15 to-violet-600/10 p-3 text-left transition-colors hover:border-blue-400/50">
          <span className="mb-1 flex items-center gap-2 text-sm font-semibold text-white"><Gem className="h-4 w-4 text-amber-400" />{isZh ? "升级套餐" : "Upgrade plan"}</span>
          <span className="text-xs leading-5 text-slate-400">{isZh ? "解锁更多积分、高清输出与快速队列" : "More credits, HD output and faster queues"}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden h-screen w-56 shrink-0 border-r border-slate-800 lg:block">{navigation}</aside>
      <Sheet open={Boolean(mobileOpen)} onOpenChange={(open) => { if (!open) onMobileClose?.(); }}>
        <SheetContent position="left" className="w-64 border-slate-800 bg-[#070b15] p-0 text-white">
          <SheetHeader className="sr-only"><SheetTitle>seedance.co</SheetTitle></SheetHeader>
          {navigation}
        </SheetContent>
      </Sheet>
    </>
  );
}
