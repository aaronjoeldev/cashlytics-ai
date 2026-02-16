import { z } from 'zod';

export const incomeRecurrenceTypes = ['once', 'monthly', 'yearly'] as const;

export const incomeSchema = z.object({
  accountId: z.string().uuid('Konto auswählen'),
  source: z.string().min(1, 'Quelle ist erforderlich').max(100),
  amount: z.string().min(1, 'Betrag ist erforderlich').refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    'Betrag muss positiv sein'
  ),
  recurrenceType: z.enum(incomeRecurrenceTypes),
  startDate: z.union([z.string(), z.date()]).transform((val) => 
    typeof val === 'string' ? new Date(val) : val
  ),
});

export const incomeUpdateSchema = incomeSchema.partial();

export type IncomeInput = z.infer<typeof incomeSchema>;
export type IncomeUpdateInput = z.infer<typeof incomeUpdateSchema>;
