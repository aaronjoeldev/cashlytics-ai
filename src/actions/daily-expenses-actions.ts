"use server";

import { db } from "@/lib/db";
import { dailyExpenses, categories, accounts } from "@/lib/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type {
  ApiResponse,
  DailyExpense,
  DailyExpenseWithDetails,
  NewDailyExpense,
} from "@/types/database";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/lib/auth/require-auth";
import { defaultCurrency } from "@/lib/currency";

export async function getDailyExpenses(filters?: {
  accountId?: string;
  categoryId?: string;
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
}): Promise<ApiResponse<DailyExpenseWithDetails[]>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }
    const { userId } = authResult;

    const conditions = [eq(dailyExpenses.userId, userId)];

    if (filters?.accountId) {
      conditions.push(eq(dailyExpenses.accountId, filters.accountId));
    }
    if (filters?.categoryId) {
      conditions.push(eq(dailyExpenses.categoryId, filters.categoryId));
    }
    if (filters?.startDate) {
      conditions.push(gte(dailyExpenses.date, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(dailyExpenses.date, filters.endDate));
    }
    if (filters?.minAmount !== undefined) {
      conditions.push(gte(dailyExpenses.amount, filters.minAmount.toString()));
    }
    if (filters?.maxAmount !== undefined) {
      conditions.push(lte(dailyExpenses.amount, filters.maxAmount.toString()));
    }

    const result = await db
      .select({
        dailyExpense: dailyExpenses,
        category: categories,
        account: accounts,
      })
      .from(dailyExpenses)
      .leftJoin(categories, eq(dailyExpenses.categoryId, categories.id))
      .leftJoin(accounts, eq(dailyExpenses.accountId, accounts.id))
      .where(and(...conditions))
      .orderBy(desc(dailyExpenses.date));

    const dailyExpensesWithDetails: DailyExpenseWithDetails[] = result.map((r) => ({
      ...r.dailyExpense,
      category: r.category,
      account: r.account,
    }));

    return { success: true, data: dailyExpensesWithDetails };
  } catch (error) {
    logger.error("Failed to fetch daily expenses", "getDailyExpenses", error);
    return { success: false, error: "Tägliche Ausgaben konnten nicht geladen werden." };
  }
}

export async function getDailyExpenseById(
  id: string
): Promise<ApiResponse<DailyExpenseWithDetails>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }
    const { userId } = authResult;

    const [result] = await db
      .select({
        dailyExpense: dailyExpenses,
        category: categories,
        account: accounts,
      })
      .from(dailyExpenses)
      .leftJoin(categories, eq(dailyExpenses.categoryId, categories.id))
      .leftJoin(accounts, eq(dailyExpenses.accountId, accounts.id))
      .where(and(eq(dailyExpenses.id, id), eq(dailyExpenses.userId, userId)))
      .limit(1);

    if (!result) {
      return { success: false, error: "Tägliche Ausgabe nicht gefunden." };
    }

    return {
      success: true,
      data: {
        ...result.dailyExpense,
        category: result.category,
        account: result.account,
      },
    };
  } catch (error) {
    logger.error("Failed to fetch daily expense", "getDailyExpenseById", error);
    return { success: false, error: "Tägliche Ausgabe konnte nicht geladen werden." };
  }
}

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

    const updateData = { ...data };
    if (data.date && typeof data.date === "string") {
      updateData.date = new Date(data.date);
    }

    const [updatedDailyExpense] = await db
      .update(dailyExpenses)
      .set(updateData)
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

export async function deleteDailyExpense(id: string): Promise<ApiResponse<void>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }
    const { userId } = authResult;

    const [deletedDailyExpense] = await db
      .delete(dailyExpenses)
      .where(and(eq(dailyExpenses.id, id), eq(dailyExpenses.userId, userId)))
      .returning();

    if (!deletedDailyExpense) {
      return { success: false, error: "Tägliche Ausgabe nicht gefunden." };
    }

    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    return { success: true, data: undefined };
  } catch (error) {
    logger.error("Failed to delete daily expense", "deleteDailyExpense", error);
    return { success: false, error: "Tägliche Ausgabe konnte nicht gelöscht werden." };
  }
}
