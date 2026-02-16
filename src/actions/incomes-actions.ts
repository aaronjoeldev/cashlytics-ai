'use server';

import { db } from '@/lib/db';
import { incomes, accounts } from '@/lib/db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { ApiResponse, Income, IncomeWithAccount, NewIncome } from '@/types/database';

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
      .orderBy(desc(incomes.createdAt));

    const incomesWithAccount: IncomeWithAccount[] = result.map((r) => ({
      ...r.income,
      account: r.account,
    }));

    return { success: true, data: incomesWithAccount };
  } catch (error) {
    console.error('Failed to fetch incomes:', error);
    return { success: false, error: 'Einnahmen konnten nicht geladen werden.' };
  }
}

export async function getIncomeById(id: string): Promise<ApiResponse<IncomeWithAccount>> {
  try {
    const [result] = await db
      .select({
        income: incomes,
        account: accounts,
      })
      .from(incomes)
      .leftJoin(accounts, eq(incomes.accountId, accounts.id))
      .where(eq(incomes.id, id))
      .limit(1);

    if (!result) {
      return { success: false, error: 'Einnahme nicht gefunden.' };
    }

    return {
      success: true,
      data: {
        ...result.income,
        account: result.account,
      },
    };
  } catch (error) {
    console.error('Failed to fetch income:', error);
    return { success: false, error: 'Einnahme konnte nicht geladen werden.' };
  }
}

export async function createIncome(data: {
  accountId: string;
  source: string;
  amount: number;
  recurrenceType: 'once' | 'monthly' | 'yearly';
  startDate: Date | string;
}): Promise<ApiResponse<Income>> {
  try {
    const [newIncome] = await db
      .insert(incomes)
      .values({
        accountId: data.accountId,
        source: data.source,
        amount: data.amount.toString(),
        recurrenceType: data.recurrenceType,
        startDate: typeof data.startDate === 'string' ? new Date(data.startDate) : data.startDate,
      })
      .returning();

    revalidatePath('/income');
    revalidatePath('/dashboard');
    return { success: true, data: newIncome };
  } catch (error) {
    console.error('Failed to create income:', error);
    return { success: false, error: 'Einnahme konnte nicht erstellt werden.' };
  }
}

export async function updateIncome(
  id: string,
  data: Partial<Omit<NewIncome, 'id' | 'createdAt'>>
): Promise<ApiResponse<Income>> {
  try {
    const updateData = { ...data };
    if (data.startDate && typeof data.startDate === 'string') {
      updateData.startDate = new Date(data.startDate);
    }

    const [updatedIncome] = await db
      .update(incomes)
      .set(updateData)
      .where(eq(incomes.id, id))
      .returning();

    if (!updatedIncome) {
      return { success: false, error: 'Einnahme nicht gefunden.' };
    }

    revalidatePath('/income');
    revalidatePath('/dashboard');
    return { success: true, data: updatedIncome };
  } catch (error) {
    console.error('Failed to update income:', error);
    return { success: false, error: 'Einnahme konnte nicht aktualisiert werden.' };
  }
}

export async function deleteIncome(id: string): Promise<ApiResponse<void>> {
  try {
    const [deletedIncome] = await db
      .delete(incomes)
      .where(eq(incomes.id, id))
      .returning();

    if (!deletedIncome) {
      return { success: false, error: 'Einnahme nicht gefunden.' };
    }

    revalidatePath('/income');
    revalidatePath('/dashboard');
    return { success: true, data: undefined };
  } catch (error) {
    console.error('Failed to delete income:', error);
    return { success: false, error: 'Einnahme konnte nicht gelöscht werden.' };
  }
}
