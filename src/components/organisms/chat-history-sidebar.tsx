"use client";

import { Plus, Trash2, MessageSquare, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Conversation } from "@/types/database";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

interface ChatHistorySidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  isLoading?: boolean;
}

function formatDate(
  date: Date | string,
  t: ReturnType<typeof useTranslations<"chat">>,
  locale: string
): string {
  const d = new Date(date);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return t("today");
  if (diffDays === 1) return t("yesterday");
  if (diffDays < 7) return t("daysAgo", { count: diffDays });
  return d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit" });
}

function ConversationList({
  conversations,
  activeConversationId,
  onSelectConversation,
  onDeleteConversation,
}: Omit<ChatHistorySidebarProps, "onNewChat" | "isLoading">) {
  const t = useTranslations("chat");
  const locale = useLocale();
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="space-y-1 p-2">
        {conversations.map((conversation) => (
          <div
            key={conversation.id}
            className={cn(
              "group flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 transition-all duration-200",
              activeConversationId === conversation.id
                ? "text-primary bg-gradient-to-r from-amber-400/15 to-amber-500/10 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.2)]"
                : "hover:bg-muted dark:hover:bg-white/5"
            )}
            onClick={() => onSelectConversation(conversation.id)}
          >
            <MessageSquare className="h-4 w-4 flex-shrink-0" />
            <div className="flex-1 truncate">
              <p className="truncate text-sm font-medium">{conversation.title}</p>
              <p className="text-muted-foreground text-xs">
                {formatDate(conversation.updatedAt, t, locale)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteConversation(conversation.id);
              }}
              aria-label={t("deleteChat")}
            >
              <Trash2 className="text-destructive h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChatHistorySidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  isLoading,
}: ChatHistorySidebarProps) {
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const t = useTranslations("chat");

  const handleSelect = (id: string) => {
    onSelectConversation(id);
    setSheetOpen(false);
  };

  const handleNewChat = () => {
    onNewChat();
    setSheetOpen(false);
  };

  if (isMobile) {
    return (
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="flex-shrink-0"
            aria-label={t("openHistory")}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="border-b px-4 py-3">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg">{t("chats")}</SheetTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNewChat}
                disabled={isLoading}
                aria-label={t("newChat")}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>
          <ConversationList
            conversations={conversations}
            activeConversationId={activeConversationId}
            onSelectConversation={handleSelect}
            onDeleteConversation={onDeleteConversation}
          />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside className="border-border/50 bg-card/80 dark:bg-card/50 flex h-full w-64 flex-col border-r backdrop-blur-xl dark:border-white/[0.08]">
      <div className="border-border/50 flex items-center justify-between border-b px-4 py-3 dark:border-white/[0.08]">
        <h2 className="font-semibold">{t("chats")}</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onNewChat}
          disabled={isLoading}
          aria-label={t("newChat")}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <ConversationList
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={onSelectConversation}
        onDeleteConversation={onDeleteConversation}
      />
    </aside>
  );
}
