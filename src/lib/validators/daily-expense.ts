import { z } from 'zod';
import { currencies, defaultCurrency } from '@/lib/currency';

export const createDailyExpenseSchema = z.object({
  accountId: z.string().uuid('Ungültige Konto-ID'),
  categoryId: z.string().uuid('Ungültige Kategorie-ID').nullable().optional(),
  description: z.string().min(1, 'Beschreibung ist erforderlich').max(500),
  amount: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Ungültiger Betrag'),
  date: z.string().or(z.date()),
  currency: z.enum(currencies).default(defaultCurrency),
  originalAmount: z.number().positive().optional(),
  exchangeRate: z.number().positive().optional(),
});

export const updateDailyExpenseSchema = createDailyExpenseSchema.partial();

export type CreateDailyExpenseInput = z.infer<typeof createDailyExpenseSchema>;
export type UpdateDailyExpenseInput = z.infer<typeof updateDailyExpenseSchema>;
