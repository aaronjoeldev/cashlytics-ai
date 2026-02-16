'use client';

import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  input: string;
  isLoading: boolean;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  className?: string;
}

export function ChatInput({
  input,
  isLoading,
  onInputChange,
  onSubmit,
  className,
}: ChatInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        onSubmit();
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSubmit();
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn('w-full', className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-2 p-2 rounded-2xl bg-white/5 dark:bg-white/[0.03] backdrop-blur-sm border border-border/50 dark:border-white/[0.08]">
        <Input
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Schreibe eine Nachricht... oder '45€ REWE'"
          disabled={isLoading}
          aria-label="Chat-Nachricht eingeben"
          className="flex-1"
          autoFocus
        />
        <Button
          type="submit"
          disabled={!input.trim() || isLoading}
          aria-label="Nachricht senden"
          className="w-full sm:w-auto"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          <span className="sm:hidden">Senden</span>
        </Button>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Enter zum Senden
      </p>
    </form>
  );
}
