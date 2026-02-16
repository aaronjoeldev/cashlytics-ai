'use server';

import { db } from '@/lib/db';
import { accounts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { ApiResponse, Account, NewAccount } from '@/types/database';

export async function getAccounts(): Promise<ApiResponse<Account[]>> {
  try {
    const allAccounts = await db.select().from(accounts).orderBy(accounts.name);
    return { success: true, data: allAccounts };
  } catch (error) {
    console.error('Failed to fetch accounts:', error);
    return { success: false, error: 'Failed to fetch accounts' };
  }
}

export async function createAccount(data: NewAccount): Promise<ApiResponse<Account>> {
  try {
    const [account] = await db.insert(accounts).values(data).returning();
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
    return { success: true, data: account };
  } catch (error) {
    console.error('Failed to create account:', error);
    return { success: false, error: 'Failed to create account' };
  }
}

export async function updateAccount(
  id: string,
  data: Partial<NewAccount>
): Promise<ApiResponse<Account>> {
  try {
    const [account] = await db.update(accounts).set(data).where(eq(accounts.id, id)).returning();
    if (!account) {
      return { success: false, error: 'Account not found' };
    }
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
    return { success: true, data: account };
  } catch (error) {
    console.error('Failed to update account:', error);
    return { success: false, error: 'Failed to update account' };
  }
}

export async function deleteAccount(id: string): Promise<ApiResponse<void>> {
  try {
    await db.delete(accounts).where(eq(accounts.id, id));
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
    return { success: true, data: undefined };
  } catch (error) {
    console.error('Failed to delete account:', error);
    return { success: false, error: 'Failed to delete account' };
  }
}