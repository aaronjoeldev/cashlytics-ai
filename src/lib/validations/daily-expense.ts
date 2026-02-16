import { z } from 'zod';

export const dailyExpenseSchema = z.object({
  accountId: z.string().uuid('Konto auswählen'),
  categoryId: z.string().uuid().optional().nullable(),
  description: z.string().min(1, 'Beschreibung ist erforderlich').max(200),
  amount: z.string().min(1, 'Betrag ist erforderlich').refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    'Betrag muss positiv sein'
  ),
  date: z.union([z.string(), z.date()]).transform((val) => 
    typeof val === 'string' ? new Date(val) : val
  ),
});

export const dailyExpenseUpdateSchema = dailyExpenseSchema.partial();

export type DailyExpenseInput = z.infer<typeof dailyExpenseSchema>;
export type DailyExpenseUpdateInput = z.infer<typeof dailyExpenseUpdateSchema>;
