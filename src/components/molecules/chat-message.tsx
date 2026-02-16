'use client';

import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { User, Bot } from 'lucide-react';
import type { UIMessage } from 'ai';
import { isTextUIPart } from 'ai';

interface ChatMessageProps {
  message: UIMessage;
}

interface ChatMessageSimpleProps {
  role: 'user' | 'assistant';
  content: string;
  isLoading?: boolean;
}

function getTextContent(message: UIMessage): string {
  return message.parts.filter(isTextUIPart).map((part) => part.text).join('');
}

function formatMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  
  return lines.map((line, lineIndex) => {
    if (line.startsWith('• ') || line.startsWith('- ')) {
      return (
        <div key={lineIndex} className="flex gap-2">
          <span>•</span>
          <span>{formatInlineMarkdown(line.slice(2))}</span>
        </div>
      );
    }
    
    if (line.startsWith('**') && line.endsWith('**')) {
      return (
        <p key={lineIndex} className="font-semibold">
          {line.slice(2, -2)}
        </p>
      );
    }
    
    return <p key={lineIndex}>{formatInlineMarkdown(line)}</p>;
  });
}

function formatInlineMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;
  
  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    
    if (boldMatch && boldMatch.index !== undefined) {
      if (boldMatch.index > 0) {
        parts.push(remaining.slice(0, boldMatch.index));
      }
      parts.push(
        <strong key={key++} className="font-semibold">
          {boldMatch[1]}
        </strong>
      );
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
    } else {
      parts.push(remaining);
      break;
    }
  }
  
  return parts;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const content = getTextContent(message);

  return (
    <div
      className={cn('flex gap-3 px-4 py-3', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      <div
        className={cn(
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-gray-900' : 'bg-gradient-to-br from-white/10 to-white/5 dark:text-muted-foreground text-muted-foreground'
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div
        className={cn(
          'max-w-[80%] space-y-1',
          isUser ? 'flex items-end' : 'flex items-start'
        )}
      >
        <Card
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm shadow-sm',
            isUser
              ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-gray-900 rounded-tr-md'
              : 'bg-card rounded-tl-md'
          )}
        >
          <div className="whitespace-pre-wrap break-words leading-relaxed">
            {isUser ? content : formatMarkdown(content)}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function ChatMessageSimple({ role, content, isLoading }: ChatMessageSimpleProps) {
  const isUser = role === 'user';

  if (isLoading) {
    return (
      <div className="flex gap-3 px-4 py-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Bot className="h-4 w-4" />
        </div>
        <Card className="rounded-2xl rounded-tl-md bg-card px-4 py-2.5 text-sm shadow-sm">
          <div className="flex gap-1">
            <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:0ms]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:150ms]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:300ms]" />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div
      className={cn('flex gap-3 px-4 py-3', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      <div
        className={cn(
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-gray-900' : 'bg-gradient-to-br from-white/10 to-white/5 dark:text-muted-foreground text-muted-foreground'
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div
        className={cn(
          'max-w-[80%] space-y-1',
          isUser ? 'flex items-end' : 'flex items-start'
        )}
      >
        <Card
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm shadow-sm',
            isUser
              ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-gray-900 rounded-tr-md'
              : 'bg-card rounded-tl-md'
          )}
        >
          <div className="whitespace-pre-wrap break-words leading-relaxed">
            {isUser ? content : formatMarkdown(content)}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function ChatMessageLoading() {
  return (
    <div className="flex gap-3 px-4 py-3">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Bot className="h-4 w-4" />
      </div>
      <Card className="rounded-2xl rounded-tl-md bg-card px-4 py-2.5 text-sm shadow-sm">
        <div className="flex gap-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:0ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:300ms]" />
        </div>
      </Card>
    </div>
  );
}
