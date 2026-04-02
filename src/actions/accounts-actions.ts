"use server";

import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { ApiResponse, Account, NewAccount } from "@/types/database";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/lib/auth/require-auth";
import { defaultCurrency } from "@/lib/currency";

export async function getAccounts(): Promise<ApiResponse<Account[]>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return { success: false, error: "Unauthorized" };

    const allAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, authResult.userId))
      .orderBy(desc(accounts.createdAt));

    return { success: true, data: allAccounts };
  } catch (error) {
    logger.error("Failed to fetch accounts", "getAccounts", error);
    return { success: false, error: "Konten konnten nicht geladen werden." };
  }
}

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

export async function createAccount(data: {
  name: string;
  type: "checking" | "savings" | "etf";
  initialBalance?: number;
  currency?: string;
}): Promise<ApiResponse<Account>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return { success: false, error: "Unauthorized" };

    const [newAccount] = await db
      .insert(accounts)
      .values({
        userId: authResult.userId,
        name: data.name,
        type: data.type,
        balance: data.initialBalance?.toString() ?? "0",
        currency: data.currency ?? defaultCurrency,
      })
      .returning();

    revalidatePath("/accounts");
    revalidatePath("/dashboard");
    return { success: true, data: newAccount };
  } catch (error) {
    logger.error("Failed to create account", "createAccount", error);
    return { success: false, error: "Konto konnte nicht erstellt werden." };
  }
}

export async function updateAccount(
  id: string,
  data: Partial<Omit<NewAccount, "id" | "createdAt">>
): Promise<ApiResponse<Account>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return { success: false, error: "Unauthorized" };

    const [updatedAccount] = await db
      .update(accounts)
      .set(data)
      .where(and(eq(accounts.id, id), eq(accounts.userId, authResult.userId)))
      .returning();

    if (!updatedAccount) {
      return { success: false, error: "Konto nicht gefunden." };
    }

    revalidatePath("/accounts");
    revalidatePath("/dashboard");
    return { success: true, data: updatedAccount };
  } catch (error) {
    logger.error("Failed to update account", "updateAccount", error);
    return { success: false, error: "Konto konnte nicht aktualisiert werden." };
  }
}

export async function deleteAccount(id: string): Promise<ApiResponse<void>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return { success: false, error: "Unauthorized" };

    const [deletedAccount] = await db
      .delete(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.userId, authResult.userId)))
      .returning();

    if (!deletedAccount) {
      return { success: false, error: "Konto nicht gefunden." };
    }

    revalidatePath("/accounts");
    revalidatePath("/dashboard");
    return { success: true, data: undefined };
  } catch (error) {
    logger.error("Failed to delete account", "deleteAccount", error);
    return { success: false, error: "Konto konnte nicht gelöscht werden." };
  }
}
