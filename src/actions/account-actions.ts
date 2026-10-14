"use server";

import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { ApiResponse, Account, NewAccount } from "@/types/database";
import { logger } from "@/lib/logger";
import { createAccountInput, parseInput, updateAccountInput } from "@/lib/validations/action-input";
import { requireAuth } from "@/lib/auth/require-auth";

export async function getAccounts(): Promise<ApiResponse<Account[]>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return { success: false, error: "Unauthorized" };

    const allAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, authResult.userId))
      .orderBy(accounts.name);
    return { success: true, data: allAccounts };
  } catch (error) {
    logger.error("Failed to fetch accounts", "getAccounts", error);
    return { success: false, error: "Failed to fetch accounts" };
  }
}

export async function createAccount(
  data: Omit<NewAccount, "userId">
): Promise<ApiResponse<Account>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return { success: false, error: "Unauthorized" };

    const input = parseInput(createAccountInput, data);
    if (!input.success) return input;

    const [account] = await db
      .insert(accounts)
      .values({ ...input.data, userId: authResult.userId })
      .returning();
    revalidatePath("/accounts");
    revalidatePath("/dashboard");
    return { success: true, data: account };
  } catch (error) {
    logger.error("Failed to create account", "createAccount", error);
    return { success: false, error: "Failed to create account" };
  }
}

export async function updateAccount(
  id: string,
  data: Partial<NewAccount>
): Promise<ApiResponse<Account>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return { success: false, error: "Unauthorized" };

    const input = parseInput(updateAccountInput, data);
    if (!input.success) return input;
    const updates = input.data;
    if (Object.keys(updates).length === 0) {
      return { success: false, error: "Keine Änderungen übergeben." };
    }

    const [account] = await db
      .update(accounts)
      .set(updates)
      .where(and(eq(accounts.id, id), eq(accounts.userId, authResult.userId)))
      .returning();
    if (!account) {
      return { success: false, error: "Account not found" };
    }
    revalidatePath("/accounts");
    revalidatePath("/dashboard");
    return { success: true, data: account };
  } catch (error) {
    logger.error("Failed to update account", "updateAccount", error);
    return { success: false, error: "Failed to update account" };
  }
}

export async function deleteAccount(id: string): Promise<ApiResponse<void>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return { success: false, error: "Unauthorized" };

    const [deleted] = await db
      .delete(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.userId, authResult.userId)))
      .returning({ id: accounts.id });
    if (!deleted) {
      return { success: false, error: "Account not found" };
    }
    revalidatePath("/accounts");
    revalidatePath("/dashboard");
    return { success: true, data: undefined };
  } catch (error) {
    logger.error("Failed to delete account", "deleteAccount", error);
    return { success: false, error: "Failed to delete account" };
  }
}
