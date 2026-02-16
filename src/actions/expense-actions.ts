'use server';

import { db } from '@/lib/db';
import { expenses, dailyExpenses, accounts } from '@/lib/db/schema';
import { eq, and, gte, lte, desc, sql, ilike } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { ApiResponse, Expense, NewExpense, DailyExpense, NewDailyExpense, ExpenseWithDetails, DailyExpenseWithDetails } from '@/types/database';

export async function getExpenses(filters?: {
  accountId?: string;
  categoryId?: string;
  name?: string;
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
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        account: true,
        category: true,
      },
      orderBy: [desc(expenses.startDate)],
    });

    return { success: true, data: result as ExpenseWithDetails[] };
  } catch (error) {
    console.error('Failed to fetch expenses:', error);
    return { success: false, error: 'Periodische Ausgaben konnten nicht geladen werden.' };
  }
}

export async function createExpense(data: NewExpense): Promise<ApiResponse<Expense>> {
  try {
    const [expense] = await db.insert(expenses).values(data).returning();
    
    // Kontostand aktualisieren (abziehen) mit SQL
    if (data.accountId) {
      await db
        .update(accounts)
        .set({
          balance: sql`${accounts.balance} - ${data.amount}`,
        })
        .where(eq(accounts.id, data.accountId));
    }
    
    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    revalidatePath('/accounts');
    return { success: true, data: expense };
  } catch (error) {
    console.error('Failed to create expense:', error);
    return { success: false, error: 'Failed to create expense' };
  }
}

export async function updateExpense(
  id: string,
  data: Partial<NewExpense>
): Promise<ApiResponse<Expense>> {
  try {
    const [expense] = await db.update(expenses).set(data).where(eq(expenses.id, id)).returning();
    if (!expense) {
      return { success: false, error: 'Expense not found' };
    }
    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    return { success: true, data: expense };
  } catch (error) {
    console.error('Failed to update expense:', error);
    return { success: false, error: 'Failed to update expense' };
  }
}

export async function deleteExpense(id: string): Promise<ApiResponse<void>> {
  try {
    // Erst die Expense holen um den Betrag und Account zu kennen
    const [expense] = await db.select().from(expenses).where(eq(expenses.id, id));
    if (expense && expense.accountId) {
      // Kontostand aktualisieren (zurückbuchen)
      await db
        .update(accounts)
        .set({
          balance: sql`${accounts.balance} + ${expense.amount}`,
        })
        .where(eq(accounts.id, expense.accountId));
    }
    
    await db.delete(expenses).where(eq(expenses.id, id));
    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    revalidatePath('/accounts');
    return { success: true, data: undefined };
  } catch (error) {
    console.error('Failed to delete expense:', error);
    return { success: false, error: 'Failed to delete expense' };
  }
}

export async function getDailyExpenses(filters?: {
  accountId?: string;
  categoryId?: string;
  description?: string;
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
    if (filters?.description) {
      conditions.push(ilike(dailyExpenses.description, `%${filters.description}%`));
    }
    if (filters?.startDate) {
      conditions.push(gte(dailyExpenses.date, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(dailyExpenses.date, filters.endDate));
    }

    const result = await db.query.dailyExpenses.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        account: true,
        category: true,
      },
      orderBy: [desc(dailyExpenses.date)],
    });

    return { success: true, data: result as DailyExpenseWithDetails[] };
  } catch (error) {
    console.error('Failed to fetch daily expenses:', error);
    return { success: false, error: 'Tagesausgaben konnten nicht geladen werden.' };
  }
}

export async function createDailyExpense(data: NewDailyExpense): Promise<ApiResponse<DailyExpense>> {
  try {
    const [expense] = await db.insert(dailyExpenses).values(data).returning();
    
    // Kontostand aktualisieren (abziehen)
    if (data.accountId) {
      await db
        .update(accounts)
        .set({
          balance: sql`${accounts.balance} - ${data.amount}`,
        })
        .where(eq(accounts.id, data.accountId));
    }
    
    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    revalidatePath('/accounts');
    return { success: true, data: expense };
  } catch (error) {
    console.error('Failed to create daily expense:', error);
    return { success: false, error: 'Failed to create daily expense' };
  }
}

export async function updateDailyExpense(
  id: string,
  data: Partial<NewDailyExpense>
): Promise<ApiResponse<DailyExpense>> {
  try {
    const [expense] = await db.update(dailyExpenses).set(data).where(eq(dailyExpenses.id, id)).returning();
    if (!expense) {
      return { success: false, error: 'Daily expense not found' };
    }
    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    return { success: true, data: expense };
  } catch (error) {
    console.error('Failed to update daily expense:', error);
    return { success: false, error: 'Failed to update daily expense' };
  }
}

export async function deleteDailyExpense(id: string): Promise<ApiResponse<void>> {
  try {
    const [expense] = await db.select().from(dailyExpenses).where(eq(dailyExpenses.id, id));
    if (expense && expense.accountId) {
      await db
        .update(accounts)
        .set({
          balance: sql`${accounts.balance} + ${expense.amount}`,
        })
        .where(eq(accounts.id, expense.accountId));
    }
    
    await db.delete(dailyExpenses).where(eq(dailyExpenses.id, id));
    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    revalidatePath('/accounts');
    return { success: true, data: undefined };
  } catch (error) {
    console.error('Failed to delete daily expense:', error);
    return { success: false, error: 'Failed to delete daily expense' };
  }
}