"use client";

import { useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const t = useTranslations("chat");

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
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
    <form onSubmit={handleSubmit} className={cn("w-full", className)}>
      <div className="border-border/50 flex items-end gap-2 rounded-2xl border bg-white/5 p-2 backdrop-blur-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("inputPlaceholder")}
          disabled={isLoading}
          aria-label={t("inputLabel")}
          rows={1}
          autoFocus
          className={cn(
            "placeholder:text-muted-foreground flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none disabled:cursor-not-allowed disabled:opacity-50",
            "max-h-[200px] min-h-[2.25rem] px-2 py-2"
          )}
        />
        <Button
          type="submit"
          size="icon"
          disabled={!input.trim() || isLoading}
          aria-label={t("send")}
          className="mb-0.5 flex-shrink-0"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      <p className="text-muted-foreground mt-2 text-center text-xs">{t("inputHint")}</p>
    </form>
  );
}
