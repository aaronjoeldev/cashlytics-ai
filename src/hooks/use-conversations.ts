"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses } from "ai";
import { toast } from "sonner";
import {
  getConversations,
  createConversation,
  deleteConversation,
  getConversationById,
  updateConversationTitleFromFirstMessage,
  saveMessage,
} from "@/actions/conversation-actions";
import type { Conversation, Message, ApiResponse } from "@/types/database";

export type ChatEntitlementBlock = {
  reason: "trial_expired" | "cap_reached";
  upgradeTarget: "paid_plan";
  message: string;
  hardCapEur: string;
  currentSpendEur: string;
  trialEndsAt: string | null;
};

type ChatBlockedApiPayload = {
  error?: {
    code?: string;
    reason?: string;
    upgradeTarget?: string;
    message?: string;
    hardCapEur?: string;
    currentSpendEur?: string;
    trialEndsAt?: string | null;
  };
};

type ChatRequestError = Error & {
  status?: number;
  payload?: unknown;
};

interface UseConversationsReturn {
  conversations: Conversation[];
  activeConversationId: string | null;
  isLoadingConversations: boolean;
  loadConversations: () => Promise<ApiResponse<Conversation[]>>;
  selectConversation: (id: string) => Promise<void>;
  startNewChat: () => Promise<void>;
  deleteConversationWithSwitch: (id: string) => Promise<void>;
  messages: ReturnType<typeof useChat>["messages"];
  sendMessage: ReturnType<typeof useChat>["sendMessage"];
  status: ReturnType<typeof useChat>["status"];
  error: ReturnType<typeof useChat>["error"];
  setMessages: ReturnType<typeof useChat>["setMessages"];
  addToolApprovalResponse: ReturnType<typeof useChat>["addToolApprovalResponse"];
  entitlementBlock: ChatEntitlementBlock | null;
  clearEntitlementBlock: () => void;
}

function parseEntitlementBlock(payload: unknown): ChatEntitlementBlock | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const maybePayload = payload as ChatBlockedApiPayload;
  const blockedError = maybePayload.error;

  if (!blockedError || blockedError.code !== "AI_ENTITLEMENT_BLOCKED") {
    return null;
  }

  if (
    (blockedError.reason !== "trial_expired" && blockedError.reason !== "cap_reached") ||
    blockedError.upgradeTarget !== "paid_plan" ||
    typeof blockedError.message !== "string" ||
    typeof blockedError.hardCapEur !== "string" ||
    typeof blockedError.currentSpendEur !== "string"
  ) {
    return null;
  }

  return {
    reason: blockedError.reason,
    upgradeTarget: blockedError.upgradeTarget,
    message: blockedError.message,
    hardCapEur: blockedError.hardCapEur,
    currentSpendEur: blockedError.currentSpendEur,
    trialEndsAt: blockedError.trialEndsAt ?? null,
  };
}

export function useConversations(): UseConversationsReturn {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [hasSetTitle, setHasSetTitle] = useState(false);
  const [entitlementBlock, setEntitlementBlock] = useState<ChatEntitlementBlock | null>(null);
  const initializedRef = useRef(false);

  const chatTransport = useMemo(
    () =>
      new DefaultChatTransport({
        fetch: async (input, init) => {
          const response = await fetch(input, init);
          if (response.ok) {
            return response;
          }

          let payload: unknown = null;
          try {
            payload = await response.clone().json();
          } catch {
            payload = null;
          }

          const requestError = new Error("Chat request failed") as ChatRequestError;
          requestError.status = response.status;
          requestError.payload = payload;
          throw requestError;
        },
      }),
    []
  );

  const chat = useChat({
    transport: chatTransport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onError: (error) => {
      const maybeBlocked = parseEntitlementBlock((error as ChatRequestError).payload);
      if (maybeBlocked) {
        setEntitlementBlock(maybeBlocked);
        return;
      }

      toast.error("Ein Fehler ist aufgetreten. Bitte versuche es erneut.");
    },
    onFinish: async ({ message }) => {
      if (!activeConversationId) return;

      setEntitlementBlock(null);

      // Skip saving when the message only contains pending tool approvals (no text,
      // no completed results). This avoids triggering revalidatePath while the
      // confirmation card is waiting for user input.
      const hasText = message.parts.some((p) => p.type === "text");
      const hasPendingApproval = message.parts.some(
        (p) =>
          p.type.startsWith("tool-") && (p as { state?: string }).state === "approval-requested"
      );
      if (!hasText && hasPendingApproval) return;

      const messagesLength = chat.messages.length;
      const userMsg =
        messagesLength >= 2
          ? chat.messages[messagesLength - 2]
          : chat.messages.find((m) => m.role === "user");

      if (userMsg?.role === "user") {
        const userContent = userMsg.parts
          .filter((p) => p.type === "text")
          .map((p) => (p as { type: "text"; text: string }).text)
          .join("");
        await saveMessage(activeConversationId, "user", userContent);
      }

      const assistantContent = message.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("");
      await saveMessage(activeConversationId, "assistant", assistantContent);

      if (!hasSetTitle) {
        const firstUserMessage = chat.messages.find((m) => m.role === "user");
        if (firstUserMessage) {
          const content = firstUserMessage.parts
            .filter((p) => p.type === "text")
            .map((p) => (p as { type: "text"; text: string }).text)
            .join("");
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
      toast.error("Fehler beim Laden der Chats");
    }
    setIsLoadingConversations(false);
    return result;
  }, []);

  const selectConversation = useCallback(
    async (id: string) => {
      setActiveConversationId(id);
      setHasSetTitle(true);
      const result = await getConversationById(id);
      if (result.success) {
        const uiMessages = result.data.messages.map((msg: Message) => ({
          id: msg.id,
          role: msg.role as "user" | "assistant",
          parts: [{ type: "text" as const, text: msg.content }],
        }));
        chat.setMessages(uiMessages);
      } else {
        toast.error("Fehler beim Laden des Chats");
      }
    },
    [chat]
  );

  const startNewChat = useCallback(async () => {
    const result = await createConversation();
    if (result.success) {
      setActiveConversationId(result.data.id);
      setHasSetTitle(false);
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

  const sendMessageWithContext: UseConversationsReturn["sendMessage"] = useCallback(
    (message, options) => {
      setEntitlementBlock(null);
      chat.clearError();
      return chat.sendMessage(message, {
        ...options,
        body: {
          ...options?.body,
          conversationId: activeConversationId,
          requestId: crypto.randomUUID(),
        },
      });
    },
    [activeConversationId, chat]
  );

  const clearEntitlementBlock = useCallback(() => {
    setEntitlementBlock(null);
    chat.clearError();
  }, [chat]);

  return {
    conversations,
    activeConversationId,
    isLoadingConversations,
    loadConversations,
    selectConversation,
    startNewChat,
    deleteConversationWithSwitch,
    messages: chat.messages,
    sendMessage: sendMessageWithContext,
    status: chat.status,
    error: chat.error,
    setMessages: chat.setMessages,
    addToolApprovalResponse: chat.addToolApprovalResponse,
    entitlementBlock,
    clearEntitlementBlock,
  };
}
