"use client";

import { APP_VERSION } from "@/lib/version";

import {
  LayoutDashboard,
  PieChart,
  Wallet,
  TrendingUp,
  Building2,
  Settings,
  Bot,
  Calculator,
  ChevronRight,
  ArrowRightLeft,
  FolderOpen,
  FileText,
  FileUp,
  ScanLine,
  LogOut,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { logoutAction } from "@/actions/auth-actions";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  titleKey: string;
  url: string;
  icon: LucideIcon;
}

const baseMainNavItems: NavItem[] = [
  { titleKey: "dashboard", url: "/dashboard", icon: LayoutDashboard },
  { titleKey: "overview", url: "/overview", icon: PieChart },
  { titleKey: "expenses", url: "/expenses", icon: Wallet },
  { titleKey: "income", url: "/income", icon: TrendingUp },
  { titleKey: "transfers", url: "/transfers", icon: ArrowRightLeft },
  { titleKey: "categories", url: "/categories", icon: FolderOpen },
  { titleKey: "documents", url: "/documents", icon: FileText },
  { titleKey: "accounts", url: "/accounts", icon: Building2 },
  { titleKey: "analytics", url: "/analytics", icon: PieChart },
  { titleKey: "scan", url: "/scan", icon: ScanLine },
];

export function getMainNavItems(aiEnabled: boolean): NavItem[] {
  if (!aiEnabled) {
    return baseMainNavItems;
  }

  return [...baseMainNavItems, { titleKey: "import", url: "/import", icon: FileUp }];
}

const bottomNavItems: NavItem[] = [
  { titleKey: "tools", url: "/tools", icon: Calculator },
  { titleKey: "settings", url: "/settings", icon: Settings },
  { titleKey: "assistant", url: "/assistant", icon: Bot },
];

function NavItemButton({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const t = useTranslations("nav");
  const Icon = item.icon;

  return (
    <SidebarMenuButton
      asChild
      isActive={isActive}
      className={cn(
        "group relative h-10 rounded-xl text-sm font-medium transition-all duration-200",
        isActive
          ? "bg-gradient-to-r from-amber-400/[0.15] to-amber-400/[0.06] text-amber-600 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.22),0_0_16px_rgba(245,158,11,0.08)] dark:text-amber-400"
          : "text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
      )}
    >
      <Link href={item.url} className="flex items-center gap-3 px-3">
        <div
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-200",
            isActive
              ? "bg-gradient-to-br from-amber-400/[0.22] to-amber-500/[0.08]"
              : "bg-transparent group-hover:bg-white/[0.06]"
          )}
        >
          <Icon
            className={cn(
              "h-4 w-4 transition-all duration-200",
              isActive
                ? "text-amber-500 dark:text-amber-400"
                : "text-muted-foreground group-hover:text-foreground"
            )}
          />
        </div>
        <span className="font-medium tracking-tight" style={{ fontFamily: "var(--font-jakarta)" }}>
          {t(item.titleKey)}
        </span>
        {isActive && (
          <ChevronRight className="ml-auto h-3 w-3 text-amber-500/60 dark:text-amber-400/60" />
        )}
      </Link>
    </SidebarMenuButton>
  );
}

export function AppSidebar({ aiEnabled }: { aiEnabled: boolean }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const mainNavItems = getMainNavItems(aiEnabled);

  useEffect(() => {
    setOpenMobile(false);
  }, [pathname, setOpenMobile]);

  return (
    <Sidebar
      className={cn(
        "border-border/50 border-r dark:border-white/[0.06]",
        "backdrop-blur-2xl dark:bg-[rgba(12,11,14,0.97)]"
      )}
    >
      {/* Brand Header */}
      <SidebarHeader className="border-border/40 border-b px-5 py-5 dark:border-white/[0.05]">
        <Link href="/dashboard" className="group flex items-center gap-3">
          <Image
            src="/logo.svg"
            alt="Cashlytics"
            width={120}
            height={30}
            className="h-7 w-auto transition-opacity duration-200 group-hover:opacity-80"
            priority
          />
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        <SidebarGroup>
          {/* Section label */}
          <div className="separator-label mb-2 px-2 py-1 text-[10px] tracking-[0.15em]">
            Navigation
          </div>

          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.titleKey}>
                  <NavItemButton
                    item={item}
                    isActive={pathname === item.url || pathname.startsWith(item.url + "/")}
                  />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-border/40 border-t px-3 py-4 dark:border-white/[0.05]">
        <div className="separator-label mb-2 px-2 text-[10px] tracking-[0.15em]">Tools</div>
        <SidebarMenu className="space-y-0.5">
          {bottomNavItems.map((item) => (
            <SidebarMenuItem key={item.titleKey}>
              <NavItemButton
                item={item}
                isActive={pathname === item.url || pathname.startsWith(item.url + "/")}
              />
            </SidebarMenuItem>
          ))}
        </SidebarMenu>

        {/* Logout button */}
        <form action={logoutAction} className="mt-2">
          <button
            type="submit"
            className="group text-muted-foreground/70 hover:text-foreground flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all duration-200 hover:bg-white/[0.05]"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-transparent transition-all duration-200 group-hover:bg-white/[0.06]">
              <LogOut className="h-4 w-4" />
            </div>
            <span style={{ fontFamily: "var(--font-jakarta)" }}>Sign out</span>
          </button>
        </form>

        {/* Version badge */}
        <div className="mx-2 mt-4 rounded-xl border border-white/5 bg-white/3 px-3 py-2 dark:border-white/[0.05] dark:bg-white/[0.03]">
          <p
            className="text-muted-foreground/40 text-[10px] tracking-widest uppercase"
            style={{ fontFamily: "var(--font-jakarta)" }}
          >
            Version {APP_VERSION}
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
