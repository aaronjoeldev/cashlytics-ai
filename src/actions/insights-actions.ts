"use server";

import { db } from "@/lib/db";
import { insights } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/require-auth";
import type { ApiResponse } from "@/types/database";
import type { Insight } from "@/lib/db/schema";
import { listActiveInsights } from "@/lib/services/insights";

/**
 * Returns active (unread, unexpired) insights for the current user.
 */
export async function getActiveInsights(): Promise<ApiResponse<Insight[]>> {
  const auth = await requireAuth();
  if (auth.error) return { success: false, error: "Unauthorized" };
  const { userId } = auth;

  try {
    return { success: true, data: await listActiveInsights(userId) };
  } catch {
    return { success: false, error: "Aktion fehlgeschlagen." };
  }
}

/**
 * Marks an insight as read.
 */
export async function markInsightRead(insightId: string): Promise<ApiResponse<{ ok: boolean }>> {
  const auth = await requireAuth();
  if (auth.error) return { success: false, error: "Unauthorized" };
  const { userId } = auth;

  try {
    await db
      .update(insights)
      .set({ isRead: true })
      .where(and(eq(insights.id, insightId), eq(insights.userId, userId)));
    return { success: true, data: { ok: true } };
  } catch {
    return { success: false, error: "Aktion fehlgeschlagen." };
  }
}
