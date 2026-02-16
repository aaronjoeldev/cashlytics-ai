'use server';

import { db } from '@/lib/db';
import { expenses, categories, accounts } from '@/lib/db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { ApiResponse, Expense, ExpenseWithDetails, NewExpense } from '@/types/database';

export async function getExpenses(filters?: {
  accountId?: string;
  categoryId?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<ApiResponse<ExpenseWithDetails[]>> {
  try {
    const conditions = [];

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
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(expenses.createdAt));

    const expensesWithDetails: ExpenseWithDetails[] = result.map((r) => ({
      ...r.expense,
      category: r.category,
      account: r.account,
    }));

    return { success: true, data: expensesWithDetails };
  } catch (error) {
    console.error('Failed to fetch expenses:', error);
    return { success: false, error: 'Ausgaben konnten nicht geladen werden.' };
  }
}

export async function getExpenseById(id: string): Promise<ApiResponse<ExpenseWithDetails>> {
  try {
    const [result] = await db
      .select({
        expense: expenses,
        category: categories,
        account: accounts,
      })
      .from(expenses)
      .leftJoin(categories, eq(expenses.categoryId, categories.id))
      .leftJoin(accounts, eq(expenses.accountId, accounts.id))
      .where(eq(expenses.id, id))
      .limit(1);

    if (!result) {
      return { success: false, error: 'Ausgabe nicht gefunden.' };
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
    console.error('Failed to fetch expense:', error);
    return { success: false, error: 'Ausgabe konnte nicht geladen werden.' };
  }
}

export async function createExpense(data: {
  accountId: string;
  categoryId?: string | null;
  name: string;
  amount: number;
  recurrenceType: 'once' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
  recurrenceInterval?: number | null;
  startDate: Date | string;
  endDate?: Date | string | null;
}): Promise<ApiResponse<Expense>> {
  try {
    const [newExpense] = await db
      .insert(expenses)
      .values({
        accountId: data.accountId,
        categoryId: data.categoryId ?? null,
        name: data.name,
        amount: data.amount.toString(),
        recurrenceType: data.recurrenceType,
        recurrenceInterval: data.recurrenceInterval ?? null,
        startDate: typeof data.startDate === 'string' ? new Date(data.startDate) : data.startDate,
        endDate: data.endDate ? (typeof data.endDate === 'string' ? new Date(data.endDate) : data.endDate) : null,
      })
      .returning();

    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    return { success: true, data: newExpense };
  } catch (error) {
    console.error('Failed to create expense:', error);
    return { success: false, error: 'Ausgabe konnte nicht erstellt werden.' };
  }
}

export async function updateExpense(
  id: string,
  data: Partial<Omit<NewExpense, 'id' | 'createdAt'>>
): Promise<ApiResponse<Expense>> {
  try {
    const updateData = { ...data };
    if (data.startDate && typeof data.startDate === 'string') {
      updateData.startDate = new Date(data.startDate);
    }
    if (data.endDate && typeof data.endDate === 'string') {
      updateData.endDate = new Date(data.endDate);
    }

    const [updatedExpense] = await db
      .update(expenses)
      .set(updateData)
      .where(eq(expenses.id, id))
      .returning();

    if (!updatedExpense) {
      return { success: false, error: 'Ausgabe nicht gefunden.' };
    }

    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    return { success: true, data: updatedExpense };
  } catch (error) {
    console.error('Failed to update expense:', error);
    return { success: false, error: 'Ausgabe konnte nicht aktualisiert werden.' };
  }
}

export async function deleteExpense(id: string): Promise<ApiResponse<void>> {
  try {
    const [deletedExpense] = await db
      .delete(expenses)
      .where(eq(expenses.id, id))
      .returning();

    if (!deletedExpense) {
      return { success: false, error: 'Ausgabe nicht gefunden.' };
    }

    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    return { success: true, data: undefined };
  } catch (error) {
    console.error('Failed to delete expense:', error);
    return { success: false, error: 'Ausgabe konnte nicht gelöscht werden.' };
  }
}
