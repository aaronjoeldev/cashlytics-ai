'use server';

import { db } from '@/lib/db';
import { accounts } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import {
  createAccountSchema,
  updateAccountSchema,
  type CreateAccountInput,
  type UpdateAccountInput,
} from '@/lib/validators/account';

type ActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function getAccounts(): Promise<ActionResult> {
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

export async function getAccountById(id: string): Promise<ActionResult> {
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

export async function createAccount(data: CreateAccountInput): Promise<ActionResult> {
  try {
    const parsed = createAccountSchema.safeParse(data);

    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' };
    }

    const [newAccount] = await db
      .insert(accounts)
      .values({
        name: parsed.data.name,
        type: parsed.data.type,
        balance: parsed.data.balance,
        currency: parsed.data.currency,
      })
      .returning();

    revalidatePath('/accounts');
    return { success: true, data: newAccount };
  } catch (error) {
    console.error('Failed to create account:', error);
    return { success: false, error: 'Konto konnte nicht erstellt werden.' };
  }
}

export async function updateAccount(id: string, data: UpdateAccountInput): Promise<ActionResult> {
  try {
    const parsed = updateAccountSchema.safeParse(data);

    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' };
    }

    const [updatedAccount] = await db
      .update(accounts)
      .set(parsed.data)
      .where(eq(accounts.id, id))
      .returning();

    if (!updatedAccount) {
      return { success: false, error: 'Konto nicht gefunden.' };
    }

    revalidatePath('/accounts');
    return { success: true, data: updatedAccount };
  } catch (error) {
    console.error('Failed to update account:', error);
    return { success: false, error: 'Konto konnte nicht aktualisiert werden.' };
  }
}

export async function deleteAccount(id: string): Promise<ActionResult> {
  try {
    const [deletedAccount] = await db
      .delete(accounts)
      .where(eq(accounts.id, id))
      .returning();

    if (!deletedAccount) {
      return { success: false, error: 'Konto nicht gefunden.' };
    }

    revalidatePath('/accounts');
    return { success: true, data: deletedAccount };
  } catch (error) {
    console.error('Failed to delete account:', error);
    return { success: false, error: 'Konto konnte nicht gelöscht werden.' };
  }
}
