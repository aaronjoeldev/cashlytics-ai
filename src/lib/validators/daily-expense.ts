import { z } from 'zod';

export const createDailyExpenseSchema = z.object({
  accountId: z.string().uuid('Ungültige Konto-ID'),
  categoryId: z.string().uuid('Ungültige Kategorie-ID').nullable().optional(),
  description: z.string().min(1, 'Beschreibung ist erforderlich').max(500),
  amount: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Ungültiger Betrag'),
  date: z.string().or(z.date()),
});

export const updateDailyExpenseSchema = createDailyExpenseSchema.partial();

export type CreateDailyExpenseInput = z.infer<typeof createDailyExpenseSchema>;
export type UpdateDailyExpenseInput = z.infer<typeof updateDailyExpenseSchema>;
