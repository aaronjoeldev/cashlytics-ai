'use client';

import { useRef, useEffect, useState } from 'react';
import { MessageSquare, RefreshCw, Sparkles, TrendingUp, CreditCard, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChatMessage, ChatMessageLoading } from '@/components/molecules/chat-message';
import { ChatInput } from '@/components/molecules/chat-input';
import { ChatHistorySidebar } from '@/components/organisms/chat-history-sidebar';
import { useConversations } from '@/hooks/use-conversations';

const WELCOME_TEXT = `Hallo! Ich bin dein Cashlytics Assistent.

Ich kann dir bei deinen Finanzen helfen:

• Ausgaben erfassen: "45€ Tanken"
• Budget prüfen: "Kann ich mir X leisten?"
• Trends analysieren: "Vergleiche Mai mit April"
• Abos überblicken: "Welche Subscriptions habe ich?"
• Insights zeigen: "Gibt es etwas Auffälliges?"

Wie kann ich dir helfen?`;

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant' as const,
  parts: [{ type: 'text' as const, text: WELCOME_TEXT }],
};

const SUGGESTED_PROMPTS = [
  { icon: Sparkles, text: 'Wie sieht es finanziell aus?' },
  { icon: CreditCard, text: 'Welche Abos habe ich?' },
  { icon: TrendingUp, text: 'Vergleiche diesen Monat mit dem letzten' },
  { icon: AlertCircle, text: 'Gibt es etwas Auffälliges bei meinen Ausgaben?' },
  { icon: MessageSquare, text: 'Ich habe 45€ bei REWE ausgegeben' },
];

export function ChatInterface() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');

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
  } = useConversations();

  const handleToolApprove = (approvalId: string) => {
    addToolApprovalResponse({ id: approvalId, approved: true });
  };

  const handleToolDeny = (approvalId: string) => {
    addToolApprovalResponse({ id: approvalId, approved: false });
  };

  const isLoading = status === 'streaming' || status === 'submitted';
  const hasMessages = messages.length > 0;

  const lastAssistantIndex = messages.reduce(
    (lastIdx, msg, idx) => (msg.role === 'assistant' ? idx : lastIdx),
    -1
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (input.trim() && !isLoading) {
      sendMessage({ text: input.trim() });
      setInput('');
    }
  };

  const handleSuggestedPrompt = (prompt: string) => {
    if (!isLoading) {
      sendMessage({ text: prompt });
    }
  };

  const handleRetry = () => {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMessage) {
      const content = lastUserMessage.parts
        .filter((p) => p.type === 'text')
        .map((p) => p.text)
        .join('');
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
      <div className="flex sm:hidden items-center gap-2 border-b border-border/50 dark:border-white/[0.08] px-2 py-2 flex-shrink-0">
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
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-lg shadow-amber-500/10">
                    <MessageSquare className="h-8 w-8 text-primary" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-semibold">Starte eine Konversation</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Dein AI-Assistent hilft dir bei allen Finanzfragen
                    </p>
                  </div>

                  <div className="grid w-full max-w-md gap-2">
                    {SUGGESTED_PROMPTS.map((prompt, index) => (
                      <Card
                        key={index}
                        className="cursor-pointer p-3 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 dark:hover:bg-white/[0.08]"
                        onClick={() => handleSuggestedPrompt(prompt.text)}
                      >
                        <div className="flex items-center gap-3">
                          <prompt.icon className="h-4 w-4 flex-shrink-0 text-primary" />
                          <span className="text-sm">{prompt.text}</span>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="mx-auto max-w-3xl px-4 py-4">
                <Card className="border-destructive/50 bg-destructive/10 dark:bg-red-500/10 dark:border-red-500/20 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-destructive">
                        Ein Fehler ist aufgetreten. Bitte versuche es erneut.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRetry}
                      disabled={isLoading}
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

          <div className="border-t border-border/50 dark:border-white/[0.08] bg-background/95 dark:bg-background/50 p-2 sm:p-4 backdrop-blur-xl">
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
