"use server";

import { db } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type {
  ApiResponse,
  Conversation,
  Message,
  ConversationWithMessages,
} from "@/types/database";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/lib/auth/require-auth";

const MAX_TITLE_LENGTH = 200;
// Same bound as a whole chat request in src/app/api/chat/route.ts
const MAX_MESSAGE_LENGTH = 400_000;

export async function getConversations(): Promise<ApiResponse<Conversation[]>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }
    const { userId } = authResult;

    const allConversations = await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.updatedAt));
    return { success: true, data: allConversations };
  } catch (error) {
    logger.error("Failed to fetch conversations", "getConversations", error);
    return { success: false, error: "Failed to fetch conversations" };
  }
}

export async function getConversationById(
  id: string
): Promise<ApiResponse<ConversationWithMessages>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }
    const { userId } = authResult;

    const [conversation] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));

    if (!conversation) {
      return { success: false, error: "Conversation not found" };
    }

    const conversationMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(messages.createdAt);

    return {
      success: true,
      data: { ...conversation, messages: conversationMessages },
    };
  } catch (error) {
    logger.error("Failed to fetch conversation", "getConversationById", error);
    return { success: false, error: "Failed to fetch conversation" };
  }
}

export async function createConversation(title?: string): Promise<ApiResponse<Conversation>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }
    const { userId } = authResult;

    const now = new Date();
    const [conversation] = await db
      .insert(conversations)
      .values({
        userId,
        title: title?.trim().slice(0, MAX_TITLE_LENGTH) || "Neuer Chat",
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    revalidatePath("/assistant");
    return { success: true, data: conversation };
  } catch (error) {
    logger.error("Failed to create conversation", "createConversation", error);
    return { success: false, error: "Failed to create conversation" };
  }
}

export async function deleteConversation(id: string): Promise<ApiResponse<void>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }
    const { userId } = authResult;

    await db
      .delete(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
    revalidatePath("/assistant");
    return { success: true, data: undefined };
  } catch (error) {
    logger.error("Failed to delete conversation", "deleteConversation", error);
    return { success: false, error: "Failed to delete conversation" };
  }
}

export async function saveMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string
): Promise<ApiResponse<Message>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }
    const { userId } = authResult;

    if (role !== "user" && role !== "assistant") {
      return { success: false, error: "Ungültige Rolle." };
    }
    if (typeof content !== "string" || content.length > MAX_MESSAGE_LENGTH) {
      return { success: false, error: "Nachricht ist zu lang." };
    }

    // Verify conversation ownership before inserting a message
    const [ownedConv] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
      .limit(1);
    if (!ownedConv) {
      return { success: false, error: "Unauthorized" };
    }

    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));

    const [message] = await db
      .insert(messages)
      .values({ conversationId, role, content })
      .returning();

    revalidatePath("/assistant");
    return { success: true, data: message };
  } catch (error) {
    logger.error("Failed to save message", "saveMessage", error);
    return { success: false, error: "Failed to save message" };
  }
}

/** Names a conversation after its first user message (first 50 characters). */
export async function updateConversationTitleFromFirstMessage(
  conversationId: string,
  firstMessage: string
): Promise<ApiResponse<Conversation>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }
    const { userId } = authResult;

    const text = typeof firstMessage === "string" ? firstMessage.trim() : "";
    const title = (text.length > 50 ? `${text.slice(0, 50)}...` : text).slice(0, MAX_TITLE_LENGTH);
    if (!title) {
      return { success: false, error: "Titel ist erforderlich." };
    }

    const [conversation] = await db
      .update(conversations)
      .set({ title, updatedAt: new Date() })
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
      .returning();

    if (!conversation) {
      return { success: false, error: "Conversation not found" };
    }
    revalidatePath("/assistant");
    return { success: true, data: conversation };
  } catch (error) {
    logger.error("Failed to update conversation", "updateConversationTitleFromFirstMessage", error);
    return { success: false, error: "Failed to update conversation" };
  }
}
