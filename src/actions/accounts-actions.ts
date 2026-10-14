"use server";

import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { ApiResponse, Account } from "@/types/database";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/lib/auth/require-auth";

export async function getAccountById(id: string): Promise<ApiResponse<Account>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return { success: false, error: "Unauthorized" };

    const [account] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.userId, authResult.userId)))
      .limit(1);

    if (!account) {
      return { success: false, error: "Konto nicht gefunden." };
    }

    return { success: true, data: account };
  } catch (error) {
    logger.error("Failed to fetch account", "getAccountById", error);
    return { success: false, error: "Konto konnte nicht geladen werden." };
  }
}
