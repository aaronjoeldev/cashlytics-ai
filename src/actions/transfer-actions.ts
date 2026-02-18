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

    const transfer = await db.transaction(async (tx) => {
      const [created] = await tx.insert(transfers).values(data).returning();

      await tx
        .update(accounts)
        .set({ balance: sql`${accounts.balance} - ${data.amount}` })
        .where(eq(accounts.id, data.sourceAccountId));

      await tx
        .update(accounts)
        .set({ balance: sql`${accounts.balance} + ${data.amount}` })
        .where(eq(accounts.id, data.targetAccountId));

      return created;
    });

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

    const transfer = await db.transaction(async (tx) => {
      // Fetch old transfer to reverse its balance effect
      const [old] = await tx.select().from(transfers).where(eq(transfers.id, id));
      if (!old) throw new Error('Transfer nicht gefunden');

      // Reverse old balance change
      await tx
        .update(accounts)
        .set({ balance: sql`${accounts.balance} + ${old.amount}` })
        .where(eq(accounts.id, old.sourceAccountId));

      await tx
        .update(accounts)
        .set({ balance: sql`${accounts.balance} - ${old.amount}` })
        .where(eq(accounts.id, old.targetAccountId));

      // Write the update
      const [updated] = await tx
        .update(transfers)
        .set(data)
        .where(eq(transfers.id, id))
        .returning();

      // Apply new balance change (merge old values with the patch)
      const newSourceId = data.sourceAccountId ?? old.sourceAccountId;
      const newTargetId = data.targetAccountId ?? old.targetAccountId;
      const newAmount = data.amount ?? old.amount;

      await tx
        .update(accounts)
        .set({ balance: sql`${accounts.balance} - ${newAmount}` })
        .where(eq(accounts.id, newSourceId));

      await tx
        .update(accounts)
        .set({ balance: sql`${accounts.balance} + ${newAmount}` })
        .where(eq(accounts.id, newTargetId));

      return updated;
    });

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
    await db.transaction(async (tx) => {
      const [transfer] = await tx.select().from(transfers).where(eq(transfers.id, id));
      if (!transfer) throw new Error('Transfer nicht gefunden');

      // Reverse the balance change
      await tx
        .update(accounts)
        .set({ balance: sql`${accounts.balance} + ${transfer.amount}` })
        .where(eq(accounts.id, transfer.sourceAccountId));

      await tx
        .update(accounts)
        .set({ balance: sql`${accounts.balance} - ${transfer.amount}` })
        .where(eq(accounts.id, transfer.targetAccountId));

      await tx.delete(transfers).where(eq(transfers.id, id));
    });

    revalidatePath('/transfers');
    revalidatePath('/dashboard');
    revalidatePath('/accounts');
    return { success: true, data: undefined };
  } catch (error) {
    console.error('Failed to delete transfer:', error);
    return { success: false, error: 'Transfer konnte nicht gelöscht werden' };
  }
}
