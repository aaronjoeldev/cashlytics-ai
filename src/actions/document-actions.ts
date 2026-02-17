'use server';

import { db } from '@/lib/db';
import { documents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];

export async function uploadDocument(formData: FormData): Promise<{ success: boolean; documentId?: string; error?: string }> {
  try {
    const file = formData.get('file') as File | null;
    const expenseId = formData.get('expenseId') as string | null;
    const dailyExpenseId = formData.get('dailyExpenseId') as string | null;

    if (!file) {
      return { success: false, error: 'Keine Datei hochgeladen.' };
    }

    if (!expenseId && !dailyExpenseId) {
      return { success: false, error: 'Entweder expenseId oder dailyExpenseId muss angegeben werden.' };
    }

    if (expenseId && dailyExpenseId) {
      return { success: false, error: 'Nur eine ID (expenseId oder dailyExpenseId) darf angegeben werden.' };
    }

    if (file.size > MAX_FILE_SIZE) {
      return { success: false, error: 'Datei ist zu gross. Maximal 5MB erlaubt.' };
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return { success: false, error: 'Dateityp nicht erlaubt. Erlaubt: PDF, PNG, JPEG.' };
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');

    const [document] = await db
      .insert(documents)
      .values({
        expenseId: expenseId || null,
        dailyExpenseId: dailyExpenseId || null,
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        data: base64Data,
      })
      .returning();

    revalidatePath('/expenses');
    revalidatePath('/dashboard');

    return { success: true, documentId: document.id };
  } catch (error) {
    console.error('Failed to upload document:', error);
    return { success: false, error: 'Dokument konnte nicht hochgeladen werden.' };
  }
}

export async function deleteDocument(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const [deleted] = await db.delete(documents).where(eq(documents.id, id)).returning();

    if (!deleted) {
      return { success: false, error: 'Dokument nicht gefunden.' };
    }

    revalidatePath('/expenses');
    revalidatePath('/dashboard');

    return { success: true };
  } catch (error) {
    console.error('Failed to delete document:', error);
    return { success: false, error: 'Dokument konnte nicht geloescht werden.' };
  }
}

export async function getDocumentsByExpense(expenseId: string) {
  try {
    const result = await db.select().from(documents).where(eq(documents.expenseId, expenseId));
    return { success: true, data: result };
  } catch (error) {
    console.error('Failed to fetch documents:', error);
    return { success: false, error: 'Dokumente konnten nicht geladen werden.' };
  }
}

export async function getDocumentsByDailyExpense(dailyExpenseId: string) {
  try {
    const result = await db.select().from(documents).where(eq(documents.dailyExpenseId, dailyExpenseId));
    return { success: true, data: result };
  } catch (error) {
    console.error('Failed to fetch documents:', error);
    return { success: false, error: 'Dokumente konnten nicht geladen werden.' };
  }
}

export async function downloadDocument(id: string) {
  try {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    if (!doc) {
      return { success: false, error: 'Dokument nicht gefunden.' };
    }
    return { success: true, data: doc.data, mimeType: doc.mimeType, fileName: doc.fileName };
  } catch (error) {
    console.error('Failed to download document:', error);
    return { success: false, error: 'Download fehlgeschlagen.' };
  }
}
