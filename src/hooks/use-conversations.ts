"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { chatTransport } from "@/lib/ai/chat-transport";
import { lastAssistantMessageIsCompleteWithApprovalResponses, type UIMessage } from "ai";
import { toast } from "sonner";
import {
  getConversations,
  createConversation,
  deleteConversation,
  getConversationById,
  updateConversationTitleFromFirstMessage,
  saveMessage,
} from "@/actions/conversation-actions";
import { collectTurnToSave, textOf } from "@/lib/ai/chat-history";
import type { Conversation, Message, ApiResponse } from "@/types/database";

interface UseConversationsReturn {
  conversations: Conversation[];
  activeConversationId: string | null;
  isLoadingConversations: boolean;
  loadConversations: () => Promise<ApiResponse<Conversation[]>>;
  selectConversation: (id: string) => Promise<void>;
  startNewChat: () => Promise<void>;
  deleteConversationWithSwitch: (id: string) => Promise<void>;
  messages: ReturnType<typeof useChat>["messages"];
  sendMessage: (message: { text: string }) => Promise<void>;
  regenerate: () => Promise<void>;
  status: ReturnType<typeof useChat>["status"];
  error: ReturnType<typeof useChat>["error"];
  setMessages: ReturnType<typeof useChat>["setMessages"];
  addToolApprovalResponse: ReturnType<typeof useChat>["addToolApprovalResponse"];
}

export function useConversations(): UseConversationsReturn {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const initializedRef = useRef(false);
  const activeConversationRef = useRef<string | null>(null);
  // Conversation the running request belongs to; its answer is stored there
  const requestConversationRef = useRef<string | null>(null);
  // Ids of messages that are already stored (loaded from the database or saved after a turn)
  const savedMessageIdsRef = useRef(new Set<string>());
  // Conversations whose title was already taken from the first message
  const titledConversationsRef = useRef(new Set<string>());

  const persistTurn = async (conversationId: string, message: UIMessage, messages: UIMessage[]) => {
    const turn = collectTurnToSave(message, messages, savedMessageIdsRef.current);
    if (!turn) return;

    // Mark first, so an overlapping finish cannot store the same messages again
    if (turn.user) savedMessageIdsRef.current.add(turn.user.id);
    turn.assistantIds.forEach((id) => savedMessageIdsRef.current.add(id));

    const userContent = turn.user ? textOf(turn.user) : "";
    if (userContent) {
      await saveMessage(conversationId, "user", userContent);
      if (!titledConversationsRef.current.has(conversationId)) {
        titledConversationsRef.current.add(conversationId);
        await updateConversationTitleFromFirstMessage(conversationId, userContent);
      }
    }
    if (turn.assistantContent) {
      await saveMessage(conversationId, "assistant", turn.assistantContent);
    }
    loadConversations();
  };

  const chat = useChat({
    transport: chatTransport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onFinish: ({ message, messages, isAbort, isError, isDisconnect }) => {
      // Failed or stopped answers are not stored; a retry stores the turn once it succeeds
      if (isAbort || isError || isDisconnect) return;
      const conversationId = requestConversationRef.current;
      if (!conversationId) return;
      persistTurn(conversationId, message, messages).catch(() => {
        toast.error("Nachricht konnte nicht gespeichert werden");
      });
    },
  });

  const loadConversations = useCallback(async () => {
    setIsLoadingConversations(true);
    const result = await getConversations();
    if (result.success) {
      setConversations(result.data);
    } else {
      toast.error("Fehler beim Laden der Chats");
    }
    setIsLoadingConversations(false);
    return result;
  }, []);

  const selectConversation = useCallback(
    async (id: string) => {
      // A running answer belongs to the previous conversation; stop it instead of mixing them
      await chat.stop();
      activeConversationRef.current = id;
      setActiveConversationId(id);
      const result = await getConversationById(id);
      if (result.success) {
        const uiMessages = result.data.messages.map((msg: Message) => ({
          id: msg.id,
          role: msg.role as "user" | "assistant",
          parts: [{ type: "text" as const, text: msg.content }],
        }));
        uiMessages.forEach((msg) => savedMessageIdsRef.current.add(msg.id));
        if (uiMessages.some((msg) => msg.role === "user")) {
          titledConversationsRef.current.add(id);
        }
        chat.setMessages(uiMessages);
      } else {
        toast.error("Fehler beim Laden des Chats");
      }
    },
    [chat]
  );

  const startNewChat = useCallback(async () => {
    await chat.stop();
    const result = await createConversation();
    if (result.success) {
      activeConversationRef.current = result.data.id;
      setActiveConversationId(result.data.id);
      chat.setMessages([]);
      setConversations((prev) => [result.data, ...prev]);
    } else {
      toast.error("Fehler beim Erstellen des Chats");
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
        toast.success("Chat gelöscht");
      } else {
        toast.error("Fehler beim Löschen des Chats");
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
    sendMessage: async (message) => {
      requestConversationRef.current = activeConversationRef.current;
      await chat.sendMessage(message);
    },
    // Sends the last user message again without adding it a second time
    regenerate: async () => {
      requestConversationRef.current = activeConversationRef.current;
      await chat.regenerate();
    },
    status: chat.status,
    error: chat.error,
    setMessages: chat.setMessages,
    addToolApprovalResponse: chat.addToolApprovalResponse,
  };
}
