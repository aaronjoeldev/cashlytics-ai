'use server';

import { db } from '@/lib/db';
import { accounts } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { ApiResponse, Account, NewAccount } from '@/types/database';

export async function getAccounts(): Promise<ApiResponse<Account[]>> {
  try {
    const allAccounts = await db
      .select()
      .from(accounts)
      .orderBy(desc(accounts.createdAt));

    return { success: true, data: allAccounts };
  } catch (error) {
    console.error('Failed to fetch accounts:', error);
    return { success: false, error: 'Konten konnten nicht geladen werden.' };
  }
}

export async function getAccountById(id: string): Promise<ApiResponse<Account>> {
  try {
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, id))
      .limit(1);

    if (!account) {
      return { success: false, error: 'Konto nicht gefunden.' };
    }

    return { success: true, data: account };
  } catch (error) {
    console.error('Failed to fetch account:', error);
    return { success: false, error: 'Konto konnte nicht geladen werden.' };
  }
}

export async function createAccount(data: {
  name: string;
  type: 'checking' | 'savings' | 'etf';
  initialBalance?: number;
}): Promise<ApiResponse<Account>> {
  try {
    const [newAccount] = await db
      .insert(accounts)
      .values({
        name: data.name,
        type: data.type,
        balance: data.initialBalance?.toString() ?? '0',
        currency: 'EUR',
      })
      .returning();

    revalidatePath('/accounts');
    revalidatePath('/dashboard');
    return { success: true, data: newAccount };
  } catch (error) {
    console.error('Failed to create account:', error);
    return { success: false, error: 'Konto konnte nicht erstellt werden.' };
  }
}

export async function updateAccount(
  id: string,
  data: Partial<Omit<NewAccount, 'id' | 'createdAt'>>
): Promise<ApiResponse<Account>> {
  try {
    const [updatedAccount] = await db
      .update(accounts)
      .set(data)
      .where(eq(accounts.id, id))
      .returning();

    if (!updatedAccount) {
      return { success: false, error: 'Konto nicht gefunden.' };
    }

    revalidatePath('/accounts');
    revalidatePath('/dashboard');
    return { success: true, data: updatedAccount };
  } catch (error) {
    console.error('Failed to update account:', error);
    return { success: false, error: 'Konto konnte nicht aktualisiert werden.' };
  }
}

export async function deleteAccount(id: string): Promise<ApiResponse<void>> {
  try {
    const [deletedAccount] = await db
      .delete(accounts)
      .where(eq(accounts.id, id))
      .returning();

    if (!deletedAccount) {
      return { success: false, error: 'Konto nicht gefunden.' };
    }

    revalidatePath('/accounts');
    revalidatePath('/dashboard');
    return { success: true, data: undefined };
  } catch (error) {
    console.error('Failed to delete account:', error);
    return { success: false, error: 'Konto konnte nicht gelöscht werden.' };
  }
}
