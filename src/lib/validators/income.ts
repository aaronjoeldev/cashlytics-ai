import { z } from 'zod';

export const incomeRecurrenceTypeValues = ['once', 'monthly', 'yearly'] as const;

export const createIncomeSchema = z.object({
  accountId: z.string().uuid('Ungültige Konto-ID'),
  source: z.string().min(1, 'Quelle ist erforderlich').max(200),
  amount: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Ungültiger Betrag'),
  recurrenceType: z.enum(incomeRecurrenceTypeValues),
  startDate: z.string().or(z.date()),
});

export const updateIncomeSchema = createIncomeSchema.partial();

export type CreateIncomeInput = z.infer<typeof createIncomeSchema>;
export type UpdateIncomeInput = z.infer<typeof updateIncomeSchema>;
