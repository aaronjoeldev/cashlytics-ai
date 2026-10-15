"use client";

import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "./theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { SearchDialog } from "@/components/molecules/search-dialog";
import { NotificationsMenu } from "@/components/molecules/notifications-menu";
import { useTranslations } from "next-intl";

interface HeaderProps {
  title?: string;
}

export function Header({ title }: HeaderProps) {
  const t = useTranslations("common");
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <header className="border-border/40 bg-background/80 relative flex h-14 shrink-0 items-center gap-3 border-b px-5 backdrop-blur-xl dark:border-white/[0.05] dark:bg-[rgba(8,8,10,0.85)]">
        {/* Amber accent line at bottom in dark mode */}
        <div className="pointer-events-none absolute right-0 bottom-0 left-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent dark:via-amber-500/30" />

        <SidebarTrigger className="text-muted-foreground hover:text-foreground -ml-1 h-8 w-8 rounded-lg transition-all hover:bg-white/5" />

        <Separator orientation="vertical" className="h-5 opacity-30" />

        {title && (
          <h1
            className="text-foreground/80 text-sm font-semibold"
            style={{ fontFamily: "var(--font-syne)" }}
          >
            {title}
          </h1>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Search */}
          <button
            onClick={() => setSearchOpen(true)}
            className="border-border/50 text-muted-foreground/60 relative hidden h-8 w-56 cursor-pointer items-center gap-2 rounded-xl border bg-white/5 px-3 text-sm transition-all hover:bg-white/10 md:flex dark:border-white/[0.07] dark:bg-white/[0.04] dark:hover:bg-white/[0.06]"
          >
            <Search className="text-muted-foreground/50 h-3.5 w-3.5" />
            <span className="text-muted-foreground/50 flex-1 text-left">{t("search")}</span>
            <kbd className="border-border/40 bg-muted/40 text-muted-foreground/40 pointer-events-none inline-flex items-center rounded-md border px-1.5 text-[10px] leading-none font-medium dark:border-white/[0.07] dark:bg-white/[0.04]">
              ⌘K
            </kbd>
          </button>

          {/* Mobile search button */}
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground h-8 w-8 rounded-xl hover:bg-white/5 md:hidden"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-4 w-4" />
          </Button>

          <NotificationsMenu />

          <ThemeToggle />

          <Separator orientation="vertical" className="h-5 opacity-30" />

          {/* Avatar */}
          <Avatar className="ring-offset-background h-7 w-7 ring-1 ring-amber-500/20 ring-offset-1 transition-all hover:ring-amber-500/40">
            <AvatarFallback
              className="rounded-full bg-gradient-to-br from-amber-400/30 to-amber-600/10 text-[11px] font-semibold text-amber-600 dark:text-amber-400"
              style={{ fontFamily: "var(--font-syne)" }}
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
