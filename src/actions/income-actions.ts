'use server';

import { db } from '@/lib/db';
import { incomes, accounts } from '@/lib/db/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { ApiResponse, Income, NewIncome, IncomeWithAccount } from '@/types/database';

export async function getIncomes(filters?: {
  accountId?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<ApiResponse<IncomeWithAccount[]>> {
  try {
    const conditions = [];
    if (filters?.accountId) {
      conditions.push(eq(incomes.accountId, filters.accountId));
    }
    if (filters?.startDate) {
      conditions.push(gte(incomes.startDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(incomes.startDate, filters.endDate));
    }

    const result = await db
      .select({
        income: incomes,
        account: accounts,
      })
      .from(incomes)
      .leftJoin(accounts, eq(incomes.accountId, accounts.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(incomes.startDate));

    const incomesWithAccount: IncomeWithAccount[] = result.map((r) => ({
      ...r.income,
      account: r.account,
    }));

    return { success: true, data: incomesWithAccount };
  } catch (error) {
    console.error('Failed to fetch incomes:', error);
    return { success: false, error: 'Failed to fetch incomes' };
  }
}

export async function createIncome(data: NewIncome): Promise<ApiResponse<Income>> {
  try {
    const [income] = await db.insert(incomes).values(data).returning();
    
    // Kontostand aktualisieren (hinzufügen)
    if (data.accountId) {
      await db
        .update(accounts)
        .set({
          balance: sql`${accounts.balance} + ${data.amount}`,
        })
        .where(eq(accounts.id, data.accountId));
    }
    
    revalidatePath('/income');
    revalidatePath('/dashboard');
    revalidatePath('/accounts');
    return { success: true, data: income };
  } catch (error) {
    console.error('Failed to create income:', error);
    return { success: false, error: 'Failed to create income' };
  }
}

export async function updateIncome(
  id: string,
  data: Partial<NewIncome>
): Promise<ApiResponse<Income>> {
  try {
    const [income] = await db.update(incomes).set(data).where(eq(incomes.id, id)).returning();
    if (!income) {
      return { success: false, error: 'Income not found' };
    }
    revalidatePath('/income');
    revalidatePath('/dashboard');
    return { success: true, data: income };
  } catch (error) {
    console.error('Failed to update income:', error);
    return { success: false, error: 'Failed to update income' };
  }
}

export async function deleteIncome(id: string): Promise<ApiResponse<void>> {
  try {
    // Erst die Income holen um den Betrag und Account zu kennen
    const [income] = await db.select().from(incomes).where(eq(incomes.id, id));
    if (income && income.accountId) {
      // Kontostand aktualisieren (abziehen)
      await db
        .update(accounts)
        .set({
          balance: sql`${accounts.balance} - ${income.amount}`,
        })
        .where(eq(accounts.id, income.accountId));
    }
    
    await db.delete(incomes).where(eq(incomes.id, id));
    revalidatePath('/income');
    revalidatePath('/dashboard');
    revalidatePath('/accounts');
    return { success: true, data: undefined };
  } catch (error) {
    console.error('Failed to delete income:', error);
    return { success: false, error: 'Failed to delete income' };
  }
}