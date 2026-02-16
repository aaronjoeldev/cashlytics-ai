'use server';

import { db } from '@/lib/db';
import { conversations, messages } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { ApiResponse, Conversation, Message, ConversationWithMessages } from '@/types/database';

export async function getConversations(): Promise<ApiResponse<Conversation[]>> {
  try {
    const allConversations = await db
      .select()
      .from(conversations)
      .orderBy(desc(conversations.updatedAt));
    return { success: true, data: allConversations };
  } catch (error) {
    console.error('Failed to fetch conversations:', error);
    return { success: false, error: 'Failed to fetch conversations' };
  }
}

export async function getConversationById(id: string): Promise<ApiResponse<ConversationWithMessages>> {
  try {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));

    if (!conversation) {
      return { success: false, error: 'Conversation not found' };
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
    console.error('Failed to fetch conversation:', error);
    return { success: false, error: 'Failed to fetch conversation' };
  }
}

export async function createConversation(title?: string): Promise<ApiResponse<Conversation>> {
  try {
    const now = new Date();
    const [conversation] = await db
      .insert(conversations)
      .values({
        title: title || 'Neuer Chat',
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    revalidatePath('/assistant');
    return { success: true, data: conversation };
  } catch (error) {
    console.error('Failed to create conversation:', error);
    return { success: false, error: 'Failed to create conversation' };
  }
}

export async function updateConversationTitle(
  id: string,
  title: string
): Promise<ApiResponse<Conversation>> {
  try {
    const [conversation] = await db
      .update(conversations)
      .set({ title, updatedAt: new Date() })
      .where(eq(conversations.id, id))
      .returning();

    if (!conversation) {
      return { success: false, error: 'Conversation not found' };
    }
    revalidatePath('/assistant');
    return { success: true, data: conversation };
  } catch (error) {
    console.error('Failed to update conversation:', error);
    return { success: false, error: 'Failed to update conversation' };
  }
}

export async function deleteConversation(id: string): Promise<ApiResponse<void>> {
  try {
    await db.delete(conversations).where(eq(conversations.id, id));
    revalidatePath('/assistant');
    return { success: true, data: undefined };
  } catch (error) {
    console.error('Failed to delete conversation:', error);
    return { success: false, error: 'Failed to delete conversation' };
  }
}

export async function saveMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<ApiResponse<Message>> {
  try {
    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));

    const [message] = await db
      .insert(messages)
      .values({ conversationId, role, content })
      .returning();

    revalidatePath('/assistant');
    return { success: true, data: message };
  } catch (error) {
    console.error('Failed to save message:', error);
    return { success: false, error: 'Failed to save message' };
  }
}

export async function getMessages(conversationId: string): Promise<ApiResponse<Message[]>> {
  try {
    const conversationMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
    return { success: true, data: conversationMessages };
  } catch (error) {
    console.error('Failed to fetch messages:', error);
    return { success: false, error: 'Failed to fetch messages' };
  }
}

export async function updateConversationTitleFromFirstMessage(
  conversationId: string,
  firstMessage: string
): Promise<ApiResponse<Conversation>> {
  const title = firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '...' : '');
  return updateConversationTitle(conversationId, title);
}
