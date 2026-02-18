'use client';

import { APP_VERSION } from '@/lib/version';

import {
  LayoutDashboard,
  PieChart,
  Wallet,
  TrendingUp,
  Building2,
  Settings,
  Bot,
  ChevronRight,
  ArrowRightLeft,
  FolderOpen,
} from 'lucide-react';

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
} from '@/components/ui/sidebar';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  titleKey: string;
  url: string;
  icon: LucideIcon;
}

const mainNavItems: NavItem[] = [
  { titleKey: 'dashboard', url: '/dashboard', icon: LayoutDashboard },
  { titleKey: 'overview', url: '/overview', icon: PieChart },
  { titleKey: 'expenses', url: '/expenses', icon: Wallet },
  { titleKey: 'income', url: '/income', icon: TrendingUp },
  { titleKey: 'transfers', url: '/transfers', icon: ArrowRightLeft },
  { titleKey: 'categories', url: '/categories', icon: FolderOpen },
  { titleKey: 'accounts', url: '/accounts', icon: Building2 },
  { titleKey: 'analytics', url: '/analytics', icon: PieChart },
];

const bottomNavItems: NavItem[] = [
  { titleKey: 'settings', url: '/settings', icon: Settings },
  { titleKey: 'assistant', url: '/assistant', icon: Bot },
];

function NavItemButton({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const t = useTranslations('nav');
  const Icon = item.icon;

  return (
    <SidebarMenuButton
      asChild
      isActive={isActive}
      className={cn(
        'group relative rounded-xl h-10 transition-all duration-200 font-medium text-sm',
        isActive
          ? 'bg-gradient-to-r from-amber-400/[0.15] to-amber-400/[0.06] text-amber-600 dark:text-amber-400 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.22),0_0_16px_rgba(245,158,11,0.08)]'
          : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.05]'
      )}
    >
      <Link href={item.url} className="flex items-center gap-3 px-3">
        <div
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-lg shrink-0 transition-all duration-200',
            isActive
              ? 'bg-gradient-to-br from-amber-400/[0.22] to-amber-500/[0.08]'
              : 'bg-transparent group-hover:bg-white/[0.06]'
          )}
        >
          <Icon
            className={cn(
              'h-4 w-4 transition-all duration-200',
              isActive ? 'text-amber-500 dark:text-amber-400' : 'text-muted-foreground group-hover:text-foreground'
            )}
          />
        </div>
        <span
          className="font-medium tracking-tight"
          style={{ fontFamily: 'var(--font-jakarta)' }}
        >
          {t(item.titleKey)}
        </span>
        {isActive && (
          <ChevronRight className="ml-auto h-3 w-3 text-amber-500/60 dark:text-amber-400/60" />
        )}
      </Link>
    </SidebarMenuButton>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const tCommon = useTranslations('common');
  const { setOpenMobile } = useSidebar();

  useEffect(() => {
    setOpenMobile(false);
  }, [pathname, setOpenMobile]);

  return (
    <Sidebar
      className={cn(
        'border-r border-border/50 dark:border-white/[0.06]',
        'dark:bg-[rgba(12,11,14,0.97)] backdrop-blur-2xl'
      )}
    >
      {/* Brand Header */}
      <SidebarHeader className="border-b border-border/40 dark:border-white/[0.05] px-5 py-5">
        <Link href="/dashboard" className="flex items-center gap-3 group">
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
          <div className="separator-label text-[10px] tracking-[0.15em] mb-2 px-2 py-1">
            Navigation
          </div>

          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.titleKey}>
                  <NavItemButton
                    item={item}
                    isActive={pathname === item.url || pathname.startsWith(item.url + '/')}
                  />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-border/40 dark:border-white/[0.05] px-3 py-4">
        <div className="separator-label text-[10px] tracking-[0.15em] mb-2 px-2">
          Tools
        </div>
        <SidebarMenu className="space-y-0.5">
          {bottomNavItems.map((item) => (
            <SidebarMenuItem key={item.titleKey}>
              <NavItemButton
                item={item}
                isActive={pathname === item.url || pathname.startsWith(item.url + '/')}
              />
            </SidebarMenuItem>
          ))}
        </SidebarMenu>

        {/* Version badge */}
        <div className="mt-4 mx-2 px-3 py-2 rounded-xl bg-white/3 dark:bg-white/[0.03] border border-white/5 dark:border-white/[0.05]">
          <p
            className="text-[10px] text-muted-foreground/40 tracking-widest uppercase"
            style={{ fontFamily: 'var(--font-jakarta)' }}
          >
            Version {APP_VERSION}
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
