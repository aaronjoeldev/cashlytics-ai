'use client';

import { useState, useRef, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { usePathname } from 'next/navigation';
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
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { getAccounts } from '@/actions/account-actions';
import { getCategories } from '@/actions/category-actions';
import { ChatMessage, ChatMessageLoading } from '@/components/molecules/chat-message';
import { ExpenseForm } from '@/components/organisms/expense-form';
import { IncomeForm } from '@/components/organisms/income-form';
import { AccountForm } from '@/components/organisms/account-form';
import { TransferForm } from '@/components/organisms/transfer-form';
import type { Account, Category } from '@/types/database';

type FormType = 'expense' | 'income' | 'transfer' | 'account' | null;

const QUICK_CHAT_PROMPTS = ['45€ Tanken', 'Budget diesen Monat?', 'Einnahmen zeigen'];

export function FloatingActions() {
  const pathname = usePathname();
  const isAssistantPage = pathname === '/assistant';

  // Menu state
  const [menuOpen, setMenuOpen] = useState(false);

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { messages, sendMessage, status } = useChat();
  const chatLoading = status === 'streaming' || status === 'submitted';

  // Form state
  const [activeForm, setActiveForm] = useState<FormType>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

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
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, chatOpen]);

  const handleMenuAction = (type: FormType | 'chat') => {
    setMenuOpen(false);
    if (type === 'chat') {
      setChatOpen(true);
    } else {
      setActiveForm(type);
    }
  };

  const handleChatSend = () => {
    if (!chatInput.trim() || chatLoading) return;
    sendMessage({ text: chatInput.trim() });
    setChatInput('');
  };

  const handleFormClose = (open: boolean) => {
    if (!open) setActiveForm(null);
  };

  const handleFormSuccess = () => {
    setDataLoaded(false);
  };

  const ACTIONS = [
    {
      key: 'expense' as const,
      icon: TrendingDown,
      label: 'Ausgabe',
      className: 'bg-amber-500 hover:bg-amber-600 text-white',
    },
    {
      key: 'income' as const,
      icon: TrendingUp,
      label: 'Einnahme',
      className: 'bg-emerald-500 hover:bg-emerald-600 text-white',
    },
    {
      key: 'transfer' as const,
      icon: ArrowRightLeft,
      label: 'Transfer',
      className: 'bg-violet-500 hover:bg-violet-600 text-white',
    },
    {
      key: 'account' as const,
      icon: CreditCard,
      label: 'Konto',
      className: 'bg-blue-500 hover:bg-blue-600 text-white',
    },
  ];

  return (
    <>
      {/* ── Chat Panel ── */}
      <div
        className={cn(
          'fixed bottom-24 right-[5.5rem] z-50 flex flex-col w-[360px] rounded-2xl border border-border/50 dark:border-white/[0.08] bg-background shadow-2xl shadow-black/20 overflow-hidden transition-all duration-300 ease-out',
          chatOpen
            ? 'h-[520px] opacity-100 translate-y-0 pointer-events-auto'
            : 'h-0 opacity-0 translate-y-4 pointer-events-none'
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 dark:border-white/[0.08] bg-card/50 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm font-semibold">Cashlytics Assistent</p>
          </div>
          <div className="flex items-center gap-1">
            <Link href="/assistant" onClick={() => setChatOpen(false)}>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Vollansicht öffnen">
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setChatOpen(false)}
              aria-label="Chat schließen"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 && !chatLoading && (
            <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                Frag mich nach deinen Finanzen oder buche schnell eine Ausgabe.
              </p>
              <div className="flex flex-col gap-2 w-full">
                {QUICK_CHAT_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    className="text-xs text-left px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
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

        <div className="border-t border-border/50 dark:border-white/[0.08] p-3 shrink-0">
          <div className="flex gap-2 p-1.5 rounded-xl bg-white/5 dark:bg-white/[0.03] border border-border/50 dark:border-white/[0.08]">
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleChatSend();
                }
              }}
              placeholder="z.B. '45€ REWE'"
              disabled={chatLoading}
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 text-sm h-8 px-2"
            />
            <Button
              size="sm"
              className="h-8 px-3 shrink-0"
              disabled={!chatInput.trim() || chatLoading}
              onClick={handleChatSend}
              aria-label="Senden"
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
          'fixed bottom-24 right-6 z-40 flex flex-col items-end gap-2.5 transition-all duration-200 ease-out',
          menuOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        )}
      >
        {ACTIONS.map((action, index) => (
          <div
            key={action.key}
            className={cn(
              'flex items-center gap-3 transition-all duration-200',
              menuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            )}
            style={{ transitionDelay: menuOpen ? `${index * 40}ms` : '0ms' }}
          >
            <span className="text-xs font-medium bg-background/95 backdrop-blur-sm border border-border/50 px-2.5 py-1 rounded-lg shadow-sm whitespace-nowrap">
              {action.label}
            </span>
            <Button
              size="icon"
              className={cn('h-10 w-10 rounded-full shadow-md', action.className)}
              onClick={() => handleMenuAction(action.key)}
              aria-label={action.label}
            >
              <action.icon className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* ── FAB Container ── */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
        {/* Chat FAB — hidden on /assistant page */}
        {!isAssistantPage && (
          <Button
            className={cn(
              'h-14 w-14 rounded-full shadow-lg transition-all duration-200',
              'hover:scale-105',
              chatOpen && 'rotate-45'
            )}
            variant="secondary"
            onClick={() => {
              setMenuOpen(false);
              setChatOpen((prev) => !prev);
            }}
            aria-label={chatOpen ? 'Chat schließen' : 'Chat öffnen'}
          >
            {chatOpen ? <X className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
          </Button>
        )}

        {/* Plus FAB */}
        <Button
          className={cn(
            'h-14 w-14 rounded-full shadow-lg transition-all duration-200',
            'shadow-amber-500/20 hover:shadow-amber-500/30 hover:scale-105',
            menuOpen && 'rotate-45'
          )}
          onClick={() => {
            setChatOpen(false);
            setMenuOpen((prev) => !prev);
          }}
          aria-label={menuOpen ? 'Schließen' : 'Aktionen'}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
        </Button>
      </div>

      {/* ── Dialogs ── */}
      <ExpenseForm
        accounts={accounts}
        categories={categories}
        open={activeForm === 'expense'}
        onOpenChange={handleFormClose}
        onSuccess={handleFormSuccess}
      />
      <IncomeForm
        accounts={accounts}
        open={activeForm === 'income'}
        onOpenChange={handleFormClose}
        onSuccess={handleFormSuccess}
      />
      <TransferForm
        accounts={accounts}
        open={activeForm === 'transfer'}
        onOpenChange={handleFormClose}
        onSuccess={handleFormSuccess}
      />
      <AccountForm
        open={activeForm === 'account'}
        onOpenChange={handleFormClose}
        onSuccess={handleFormSuccess}
      />
    </>
  );
}
