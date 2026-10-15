"use client";

import { useRef, useEffect, useState } from "react";
import {
  MessageSquare,
  RefreshCw,
  Sparkles,
  TrendingUp,
  CreditCard,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChatMessage, ChatMessageLoading } from "@/components/molecules/chat-message";
import { ChatInput } from "@/components/molecules/chat-input";
import { ChatHistorySidebar } from "@/components/organisms/chat-history-sidebar";
import { useConversations } from "@/hooks/use-conversations";
import { useTranslations } from "next-intl";

const SUGGESTED_PROMPTS = [
  { icon: Sparkles, key: "overview" },
  { icon: CreditCard, key: "subscriptions" },
  { icon: TrendingUp, key: "compare" },
  { icon: AlertCircle, key: "anomalies" },
  { icon: MessageSquare, key: "addExpense" },
] as const;

export function ChatInterface() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const t = useTranslations("chat");
  const welcomeMessage = {
    id: "welcome",
    role: "assistant" as const,
    parts: [{ type: "text" as const, text: t("welcome") }],
  };

  const {
    conversations,
    activeConversationId,
    isLoadingConversations,
    selectConversation,
    startNewChat,
    deleteConversationWithSwitch,
    messages,
    sendMessage,
    regenerate,
    status,
    error,
    addToolApprovalResponse,
  } = useConversations();

  const handleToolApprove = (approvalId: string) => {
    addToolApprovalResponse({ id: approvalId, approved: true });
  };

  const handleToolDeny = (approvalId: string) => {
    addToolApprovalResponse({ id: approvalId, approved: false });
  };

  const isLoading = status === "streaming" || status === "submitted";
  const hasMessages = messages.length > 0;

  const lastAssistantIndex = messages.reduce(
    (lastIdx, msg, idx) => (msg.role === "assistant" ? idx : lastIdx),
    -1
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (input.trim() && !isLoading) {
      sendMessage({ text: input.trim() });
      setInput("");
    }
  };

  const handleSuggestedPrompt = (prompt: string) => {
    if (!isLoading) {
      sendMessage({ text: prompt });
    }
  };

  // Re-sends the last user message instead of adding a copy of it
  const handleRetry = () => {
    regenerate();
  };

  const sidebarProps = {
    conversations,
    activeConversationId,
    onSelectConversation: selectConversation,
    onNewChat: startNewChat,
    onDeleteConversation: deleteConversationWithSwitch,
    isLoading: isLoadingConversations,
  };

  return (
    <div className="flex h-full flex-col">
      {/* Mobile header bar */}
      <div className="border-border/50 flex flex-shrink-0 items-center gap-2 border-b px-2 py-2 sm:hidden dark:border-white/[0.08]">
        <ChatHistorySidebar {...sidebarProps} />
        <span className="text-sm font-semibold">Assistent</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden sm:flex">
          <ChatHistorySidebar {...sidebarProps} />
        </div>

        {/* Chat content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-2 py-4">
            <div className="mx-auto max-w-3xl space-y-1">
              {!hasMessages && !isLoading && <ChatMessage key="welcome" message={welcomeMessage} />}
              {messages.map((message, index) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onApprove={index === lastAssistantIndex ? handleToolApprove : undefined}
                  onDeny={index === lastAssistantIndex ? handleToolDeny : undefined}
                />
              ))}
              {isLoading && <ChatMessageLoading />}
              <div ref={messagesEndRef} />
            </div>

            {!hasMessages && !isLoading && (
              <div className="mx-auto max-w-3xl px-4 py-8">
                <div className="flex flex-col items-center justify-center space-y-6">
                  <div className="from-primary/20 to-primary/5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg shadow-amber-500/10">
                    <MessageSquare className="text-primary h-8 w-8" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-semibold">{t("emptyTitle")}</h3>
                    <p className="text-muted-foreground mt-1 text-sm">{t("emptyDescription")}</p>
                  </div>

                  <div className="grid w-full max-w-md gap-2">
                    {SUGGESTED_PROMPTS.map((prompt) => (
                      <Card
                        key={prompt.key}
                        className="cursor-pointer p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:hover:bg-white/[0.08]"
                        onClick={() => handleSuggestedPrompt(t(`suggestions.${prompt.key}`))}
                      >
                        <div className="flex items-center gap-3">
                          <prompt.icon className="text-primary h-4 w-4 flex-shrink-0" />
                          <span className="text-sm">{t(`suggestions.${prompt.key}`)}</span>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="mx-auto max-w-3xl px-4 py-4">
                <Card className="border-destructive/50 bg-destructive/10 p-4 dark:border-red-500/20 dark:bg-red-500/10">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <p className="text-destructive text-sm">{t("error")}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRetry}
                      disabled={isLoading}
                      aria-label={t("retryLabel")}
                    >
                      <RefreshCw className="h-4 w-4" />
                      {t("retry")}
                    </Button>
                  </div>
                </Card>
              </div>
            )}
          </div>

          <div className="border-border/50 bg-background/95 dark:bg-background/50 border-t p-2 backdrop-blur-xl sm:p-4 dark:border-white/[0.08]">
            <ChatInput
              input={input}
              isLoading={isLoading}
              onInputChange={setInput}
              onSubmit={handleSend}
              className="mx-auto max-w-3xl"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
