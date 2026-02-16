'use client';

import { useState, useEffect } from 'react';
import { Bell, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { ThemeToggle } from './theme-toggle';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { SearchDialog } from '@/components/molecules/search-dialog';
import { useTranslations } from 'next-intl';

interface HeaderProps {
  title?: string;
}

export function Header({ title }: HeaderProps) {
  const t = useTranslations('common');
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <header className="relative flex h-14 shrink-0 items-center gap-3 border-b border-border/40 dark:border-white/[0.05] bg-background/80 dark:bg-[rgba(8,8,10,0.85)] backdrop-blur-xl px-5">
        {/* Amber accent line at bottom in dark mode */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent dark:via-amber-500/30 pointer-events-none" />

        <SidebarTrigger className="-ml-1 rounded-lg h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all" />

        <Separator orientation="vertical" className="h-5 opacity-30" />

        {title && (
          <h1
            className="text-sm font-semibold text-foreground/80"
            style={{ fontFamily: 'var(--font-syne)' }}
          >
            {title}
          </h1>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Search */}
          <button
            onClick={() => setSearchOpen(true)}
            className="relative hidden md:flex items-center gap-2 h-8 w-56 px-3 text-sm rounded-xl bg-white/5 dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.07] text-muted-foreground/60 hover:bg-white/10 dark:hover:bg-white/[0.06] transition-all cursor-pointer"
          >
            <Search className="h-3.5 w-3.5 text-muted-foreground/50" />
            <span className="flex-1 text-left text-muted-foreground/50">{t('search')}</span>
            <kbd className="pointer-events-none inline-flex items-center rounded-md border border-border/40 dark:border-white/[0.07] bg-muted/40 dark:bg-white/[0.04] px-1.5 text-[10px] text-muted-foreground/40 font-medium leading-none">
              ⌘K
            </kbd>
          </button>

          {/* Mobile search button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-4 w-4" />
          </Button>

          {/* Notifications */}
          <Button
            variant="ghost"
            size="icon"
            className="relative h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5"
          >
            <Bell className="h-4 w-4" />
            {/* Notification dot */}
            <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-50" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
            <span className="sr-only">{t('notifications')}</span>
          </Button>

          <ThemeToggle />

          <Separator orientation="vertical" className="h-5 opacity-30" />

          {/* Avatar */}
          <Avatar className="h-7 w-7 ring-1 ring-amber-500/20 ring-offset-1 ring-offset-background transition-all hover:ring-amber-500/40">
            <AvatarFallback
              className="text-[11px] font-semibold bg-gradient-to-br from-amber-400/30 to-amber-600/10 text-amber-600 dark:text-amber-400 rounded-full"
              style={{ fontFamily: 'var(--font-syne)' }}
            >
              U
            </AvatarFallback>
          </Avatar>
        </div>
      </header>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
