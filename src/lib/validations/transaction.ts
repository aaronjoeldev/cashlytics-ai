import { z } from 'zod';

export const recurrenceTypes = ['once', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'] as const;
export const incomeRecurrenceTypes = ['once', 'monthly', 'yearly'] as const;
export const transferRecurrenceTypes = ['once', 'monthly', 'quarterly', 'yearly'] as const;
export const accountTypes = ['checking', 'savings', 'etf'] as const;

export const expenseSchema = z.object({
  accountId: z.string().uuid('Konto auswählen'),
  categoryId: z.string().uuid().optional().or(z.literal('')),
  name: z.string().min(1, 'Name ist erforderlich').max(100),
  amount: z.string().min(1, 'Betrag ist erforderlich').refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    'Betrag muss positiv sein'
  ),
  recurrenceType: z.enum(recurrenceTypes),
  recurrenceInterval: z.number().optional(),
  startDate: z.date({ message: 'Startdatum ist erforderlich' }),
  endDate: z.any().optional().nullable(),
  isSubscription: z.boolean(),
  info: z.string().optional(),
});

export const dailyExpenseSchema = z.object({
  accountId: z.string().uuid('Konto auswählen'),
  categoryId: z.string().uuid().optional().or(z.literal('')),
  description: z.string().min(1, 'Beschreibung ist erforderlich').max(200),
  amount: z.string().min(1, 'Betrag ist erforderlich').refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    'Betrag muss positiv sein'
  ),
  date: z.date({ message: 'Datum ist erforderlich' }),
  info: z.string().optional(),
});

export const incomeSchema = z.object({
  accountId: z.string().uuid('Konto auswählen'),
  source: z.string().min(1, 'Quelle ist erforderlich').max(100),
  amount: z.string().min(1, 'Betrag ist erforderlich').refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    'Betrag muss positiv sein'
  ),
  recurrenceType: z.enum(incomeRecurrenceTypes),
  startDate: z.date({ message: 'Startdatum ist erforderlich' }),
  endDate: z.any().optional().nullable(),
  info: z.string().optional(),
});

export const accountSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(50),
  type: z.enum(accountTypes),
  balance: z.string().default('0'),
  currency: z.string().default('EUR'),
});

export const transferSchema = z.object({
  sourceAccountId: z.string().uuid('Quellkonto auswählen'),
  targetAccountId: z.string().uuid('Zielkonto auswählen'),
  amount: z.string().min(1, 'Betrag ist erforderlich').refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    'Betrag muss positiv sein'
  ),
  description: z.string().max(200).optional(),
  recurrenceType: z.enum(transferRecurrenceTypes),
  startDate: z.date({ message: 'Startdatum ist erforderlich' }),
  endDate: z.any().optional().nullable(),
}).refine((data) => data.sourceAccountId !== data.targetAccountId, {
  message: 'Quell- und Zielkonto müssen unterschiedlich sein',
  path: ['targetAccountId'],
});

export type ExpenseInput = z.infer<typeof expenseSchema>;
export type DailyExpenseInput = z.infer<typeof dailyExpenseSchema>;
export type IncomeInput = z.infer<typeof incomeSchema>;
export type AccountInput = z.infer<typeof accountSchema>;
export type TransferInput = z.infer<typeof transferSchema>;