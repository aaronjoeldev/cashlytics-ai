"use server";

import { db } from "@/lib/db";
import { dailyExpenses, categories, accounts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { ApiResponse, DailyExpense, NewDailyExpense } from "@/types/database";
import { logger } from "@/lib/logger";
import { ownsAccount, ownsCategory, pickFields } from "@/lib/auth/ownership";
import { requireAuth } from "@/lib/auth/require-auth";
import { defaultCurrency } from "@/lib/currency";

export async function createDailyExpense(data: {
  accountId: string;
  categoryId?: string | null;
  description: string;
  amount: number;
  date: Date | string;
  currency?: string;
  originalAmount?: number | null;
  exchangeRate?: number | null;
}): Promise<ApiResponse<DailyExpense>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }
    const { userId } = authResult;

    // FK Validation: accountId must belong to authenticated user (DATA-10)
    const [ownedAccount] = await db
      .select({ id: accounts.id, currency: accounts.currency })
      .from(accounts)
      .where(and(eq(accounts.id, data.accountId), eq(accounts.userId, userId)))
      .limit(1);
    if (!ownedAccount) {
      return { success: false, error: "Konto nicht gefunden oder kein Zugriff." };
    }

    // FK Validation: categoryId must belong to authenticated user (DATA-10)
    if (data.categoryId) {
      const [ownedCategory] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.id, data.categoryId), eq(categories.userId, userId)))
        .limit(1);
      if (!ownedCategory) {
        return { success: false, error: "Kategorie nicht gefunden oder kein Zugriff." };
      }
    }

    const currency = data.currency ?? defaultCurrency;

    // TODO (Phase 2): If currency !== ownedAccount.currency, call getExchangeRate(currency, ownedAccount.currency)
    // to auto-populate exchangeRate for currency conversion at booking time.

    const [newDailyExpense] = await db
      .insert(dailyExpenses)
      .values({
        userId,
        accountId: data.accountId,
        categoryId: data.categoryId ?? null,
        description: data.description,
        amount: data.amount.toString(),
        date: typeof data.date === "string" ? new Date(data.date) : data.date,
        currency,
        originalAmount: data.originalAmount != null ? data.originalAmount.toString() : null,
        exchangeRate: data.exchangeRate != null ? data.exchangeRate.toString() : null,
      })
      .returning();

    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    return { success: true, data: newDailyExpense };
  } catch (error) {
    logger.error("Failed to create daily expense", "createDailyExpense", error);
    return { success: false, error: "Tägliche Ausgabe konnte nicht erstellt werden." };
  }
}

export async function updateDailyExpense(
  id: string,
  data: Partial<Omit<NewDailyExpense, "id" | "createdAt">>
): Promise<ApiResponse<DailyExpense>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }
    const { userId } = authResult;

    const updates = pickFields(data, [
      "accountId",
      "categoryId",
      "description",
      "amount",
      "date",
      "currency",
      "originalAmount",
      "exchangeRate",
      "info",
    ]);
    if (updates.date && typeof updates.date === "string") {
      updates.date = new Date(updates.date);
    }
    if (updates.accountId && !(await ownsAccount(userId, updates.accountId))) {
      return { success: false, error: "Konto nicht gefunden oder kein Zugriff." };
    }
    if (updates.categoryId && !(await ownsCategory(userId, updates.categoryId))) {
      return { success: false, error: "Kategorie nicht gefunden oder kein Zugriff." };
    }

    const [updatedDailyExpense] = await db
      .update(dailyExpenses)
      .set(updates)
      .where(and(eq(dailyExpenses.id, id), eq(dailyExpenses.userId, userId)))
      .returning();

    if (!updatedDailyExpense) {
      return { success: false, error: "Tägliche Ausgabe nicht gefunden." };
    }

    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    return { success: true, data: updatedDailyExpense };
  } catch (error) {
    logger.error("Failed to update daily expense", "updateDailyExpense", error);
    return { success: false, error: "Tägliche Ausgabe konnte nicht aktualisiert werden." };
  }
}
