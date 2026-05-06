"use server";

import { db } from "@/lib/db";
import { expenses, categories, accounts } from "@/lib/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { ApiResponse, Expense, ExpenseWithDetails, NewExpense } from "@/types/database";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/lib/auth/require-auth";
import { defaultCurrency } from "@/lib/currency";

export async function getExpenses(filters?: {
  accountId?: string;
  categoryId?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<ApiResponse<ExpenseWithDetails[]>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }
    const { userId } = authResult;

    const conditions = [eq(expenses.userId, userId)];

    if (filters?.accountId) {
      conditions.push(eq(expenses.accountId, filters.accountId));
    }
    if (filters?.categoryId) {
      conditions.push(eq(expenses.categoryId, filters.categoryId));
    }
    if (filters?.startDate) {
      conditions.push(gte(expenses.startDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(expenses.startDate, filters.endDate));
    }

    const result = await db
      .select({
        expense: expenses,
        category: categories,
        account: accounts,
      })
      .from(expenses)
      .leftJoin(categories, eq(expenses.categoryId, categories.id))
      .leftJoin(accounts, eq(expenses.accountId, accounts.id))
      .where(and(...conditions))
      .orderBy(desc(expenses.createdAt));

    const expensesWithDetails: ExpenseWithDetails[] = result.map((r) => ({
      ...r.expense,
      category: r.category,
      account: r.account,
    }));

    return { success: true, data: expensesWithDetails };
  } catch (error) {
    logger.error("Failed to fetch expenses", "getExpenses", error);
    return { success: false, error: "Ausgaben konnten nicht geladen werden." };
  }
}

export async function getExpenseById(id: string): Promise<ApiResponse<ExpenseWithDetails>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }
    const { userId } = authResult;

    const [result] = await db
      .select({
        expense: expenses,
        category: categories,
        account: accounts,
      })
      .from(expenses)
      .leftJoin(categories, eq(expenses.categoryId, categories.id))
      .leftJoin(accounts, eq(expenses.accountId, accounts.id))
      .where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
      .limit(1);

    if (!result) {
      return { success: false, error: "Ausgabe nicht gefunden." };
    }

    return {
      success: true,
      data: {
        ...result.expense,
        category: result.category,
        account: result.account,
      },
    };
  } catch (error) {
    logger.error("Failed to fetch expense", "getExpenseById", error);
    return { success: false, error: "Ausgabe konnte nicht geladen werden." };
  }
}

export async function createExpense(data: {
  accountId: string;
  categoryId?: string | null;
  name: string;
  amount: number;
  recurrenceType: "once" | "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "custom";
  recurrenceInterval?: number | null;
  startDate: Date | string;
  endDate?: Date | string | null;
  currency?: string;
  originalAmount?: number | null;
  exchangeRate?: number | null;
}): Promise<ApiResponse<Expense>> {
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

    const [newExpense] = await db
      .insert(expenses)
      .values({
        userId,
        accountId: data.accountId,
        categoryId: data.categoryId ?? null,
        name: data.name,
        amount: data.amount.toString(),
        recurrenceType: data.recurrenceType,
        recurrenceInterval: data.recurrenceInterval ?? null,
        startDate: typeof data.startDate === "string" ? new Date(data.startDate) : data.startDate,
        endDate: data.endDate
          ? typeof data.endDate === "string"
            ? new Date(data.endDate)
            : data.endDate
          : null,
        currency,
        originalAmount: data.originalAmount != null ? data.originalAmount.toString() : null,
        exchangeRate: data.exchangeRate != null ? data.exchangeRate.toString() : null,
      })
      .returning();

    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    return { success: true, data: newExpense };
  } catch (error) {
    logger.error("Failed to create expense", "createExpense", error);
    return { success: false, error: "Ausgabe konnte nicht erstellt werden." };
  }
}

export async function updateExpense(
  id: string,
  data: Partial<Omit<NewExpense, "id" | "createdAt">>
): Promise<ApiResponse<Expense>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }
    const { userId } = authResult;

    const updateData = { ...data };
    if (data.startDate && typeof data.startDate === "string") {
      updateData.startDate = new Date(data.startDate);
    }
    if (data.endDate && typeof data.endDate === "string") {
      updateData.endDate = new Date(data.endDate);
    }

    const [updatedExpense] = await db
      .update(expenses)
      .set(updateData)
      .where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
      .returning();

    if (!updatedExpense) {
      return { success: false, error: "Ausgabe nicht gefunden." };
    }

    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    return { success: true, data: updatedExpense };
  } catch (error) {
    logger.error("Failed to update expense", "updateExpense", error);
    return { success: false, error: "Ausgabe konnte nicht aktualisiert werden." };
  }
}

export async function deleteExpense(id: string): Promise<ApiResponse<void>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }
    const { userId } = authResult;

    const [deletedExpense] = await db
      .delete(expenses)
      .where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
      .returning();

    if (!deletedExpense) {
      return { success: false, error: "Ausgabe nicht gefunden." };
    }

    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    return { success: true, data: undefined };
  } catch (error) {
    logger.error("Failed to delete expense", "deleteExpense", error);
    return { success: false, error: "Ausgabe konnte nicht gelöscht werden." };
  }
}
