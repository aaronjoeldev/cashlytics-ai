'use server';

import { db } from '@/lib/db';
import { dailyExpenses, categories, accounts } from '@/lib/db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { ApiResponse, DailyExpense, DailyExpenseWithDetails, NewDailyExpense } from '@/types/database';

export async function getDailyExpenses(filters?: {
  accountId?: string;
  categoryId?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<ApiResponse<DailyExpenseWithDetails[]>> {
  try {
    const conditions = [];

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

    const result = await db
      .select({
        dailyExpense: dailyExpenses,
        category: categories,
        account: accounts,
      })
      .from(dailyExpenses)
      .leftJoin(categories, eq(dailyExpenses.categoryId, categories.id))
      .leftJoin(accounts, eq(dailyExpenses.accountId, accounts.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(dailyExpenses.date));

    const dailyExpensesWithDetails: DailyExpenseWithDetails[] = result.map((r) => ({
      ...r.dailyExpense,
      category: r.category,
      account: r.account,
    }));

    return { success: true, data: dailyExpensesWithDetails };
  } catch (error) {
    console.error('Failed to fetch daily expenses:', error);
    return { success: false, error: 'Tägliche Ausgaben konnten nicht geladen werden.' };
  }
}

export async function getDailyExpenseById(id: string): Promise<ApiResponse<DailyExpenseWithDetails>> {
  try {
    const [result] = await db
      .select({
        dailyExpense: dailyExpenses,
        category: categories,
        account: accounts,
      })
      .from(dailyExpenses)
      .leftJoin(categories, eq(dailyExpenses.categoryId, categories.id))
      .leftJoin(accounts, eq(dailyExpenses.accountId, accounts.id))
      .where(eq(dailyExpenses.id, id))
      .limit(1);

    if (!result) {
      return { success: false, error: 'Tägliche Ausgabe nicht gefunden.' };
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
    console.error('Failed to fetch daily expense:', error);
    return { success: false, error: 'Tägliche Ausgabe konnte nicht geladen werden.' };
  }
}

export async function createDailyExpense(data: {
  accountId: string;
  categoryId?: string | null;
  description: string;
  amount: number;
  date: Date | string;
}): Promise<ApiResponse<DailyExpense>> {
  try {
    const [newDailyExpense] = await db
      .insert(dailyExpenses)
      .values({
        accountId: data.accountId,
        categoryId: data.categoryId ?? null,
        description: data.description,
        amount: data.amount.toString(),
        date: typeof data.date === 'string' ? new Date(data.date) : data.date,
      })
      .returning();

    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    return { success: true, data: newDailyExpense };
  } catch (error) {
    console.error('Failed to create daily expense:', error);
    return { success: false, error: 'Tägliche Ausgabe konnte nicht erstellt werden.' };
  }
}

export async function updateDailyExpense(
  id: string,
  data: Partial<Omit<NewDailyExpense, 'id' | 'createdAt'>>
): Promise<ApiResponse<DailyExpense>> {
  try {
    const updateData = { ...data };
    if (data.date && typeof data.date === 'string') {
      updateData.date = new Date(data.date);
    }

    const [updatedDailyExpense] = await db
      .update(dailyExpenses)
      .set(updateData)
      .where(eq(dailyExpenses.id, id))
      .returning();

    if (!updatedDailyExpense) {
      return { success: false, error: 'Tägliche Ausgabe nicht gefunden.' };
    }

    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    return { success: true, data: updatedDailyExpense };
  } catch (error) {
    console.error('Failed to update daily expense:', error);
    return { success: false, error: 'Tägliche Ausgabe konnte nicht aktualisiert werden.' };
  }
}

export async function deleteDailyExpense(id: string): Promise<ApiResponse<void>> {
  try {
    const [deletedDailyExpense] = await db
      .delete(dailyExpenses)
      .where(eq(dailyExpenses.id, id))
      .returning();

    if (!deletedDailyExpense) {
      return { success: false, error: 'Tägliche Ausgabe nicht gefunden.' };
    }

    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    return { success: true, data: undefined };
  } catch (error) {
    console.error('Failed to delete daily expense:', error);
    return { success: false, error: 'Tägliche Ausgabe konnte nicht gelöscht werden.' };
  }
}
