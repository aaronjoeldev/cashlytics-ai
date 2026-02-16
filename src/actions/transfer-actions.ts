'use server';

import { db } from '@/lib/db';
import { transfers, accounts } from '@/lib/db/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { ApiResponse, Transfer, NewTransfer, TransferWithDetails } from '@/types/database';

export async function getTransfers(filters?: {
  sourceAccountId?: string;
  targetAccountId?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<ApiResponse<TransferWithDetails[]>> {
  try {
    const conditions = [];
    if (filters?.sourceAccountId) {
      conditions.push(eq(transfers.sourceAccountId, filters.sourceAccountId));
    }
    if (filters?.targetAccountId) {
      conditions.push(eq(transfers.targetAccountId, filters.targetAccountId));
    }
    if (filters?.startDate) {
      conditions.push(gte(transfers.startDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(transfers.startDate, filters.endDate));
    }

    const result = await db.query.transfers.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        sourceAccount: true,
        targetAccount: true,
      },
      orderBy: [desc(transfers.startDate)],
    });

    return { success: true, data: result as TransferWithDetails[] };
  } catch (error) {
    console.error('Failed to fetch transfers:', error);
    return { success: false, error: 'Transfers konnten nicht geladen werden' };
  }
}

export async function createTransfer(data: NewTransfer): Promise<ApiResponse<Transfer>> {
  try {
    if (data.sourceAccountId === data.targetAccountId) {
      return { success: false, error: 'Quell- und Zielkonto müssen unterschiedlich sein' };
    }

    const [transfer] = await db.insert(transfers).values(data).returning();

    if (data.recurrenceType === 'once') {
      await db
        .update(accounts)
        .set({
          balance: sql`${accounts.balance} - ${data.amount}`,
        })
        .where(eq(accounts.id, data.sourceAccountId));

      await db
        .update(accounts)
        .set({
          balance: sql`${accounts.balance} + ${data.amount}`,
        })
        .where(eq(accounts.id, data.targetAccountId));
    }

    revalidatePath('/transfers');
    revalidatePath('/dashboard');
    revalidatePath('/accounts');
    return { success: true, data: transfer };
  } catch (error) {
    console.error('Failed to create transfer:', error);
    return { success: false, error: 'Transfer konnte nicht erstellt werden' };
  }
}

export async function updateTransfer(
  id: string,
  data: Partial<NewTransfer>
): Promise<ApiResponse<Transfer>> {
  try {
    if (data.sourceAccountId && data.targetAccountId && data.sourceAccountId === data.targetAccountId) {
      return { success: false, error: 'Quell- und Zielkonto müssen unterschiedlich sein' };
    }

    const [transfer] = await db.update(transfers).set(data).where(eq(transfers.id, id)).returning();
    if (!transfer) {
      return { success: false, error: 'Transfer nicht gefunden' };
    }
    revalidatePath('/transfers');
    revalidatePath('/dashboard');
    revalidatePath('/accounts');
    return { success: true, data: transfer };
  } catch (error) {
    console.error('Failed to update transfer:', error);
    return { success: false, error: 'Transfer konnte nicht aktualisiert werden' };
  }
}

export async function deleteTransfer(id: string): Promise<ApiResponse<void>> {
  try {
    const [transfer] = await db.select().from(transfers).where(eq(transfers.id, id));
    
    if (transfer && transfer.recurrenceType === 'once') {
      await db
        .update(accounts)
        .set({
          balance: sql`${accounts.balance} + ${transfer.amount}`,
        })
        .where(eq(accounts.id, transfer.sourceAccountId));

      await db
        .update(accounts)
        .set({
          balance: sql`${accounts.balance} - ${transfer.amount}`,
        })
        .where(eq(accounts.id, transfer.targetAccountId));
    }
    
    await db.delete(transfers).where(eq(transfers.id, id));
    revalidatePath('/transfers');
    revalidatePath('/dashboard');
    revalidatePath('/accounts');
    return { success: true, data: undefined };
  } catch (error) {
    console.error('Failed to delete transfer:', error);
    return { success: false, error: 'Transfer konnte nicht gelöscht werden' };
  }
}
