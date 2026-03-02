"use client";

import { useRef, useEffect, useState } from "react";
import { MessageSquare, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChatMessage, ChatMessageLoading } from "@/components/molecules/chat-message";
import { ChatInput } from "@/components/molecules/chat-input";
import { ChatHistorySidebar } from "@/components/organisms/chat-history-sidebar";
import { useConversations } from "@/hooks/use-conversations";

const WELCOME_TEXT = `Hallo! Ich bin dein Cashlytics Assistent.

Du kannst mir Fragen zu deinen Finanzen stellen oder Schnellbefehle nutzen:

• "45€ Tanken" - Erstellt eine Ausgabe
• "Wie viel habe ich diesen Monat ausgegeben?" - Zeigt Übersicht
• "Zeige meine Einnahmen" - Listet Einnahmen auf

Wie kann ich dir helfen?`;

const WELCOME_MESSAGE = {
  id: "welcome",
  role: "assistant" as const,
  parts: [{ type: "text" as const, text: WELCOME_TEXT }],
};

const SUGGESTED_PROMPTS = [
  { icon: Sparkles, text: "Wie sieht mein Budget aus?" },
  { icon: MessageSquare, text: "Ich habe 45€ bei REWE ausgegeben" },
  { icon: MessageSquare, text: "Zeige meine Ausgaben diesen Monat" },
];

export function ChatInterface() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");

  const {
    conversations,
    activeConversationId,
    isLoadingConversations,
    selectConversation,
    startNewChat,
    deleteConversationWithSwitch,
    messages,
    sendMessage,
    status,
    error,
    addToolApprovalResponse,
    entitlementBlock,
    clearEntitlementBlock,
  } = useConversations();

  const handleToolApprove = (approvalId: string) => {
    addToolApprovalResponse({ id: approvalId, approved: true });
  };

  const handleToolDeny = (approvalId: string) => {
    addToolApprovalResponse({ id: approvalId, approved: false });
  };

  const isLoading = status === "streaming" || status === "submitted";
  const isBlocked = entitlementBlock !== null;
  const isInputDisabled = isLoading || isBlocked;
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
    if (input.trim() && !isInputDisabled) {
      sendMessage({ text: input.trim() });
      setInput("");
    }
  };

  const handleSuggestedPrompt = (prompt: string) => {
    if (!isInputDisabled) {
      sendMessage({ text: prompt });
    }
  };

  const handleRetry = () => {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMessage) {
      const content = lastUserMessage.parts
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("");
      sendMessage({ text: content });
    }
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
              {!hasMessages && !isLoading && (
                <ChatMessage key="welcome" message={WELCOME_MESSAGE} />
              )}
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
                    <h3 className="text-lg font-semibold">Starte eine Konversation</h3>
                    <p className="text-muted-foreground mt-1 text-sm">
                      Dein AI-Assistent hilft dir bei allen Finanzfragen
                    </p>
                  </div>

                  <div className="grid w-full max-w-md gap-2">
                    {SUGGESTED_PROMPTS.map((prompt, index) => (
                      <Card
                        key={index}
                        className="cursor-pointer p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:hover:bg-white/[0.08]"
                        onClick={() => handleSuggestedPrompt(prompt.text)}
                      >
                        <div className="flex items-center gap-3">
                          <prompt.icon className="text-primary h-4 w-4 flex-shrink-0" />
                          <span className="text-sm">{prompt.text}</span>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {entitlementBlock && (
              <div className="mx-auto max-w-3xl px-4 py-4">
                <Card className="border-amber-500/40 bg-amber-500/10 p-4 dark:border-amber-400/30 dark:bg-amber-500/10">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                        {entitlementBlock.message}
                      </p>
                      <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
                        Verbrauch: {entitlementBlock.currentSpendEur} EUR / Limit:{" "}
                        {entitlementBlock.hardCapEur} EUR
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button asChild size="sm" className="whitespace-nowrap">
                        <Link href="/settings">Upgrade</Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearEntitlementBlock}
                        disabled={isLoading}
                      >
                        Erneut pruefen
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {error && !entitlementBlock && (
              <div className="mx-auto max-w-3xl px-4 py-4">
                <Card className="border-destructive/50 bg-destructive/10 p-4 dark:border-red-500/20 dark:bg-red-500/10">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <p className="text-destructive text-sm">
                        Ein Fehler ist aufgetreten. Bitte versuche es erneut.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRetry}
                      disabled={isInputDisabled}
                      aria-label="Erneut versuchen"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Wiederholen
                    </Button>
                  </div>
                </Card>
              </div>
            )}
          </div>

          <div className="border-border/50 bg-background/95 dark:bg-background/50 border-t p-2 backdrop-blur-xl sm:p-4 dark:border-white/[0.08]">
            <ChatInput
              input={input}
              isLoading={isInputDisabled}
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
