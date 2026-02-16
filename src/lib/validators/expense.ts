import { z } from 'zod';

export const recurrenceTypeValues = ['once', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'] as const;

export const createExpenseSchema = z.object({
  accountId: z.string().uuid('Ungültige Konto-ID'),
  categoryId: z.string().uuid('Ungültige Kategorie-ID').nullable().optional(),
  name: z.string().min(1, 'Name ist erforderlich').max(200),
  amount: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Ungültiger Betrag'),
  recurrenceType: z.enum(recurrenceTypeValues),
  recurrenceInterval: z.number().int().positive().nullable().optional(),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()).nullable().optional(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
