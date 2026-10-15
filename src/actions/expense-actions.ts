"use server";

import { db } from "@/lib/db";
import { expenses, dailyExpenses, accounts, categories } from "@/lib/db/schema";
import { eq, and, gte, lte, desc, ilike } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type {
  ApiResponse,
  Expense,
  NewExpense,
  DailyExpense,
  NewDailyExpense,
  ExpenseWithDetails,
  DailyExpenseWithDetails,
} from "@/types/database";
import { logger } from "@/lib/logger";
import { ownsAccount, ownsCategory } from "@/lib/auth/ownership";
import { requireAuth } from "@/lib/auth/require-auth";
import {
  changesDateRange,
  checkUpdatedRange,
  createDailyExpenseInput,
  createExpenseInput,
  parseInput,
  updateDailyExpenseInput,
  updateExpenseInput,
} from "@/lib/validations/action-input";

export async function getExpenses(filters?: {
  accountId?: string;
  categoryId?: string;
  name?: string;
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
    if (filters?.name) {
      conditions.push(ilike(expenses.name, `%${filters.name}%`));
    }
    if (filters?.startDate) {
      conditions.push(gte(expenses.startDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(expenses.startDate, filters.endDate));
    }

    const result = await db.query.expenses.findMany({
      where: and(...conditions),
      with: {
        account: true,
        category: true,
      },
      orderBy: [desc(expenses.startDate)],
    });

    return { success: true, data: result as ExpenseWithDetails[] };
  } catch (error) {
    logger.error("Failed to fetch expenses", "getExpenses", error);
    return { success: false, error: "Periodische Ausgaben konnten nicht geladen werden." };
  }
}

export async function createExpense(
  rawData: Omit<NewExpense, "userId">
): Promise<ApiResponse<Expense>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }
    const { userId } = authResult;

    const input = parseInput(createExpenseInput, rawData);
    if (!input.success) return input;
    const data = input.data;

    // FK Validation: accountId must belong to authenticated user (DATA-10)
    let accountCurrency: string | undefined;
    if (data.accountId) {
      const [ownedAccount] = await db
        .select({ id: accounts.id, currency: accounts.currency })
        .from(accounts)
        .where(and(eq(accounts.id, data.accountId), eq(accounts.userId, userId)))
        .limit(1);
      if (!ownedAccount) {
        return { success: false, error: "Konto nicht gefunden oder kein Zugriff." };
      }
      accountCurrency = ownedAccount.currency;
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

    const [expense] = await db
      .insert(expenses)
      .values({ ...data, currency: data.currency ?? accountCurrency, userId })
      .returning();

    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    revalidatePath("/accounts");
    return { success: true, data: expense };
  } catch (error) {
    logger.error("Failed to create expense", "createExpense", error);
    return { success: false, error: "Ausgabe konnte nicht erstellt werden." };
  }
}

export async function updateExpense(
  id: string,
  data: Partial<NewExpense>
): Promise<ApiResponse<Expense>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }
    const { userId } = authResult;

    const input = parseInput(updateExpenseInput, data);
    if (!input.success) return input;
    const updates = input.data;
    if (Object.keys(updates).length === 0) {
      return { success: false, error: "Keine Änderungen übergeben." };
    }
    if (updates.accountId && !(await ownsAccount(userId, updates.accountId))) {
      return { success: false, error: "Konto nicht gefunden oder kein Zugriff." };
    }
    if (updates.categoryId && !(await ownsCategory(userId, updates.categoryId))) {
      return { success: false, error: "Kategorie nicht gefunden oder kein Zugriff." };
    }

    if (changesDateRange(updates)) {
      const [stored] = await db
        .select({ startDate: expenses.startDate, endDate: expenses.endDate })
        .from(expenses)
        .where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
        .limit(1);
      if (!stored) {
        return { success: false, error: "Ausgabe nicht gefunden." };
      }
      const rangeError = checkUpdatedRange(updates, stored);
      if (rangeError) return { success: false, error: rangeError };
    }

    const [expense] = await db
      .update(expenses)
      .set(updates)
      .where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
      .returning();
    if (!expense) {
      return { success: false, error: "Ausgabe nicht gefunden." };
    }
    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    return { success: true, data: expense };
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

    const [deleted] = await db
      .delete(expenses)
      .where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
      .returning({ id: expenses.id });
    if (!deleted) {
      return { success: false, error: "Expense not found" };
    }
    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    revalidatePath("/accounts");
    return { success: true, data: undefined };
  } catch (error) {
    logger.error("Failed to delete expense", "deleteExpense", error);
    return { success: false, error: "Ausgabe konnte nicht gelöscht werden." };
  }
}

export async function getDailyExpenses(filters?: {
  accountId?: string;
  categoryId?: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  /** Amounts in the entry's own currency */
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
    if (filters?.description) {
      conditions.push(ilike(dailyExpenses.description, `%${filters.description}%`));
    }
    if (filters?.startDate) {
      conditions.push(gte(dailyExpenses.date, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(dailyExpenses.date, filters.endDate));
    }
    if (filters?.minAmount !== undefined && Number.isFinite(filters.minAmount)) {
      conditions.push(gte(dailyExpenses.amount, filters.minAmount.toFixed(2)));
    }
    if (filters?.maxAmount !== undefined && Number.isFinite(filters.maxAmount)) {
      conditions.push(lte(dailyExpenses.amount, filters.maxAmount.toFixed(2)));
    }

    const result = await db.query.dailyExpenses.findMany({
      where: and(...conditions),
      with: {
        account: true,
        category: true,
      },
      orderBy: [desc(dailyExpenses.date)],
    });

    return { success: true, data: result as DailyExpenseWithDetails[] };
  } catch (error) {
    logger.error("Failed to fetch daily expenses", "getDailyExpenses", error);
    return { success: false, error: "Tagesausgaben konnten nicht geladen werden." };
  }
}

export async function createDailyExpense(
  rawData: Omit<NewDailyExpense, "userId">
): Promise<ApiResponse<DailyExpense>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }
    const { userId } = authResult;

    const input = parseInput(createDailyExpenseInput, rawData);
    if (!input.success) return input;
    const data = input.data;

    // FK Validation: accountId must belong to authenticated user (DATA-10)
    let accountCurrency: string | undefined;
    if (data.accountId) {
      const [ownedAccount] = await db
        .select({ id: accounts.id, currency: accounts.currency })
        .from(accounts)
        .where(and(eq(accounts.id, data.accountId), eq(accounts.userId, userId)))
        .limit(1);
      if (!ownedAccount) {
        return { success: false, error: "Konto nicht gefunden oder kein Zugriff." };
      }
      accountCurrency = ownedAccount.currency;
    }

    if (data.categoryId && !(await ownsCategory(userId, data.categoryId))) {
      return { success: false, error: "Kategorie nicht gefunden oder kein Zugriff." };
    }

    const [expense] = await db
      .insert(dailyExpenses)
      .values({ ...data, currency: data.currency ?? accountCurrency, userId })
      .returning();

    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    revalidatePath("/accounts");
    return { success: true, data: expense };
  } catch (error) {
    logger.error("Failed to create daily expense", "createDailyExpense", error);
    return { success: false, error: "Tägliche Ausgabe konnte nicht erstellt werden." };
  }
}

export async function updateDailyExpense(
  id: string,
  data: Partial<NewDailyExpense>
): Promise<ApiResponse<DailyExpense>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }
    const { userId } = authResult;

    const input = parseInput(updateDailyExpenseInput, data);
    if (!input.success) return input;
    const updates = input.data;
    if (Object.keys(updates).length === 0) {
      return { success: false, error: "Keine Änderungen übergeben." };
    }
    if (updates.accountId && !(await ownsAccount(userId, updates.accountId))) {
      return { success: false, error: "Konto nicht gefunden oder kein Zugriff." };
    }
    if (updates.categoryId && !(await ownsCategory(userId, updates.categoryId))) {
      return { success: false, error: "Kategorie nicht gefunden oder kein Zugriff." };
    }

    const [expense] = await db
      .update(dailyExpenses)
      .set(updates)
      .where(and(eq(dailyExpenses.id, id), eq(dailyExpenses.userId, userId)))
      .returning();
    if (!expense) {
      return { success: false, error: "Tägliche Ausgabe nicht gefunden." };
    }
    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    return { success: true, data: expense };
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

    const [deleted] = await db
      .delete(dailyExpenses)
      .where(and(eq(dailyExpenses.id, id), eq(dailyExpenses.userId, userId)))
      .returning({ id: dailyExpenses.id });
    if (!deleted) {
      return { success: false, error: "Daily expense not found" };
    }
    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    revalidatePath("/accounts");
    return { success: true, data: undefined };
  } catch (error) {
    logger.error("Failed to delete daily expense", "deleteDailyExpense", error);
    return { success: false, error: "Tägliche Ausgabe konnte nicht gelöscht werden." };
  }
}
