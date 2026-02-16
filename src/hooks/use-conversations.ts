'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import { toast } from 'sonner';
import {
  getConversations,
  createConversation,
  deleteConversation,
  getConversationById,
  updateConversationTitleFromFirstMessage,
  saveMessage,
} from '@/actions/conversation-actions';
import type { Conversation, Message, ApiResponse } from '@/types/database';

interface UseConversationsReturn {
  conversations: Conversation[];
  activeConversationId: string | null;
  isLoadingConversations: boolean;
  loadConversations: () => Promise<ApiResponse<Conversation[]>>;
  selectConversation: (id: string) => Promise<void>;
  startNewChat: () => Promise<void>;
  deleteConversationWithSwitch: (id: string) => Promise<void>;
  messages: ReturnType<typeof useChat>['messages'];
  sendMessage: ReturnType<typeof useChat>['sendMessage'];
  status: ReturnType<typeof useChat>['status'];
  error: ReturnType<typeof useChat>['error'];
  setMessages: ReturnType<typeof useChat>['setMessages'];
}

export function useConversations(): UseConversationsReturn {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [hasSetTitle, setHasSetTitle] = useState(false);
  const initializedRef = useRef(false);

  const chat = useChat({
    onFinish: async ({ message }) => {
      if (!activeConversationId) return;

      const messagesLength = chat.messages.length;
      const userMsg = messagesLength >= 2 
        ? chat.messages[messagesLength - 2] 
        : chat.messages.find((m) => m.role === 'user');
      
      if (userMsg?.role === 'user') {
        const userContent = userMsg.parts
          .filter((p) => p.type === 'text')
          .map((p) => p.text)
          .join('');
        await saveMessage(activeConversationId, 'user', userContent);
      }

      const assistantContent = message.parts
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('');
      await saveMessage(activeConversationId, 'assistant', assistantContent);

      if (!hasSetTitle) {
        const firstUserMessage = chat.messages.find((m) => m.role === 'user');
        if (firstUserMessage) {
          const content = firstUserMessage.parts
            .filter((p) => p.type === 'text')
            .map((p) => p.text)
            .join('');
          await updateConversationTitleFromFirstMessage(activeConversationId, content);
          setHasSetTitle(true);
        }
      }
      loadConversations();
    },
  });

  const loadConversations = useCallback(async () => {
    setIsLoadingConversations(true);
    const result = await getConversations();
    if (result.success) {
      setConversations(result.data);
    } else {
      toast.error('Fehler beim Laden der Chats');
    }
    setIsLoadingConversations(false);
    return result;
  }, []);

  const selectConversation = useCallback(async (id: string) => {
    setActiveConversationId(id);
    setHasSetTitle(true);
    const result = await getConversationById(id);
    if (result.success) {
      const uiMessages = result.data.messages.map((msg: Message) => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        parts: [{ type: 'text' as const, text: msg.content }],
      }));
      chat.setMessages(uiMessages);
    } else {
      toast.error('Fehler beim Laden des Chats');
    }
  }, [chat]);

  const startNewChat = useCallback(async () => {
    const result = await createConversation();
    if (result.success) {
      setActiveConversationId(result.data.id);
      setHasSetTitle(false);
      chat.setMessages([]);
      setConversations((prev) => [result.data, ...prev]);
    } else {
      toast.error('Fehler beim Erstellen des Chats');
    }
  }, [chat]);

  const deleteConversationWithSwitch = useCallback(
    async (id: string) => {
      const result = await deleteConversation(id);
      if (result.success) {
        const remaining = conversations.filter((c) => c.id !== id);
        setConversations(remaining);

        if (activeConversationId === id) {
          if (remaining.length > 0) {
            await selectConversation(remaining[0].id);
          } else {
            await startNewChat();
          }
        }
        toast.success('Chat gelöscht');
      } else {
        toast.error('Fehler beim Löschen des Chats');
      }
    },
    [conversations, activeConversationId, selectConversation, startNewChat]
  );

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const initialize = async () => {
      const result = await loadConversations();
      if (result.success && result.data.length > 0) {
        await selectConversation(result.data[0].id);
      } else if (result.success && result.data.length === 0) {
        await startNewChat();
      }
    };
    initialize();
  }, [loadConversations, selectConversation, startNewChat]);

  return {
    conversations,
    activeConversationId,
    isLoadingConversations,
    loadConversations,
    selectConversation,
    startNewChat,
    deleteConversationWithSwitch,
    messages: chat.messages,
    sendMessage: chat.sendMessage,
    status: chat.status,
    error: chat.error,
    setMessages: chat.setMessages,
  };
}
