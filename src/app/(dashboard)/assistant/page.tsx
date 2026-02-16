import { ChatInterface } from '@/components/organisms/chat-interface';

export default function AssistantPage() {
  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      <div className="flex-1 overflow-hidden rounded-2xl border border-border/50 dark:border-white/[0.08] bg-card/80 dark:bg-white/[0.03] backdrop-blur-xl shadow-lg">
        <ChatInterface />
      </div>
    </div>
  );
}
