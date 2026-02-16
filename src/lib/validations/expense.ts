import { z } from 'zod';

export const recurrenceTypes = ['once', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'] as const;

export const expenseSchema = z.object({
  accountId: z.string().uuid('Konto auswählen'),
  categoryId: z.string().uuid().optional().nullable(),
  name: z.string().min(1, 'Name ist erforderlich').max(100),
  amount: z.string().min(1, 'Betrag ist erforderlich').refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    'Betrag muss positiv sein'
  ),
  recurrenceType: z.enum(recurrenceTypes),
  recurrenceInterval: z.number().int().positive().optional().nullable(),
  startDate: z.union([z.string(), z.date()]).transform((val) => 
    typeof val === 'string' ? new Date(val) : val
  ),
  endDate: z.union([z.string(), z.date()]).optional().nullable().transform((val) => 
    val ? (typeof val === 'string' ? new Date(val) : val) : null
  ),
});

export const expenseUpdateSchema = expenseSchema.partial();

export type ExpenseInput = z.infer<typeof expenseSchema>;
export type ExpenseUpdateInput = z.infer<typeof expenseUpdateSchema>;
