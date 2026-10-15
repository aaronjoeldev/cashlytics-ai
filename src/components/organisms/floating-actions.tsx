"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { chatTransport } from "@/lib/ai/chat-transport";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import {
  Plus,
  X,
  MessageSquare,
  CreditCard,
  ArrowRightLeft,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Send,
  Loader2,
  Bot,
  FileUp,
  ScanLine,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getAccounts } from "@/actions/account-actions";
import { getCategories } from "@/actions/category-actions";
import { ChatMessage, ChatMessageLoading } from "@/components/molecules/chat-message";
import { ExpenseForm } from "@/components/organisms/expense-form";
import { IncomeForm } from "@/components/organisms/income-form";
import { AccountForm } from "@/components/organisms/account-form";
import { TransferForm } from "@/components/organisms/transfer-form";
import type { Account, Category } from "@/types/database";

type FormType = "expense" | "income" | "transfer" | "account" | null;
type ActionKey = "expense" | "income" | "transfer" | "account" | "import" | "scan";

type FloatingActionItem = {
  key: ActionKey;
  icon: typeof TrendingDown;
  label: string;
  className: string;
  href?: string;
};

type FloatingActionLabels = Record<ActionKey, string>;
const MINI_CHAT_PROMPTS = ["45€ Tanken", "Budget diesen Monat?", "Einnahmen zeigen"];
const MINI_CHAT_TITLE = "Cashlytics Assistent";
const MINI_CHAT_EMPTY_STATE = "Frag mich nach deinen Finanzen oder buche schnell eine Ausgabe.";
const MINI_CHAT_PLACEHOLDER = "z.B. '45€ REWE'";
const MINI_CHAT_OPEN_FULL_VIEW = "Vollansicht öffnen";
const MINI_CHAT_CLOSE = "Chat schließen";
const MINI_CHAT_SEND = "Senden";

export function getFloatingActions(
  aiEnabled: boolean,
  labels: FloatingActionLabels
): FloatingActionItem[] {
  const baseActions: FloatingActionItem[] = [
    {
      key: "expense",
      icon: TrendingDown,
      label: labels.expense,
      className: "bg-amber-500 hover:bg-amber-600 text-white",
    },
    {
      key: "income",
      icon: TrendingUp,
      label: labels.income,
      className: "bg-emerald-500 hover:bg-emerald-600 text-white",
    },
    {
      key: "transfer",
      icon: ArrowRightLeft,
      label: labels.transfer,
      className: "bg-violet-500 hover:bg-violet-600 text-white",
    },
    {
      key: "account",
      icon: CreditCard,
      label: labels.account,
      className: "bg-blue-500 hover:bg-blue-600 text-white",
    },
    {
      key: "scan",
      icon: ScanLine,
      label: labels.scan,
      className: "bg-orange-500 hover:bg-orange-600 text-white",
      href: "/scan",
    },
  ];

  if (!aiEnabled) {
    return baseActions;
  }

  return [
    ...baseActions,
    {
      key: "import",
      icon: FileUp,
      label: labels.import,
      className: "bg-slate-700 hover:bg-slate-800 text-white",
      href: "/import",
    },
  ];
}

export function FloatingActions({ aiEnabled }: { aiEnabled: boolean }) {
  const t = useTranslations("floatingActions");
  const tCsvImport = useTranslations("csvImport");
  const pathname = usePathname();
  const isAssistantPage = pathname === "/assistant";

  // Menu state
  const [menuOpen, setMenuOpen] = useState(false);

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { messages, sendMessage, status } = useChat({ transport: chatTransport });
  const chatLoading = status === "streaming" || status === "submitted";

  // Form state
  const [activeForm, setActiveForm] = useState<FormType>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  const actionLabels: FloatingActionLabels = {
    expense: t("actions.expense"),
    income: t("actions.income"),
    transfer: t("actions.transfer"),
    account: t("actions.account"),
    scan: t("actions.scan"),
    import: tCsvImport("title"),
  };

  useEffect(() => {
    if (menuOpen && !dataLoaded) {
      Promise.all([getAccounts(), getCategories()]).then(([accsResult, catsResult]) => {
        if (accsResult.success) setAccounts(accsResult.data);
        if (catsResult.success) setCategories(catsResult.data);
        setDataLoaded(true);
      });
    }
  }, [menuOpen, dataLoaded]);

  useEffect(() => {
    if (chatOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, chatOpen]);

  const handleMenuAction = (type: FormType | "chat") => {
    setMenuOpen(false);
    if (type === "chat") {
      setChatOpen(true);
    } else {
      setActiveForm(type);
    }
  };

  const handleChatSend = () => {
    if (!chatInput.trim() || chatLoading) return;
    sendMessage({ text: chatInput.trim() });
    setChatInput("");
  };

  const handleFormClose = (open: boolean) => {
    if (!open) setActiveForm(null);
  };

  const handleFormSuccess = () => {
    setDataLoaded(false);
  };

  const actions = getFloatingActions(aiEnabled, actionLabels);

  return (
    <>
      {/* ── Chat Panel ── */}
      <div
        className={cn(
          "border-border/50 bg-background fixed right-[5.5rem] bottom-24 z-50 flex w-[360px] flex-col overflow-hidden rounded-2xl border shadow-2xl shadow-black/20 transition-all duration-300 ease-out dark:border-white/[0.08]",
          chatOpen
            ? "pointer-events-auto h-[520px] translate-y-0 opacity-100"
            : "pointer-events-none h-0 translate-y-4 opacity-0"
        )}
      >
        <div className="border-border/50 bg-card/50 flex shrink-0 items-center justify-between border-b px-4 py-3 backdrop-blur-sm dark:border-white/[0.08]">
          <div className="flex items-center gap-2">
            <div className="from-primary/20 to-primary/5 flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br">
              <Bot className="text-primary h-4 w-4" />
            </div>
            <p className="text-sm font-semibold">{MINI_CHAT_TITLE}</p>
          </div>
          <div className="flex items-center gap-1">
            <Link href="/assistant" onClick={() => setChatOpen(false)}>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title={MINI_CHAT_OPEN_FULL_VIEW}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setChatOpen(false)}
              aria-label={MINI_CHAT_CLOSE}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 && !chatLoading && (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
              <div className="from-primary/20 to-primary/5 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br">
                <MessageSquare className="text-primary h-6 w-6" />
              </div>
              <p className="text-muted-foreground text-sm">{MINI_CHAT_EMPTY_STATE}</p>
              <div className="flex w-full flex-col gap-2">
                {MINI_CHAT_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    className="bg-muted/50 hover:bg-muted cursor-pointer rounded-lg px-3 py-2 text-left text-xs transition-colors"
                    onClick={() => sendMessage({ text: prompt })}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="py-2">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {chatLoading && <ChatMessageLoading />}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="border-border/50 shrink-0 border-t p-3 dark:border-white/[0.08]">
          <div className="border-border/50 flex gap-2 rounded-xl border bg-white/5 p-1.5 dark:border-white/[0.08] dark:bg-white/[0.03]">
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleChatSend();
                }
              }}
              placeholder={MINI_CHAT_PLACEHOLDER}
              disabled={chatLoading}
              className="h-8 border-0 bg-transparent px-2 text-sm shadow-none focus-visible:ring-0"
            />
            <Button
              size="sm"
              className="h-8 shrink-0 px-3"
              disabled={!chatInput.trim() || chatLoading}
              onClick={handleChatSend}
              aria-label={MINI_CHAT_SEND}
            >
              {chatLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Speed Dial Menu ── */}
      <div
        className={cn(
          "fixed right-6 bottom-24 z-40 flex flex-col items-end gap-2.5 transition-all duration-200 ease-out",
          menuOpen
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-4 opacity-0"
        )}
      >
        {actions.map((action, index) => (
          <div
            key={action.key}
            className={cn(
              "flex items-center gap-3 transition-all duration-200",
              menuOpen ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
            )}
            style={{ transitionDelay: menuOpen ? `${index * 40}ms` : "0ms" }}
          >
            <span className="bg-background/95 border-border/50 rounded-lg border px-2.5 py-1 text-xs font-medium whitespace-nowrap shadow-sm backdrop-blur-sm">
              {action.label}
            </span>
            {action.href ? (
              <Link href={action.href} onClick={() => setMenuOpen(false)}>
                <Button
                  size="icon"
                  className={cn("h-10 w-10 rounded-full shadow-md", action.className)}
                  aria-label={action.label}
                >
                  <action.icon className="h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <Button
                size="icon"
                className={cn("h-10 w-10 rounded-full shadow-md", action.className)}
                onClick={() => handleMenuAction(action.key as FormType)}
                aria-label={action.label}
              >
                <action.icon className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* ── FAB Container ── */}
      <div className="fixed right-6 bottom-6 z-50 flex items-center gap-3">
        {/* Chat FAB — hidden on /assistant page */}
        {!isAssistantPage && (
          <Button
            className={cn(
              "h-14 w-14 rounded-full shadow-lg transition-all duration-200",
              "hover:scale-105",
              chatOpen && "rotate-45"
            )}
            variant="secondary"
            onClick={() => {
              setMenuOpen(false);
              setChatOpen((prev) => !prev);
            }}
            aria-label={chatOpen ? MINI_CHAT_CLOSE : "Chat öffnen"}
          >
            {chatOpen ? <X className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
          </Button>
        )}

        {/* Plus FAB — hidden on /assistant page */}
        {!isAssistantPage && (
          <Button
            className={cn(
              "h-14 w-14 rounded-full shadow-lg transition-all duration-200",
              "shadow-amber-500/20 hover:scale-105 hover:shadow-amber-500/30",
              menuOpen && "rotate-45"
            )}
            onClick={() => {
              setChatOpen(false);
              setMenuOpen((prev) => !prev);
            }}
            aria-label={menuOpen ? t("buttons.menuClose") : t("buttons.menuOpen")}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
          </Button>
        )}
      </div>

      {/* ── Dialogs ── */}
      <ExpenseForm
        accounts={accounts}
        categories={categories}
        open={activeForm === "expense"}
        onOpenChange={handleFormClose}
        onSuccess={handleFormSuccess}
      />
      <IncomeForm
        accounts={accounts}
        open={activeForm === "income"}
        onOpenChange={handleFormClose}
        onSuccess={handleFormSuccess}
      />
      <TransferForm
        accounts={accounts}
        open={activeForm === "transfer"}
        onOpenChange={handleFormClose}
        onSuccess={handleFormSuccess}
      />
      <AccountForm
        open={activeForm === "account"}
        onOpenChange={handleFormClose}
        onSuccess={handleFormSuccess}
      />
    </>
  );
}
