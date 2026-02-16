import { z } from 'zod';

export const accountTypeValues = ['checking', 'savings', 'etf'] as const;

export const createAccountSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(100, 'Name darf maximal 100 Zeichen lang sein'),
  type: z.enum(accountTypeValues),
  balance: z
    .string()
    .regex(/^-?\d{1,10}(\.\d{1,2})?$/, 'Ungültiger Betrag')
    .default('0'),
  currency: z.string().min(1).max(3).default('EUR'),
});

export const updateAccountSchema = createAccountSchema.partial();

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
