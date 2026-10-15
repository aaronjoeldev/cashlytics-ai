"use server";

import { db } from "@/lib/db";
import { merchantCategories, categories } from "@/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { ownsCategory } from "@/lib/auth/ownership";
import { requireAuth } from "@/lib/auth/require-auth";
import type { ApiResponse } from "@/types/database";

/**
 * The user's most used merchant→category mappings, learned from bookings made in the assistant.
 * The chat puts them into the system prompt so the model proposes the category used before.
 */
export async function getMerchantCategoryHints(
  limit = 30
): Promise<ApiResponse<{ merchantPattern: string; categoryId: string; categoryName: string }[]>> {
  const auth = await requireAuth();
  if (auth.error) return { success: false, error: "Unauthorized" };

  try {
    const rows = await db
      .select({
        merchantPattern: merchantCategories.merchantPattern,
        categoryId: merchantCategories.categoryId,
        categoryName: categories.name,
      })
      .from(merchantCategories)
      .innerJoin(categories, eq(merchantCategories.categoryId, categories.id))
      .where(eq(merchantCategories.userId, auth.userId))
      .orderBy(desc(merchantCategories.usageCount), desc(merchantCategories.updatedAt))
      .limit(Math.min(Math.max(1, Math.trunc(limit) || 1), 100));
    return { success: true, data: rows };
  } catch {
    return { success: false, error: "Aktion fehlgeschlagen." };
  }
}

/**
 * Records or updates a merchant→category mapping.
 * Called when user confirms a category for a daily expense.
 */
export async function learnMerchantCategory(
  merchantPattern: string,
  categoryId: string
): Promise<ApiResponse<{ learned: boolean }>> {
  const auth = await requireAuth();
  if (auth.error) return { success: false, error: "Unauthorized" };
  const { userId } = auth;

  try {
    const normalized =
      typeof merchantPattern === "string" ? merchantPattern.toLowerCase().trim() : "";
    if (!normalized || normalized.length > 200) return { success: true, data: { learned: false } };
    if (!(await ownsCategory(userId, categoryId))) {
      return { success: false, error: "Kategorie nicht gefunden oder kein Zugriff." };
    }

    await db
      .insert(merchantCategories)
      .values({ userId, merchantPattern: normalized, categoryId })
      .onConflictDoUpdate({
        target: [merchantCategories.userId, merchantCategories.merchantPattern],
        set: {
          categoryId,
          usageCount: sql`${merchantCategories.usageCount} + 1`,
          updatedAt: new Date(),
        },
      });

    return { success: true, data: { learned: true } };
  } catch {
    return {
      success: false,
      error: "Aktion fehlgeschlagen.",
    };
  }
}
