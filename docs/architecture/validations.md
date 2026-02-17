# Validations

## Overview

Cashlytics uses Zod for schema validation with two separate validation directories:

- **`/src/lib/validations/`**: Form validation schemas (used with React Hook Form)
- **`/src/lib/validators/`**: API input validation schemas (used in server actions)

---

## Form Validations (`/src/lib/validations/`)

### transaction.ts

Comprehensive validation schemas for all transaction types.

#### Recurrence Types

```typescript
const recurrenceTypes = ['once', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'] as const;
const incomeRecurrenceTypes = ['once', 'monthly', 'yearly'] as const;
const transferRecurrenceTypes = ['once', 'monthly', 'quarterly', 'yearly'] as const;
const accountTypes = ['checking', 'savings', 'etf'] as const;
```

#### expenseSchema

```typescript
const expenseSchema = z.object({
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
});
```

| Field | Type | Validation |
|-------|------|------------|
| `accountId` | string | Required UUID |
| `categoryId` | string | Optional UUID or empty string |
| `name` | string | Required, 1-100 characters |
| `amount` | string | Required, positive number |
| `recurrenceType` | enum | Required recurrence type |
| `recurrenceInterval` | number | Optional, for custom recurrence |
| `startDate` | Date | Required |
| `endDate` | Date | Optional, nullable |

#### dailyExpenseSchema

```typescript
const dailyExpenseSchema = z.object({
  accountId: z.string().uuid('Konto auswählen'),
  categoryId: z.string().uuid().optional().or(z.literal('')),
  description: z.string().min(1, 'Beschreibung ist erforderlich').max(200),
  amount: z.string().min(1, 'Betrag ist erforderlich').refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    'Betrag muss positiv sein'
  ),
  date: z.date({ message: 'Datum ist erforderlich' }),
});
```

| Field | Type | Validation |
|-------|------|------------|
| `accountId` | string | Required UUID |
| `categoryId` | string | Optional UUID or empty string |
| `description` | string | Required, 1-200 characters |
| `amount` | string | Required, positive number |
| `date` | Date | Required |

#### incomeSchema

```typescript
const incomeSchema = z.object({
  accountId: z.string().uuid('Konto auswählen'),
  source: z.string().min(1, 'Quelle ist erforderlich').max(100),
  amount: z.string().min(1, 'Betrag ist erforderlich').refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    'Betrag muss positiv sein'
  ),
  recurrenceType: z.enum(incomeRecurrenceTypes),
  startDate: z.date({ message: 'Startdatum ist erforderlich' }),
  endDate: z.any().optional().nullable(),
});
```

| Field | Type | Validation |
|-------|------|------------|
| `accountId` | string | Required UUID |
| `source` | string | Required, 1-100 characters |
| `amount` | string | Required, positive number |
| `recurrenceType` | enum | Required (once/monthly/yearly) |
| `startDate` | Date | Required |
| `endDate` | Date | Optional, nullable |

#### accountSchema

```typescript
const accountSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(50),
  type: z.enum(accountTypes),
  balance: z.string().default('0'),
  currency: z.string().default('EUR'),
});
```

| Field | Type | Validation |
|-------|------|------------|
| `name` | string | Required, 1-50 characters |
| `type` | enum | Required (checking/savings/etf) |
| `balance` | string | Default '0' |
| `currency` | string | Default 'EUR' |

#### transferSchema

```typescript
const transferSchema = z.object({
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
```

| Field | Type | Validation |
|-------|------|------------|
| `sourceAccountId` | string | Required UUID |
| `targetAccountId` | string | Required UUID, must differ from source |
| `amount` | string | Required, positive number |
| `description` | string | Optional, max 200 characters |
| `recurrenceType` | enum | Required |
| `startDate` | Date | Required |
| `endDate` | Date | Optional, nullable |

**Custom Refinement**: Source and target accounts must be different.

---

### expense.ts

Extended expense validation with string/date transformation.

```typescript
const expenseSchema = z.object({
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

const expenseUpdateSchema = expenseSchema.partial();
```

---

### daily-expense.ts

```typescript
const dailyExpenseSchema = z.object({
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

const dailyExpenseUpdateSchema = dailyExpenseSchema.partial();
```

---

### income.ts

```typescript
const incomeRecurrenceTypes = ['once', 'monthly', 'yearly'] as const;

const incomeSchema = z.object({
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

const incomeUpdateSchema = incomeSchema.partial();
```

---

### category.ts

```typescript
const categorySchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(50, 'Name zu lang'),
  icon: z.string().max(10).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Ungültige Farbe').optional().or(z.literal('')),
});
```

| Field | Type | Validation |
|-------|------|------------|
| `name` | string | Required, 1-50 characters |
| `icon` | string | Optional, max 10 characters |
| `color` | string | Optional, hex color format (#RRGGBB) |

---

## API Validators (`/src/lib/validators/`)

### account.ts

```typescript
const accountTypeValues = ['checking', 'savings', 'etf'] as const;

const createAccountSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(100, 'Name darf maximal 100 Zeichen lang sein'),
  type: z.enum(accountTypeValues),
  balance: z.string()
    .regex(/^-?\d{1,10}(\.\d{1,2})?$/, 'Ungültiger Betrag')
    .default('0'),
  currency: z.string().min(1).max(3).default('EUR'),
});

const updateAccountSchema = createAccountSchema.partial();
```

**Key Differences from Form Validation**:
- Amount regex allows negative values (for initial balance)
- Currency has max length validation

---

### expense.ts

```typescript
const recurrenceTypeValues = ['once', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'] as const;

const createExpenseSchema = z.object({
  accountId: z.string().uuid('Ungültige Konto-ID'),
  categoryId: z.string().uuid('Ungültige Kategorie-ID').nullable().optional(),
  name: z.string().min(1, 'Name ist erforderlich').max(200),
  amount: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Ungültiger Betrag'),
  recurrenceType: z.enum(recurrenceTypeValues),
  recurrenceInterval: z.number().int().positive().nullable().optional(),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()).nullable().optional(),
});

const updateExpenseSchema = createExpenseSchema.partial();
```

**Key Differences**:
- Strict amount regex: `^\d{1,10}(\.\d{1,2})?$`
- Name max length: 200 (vs 100 in form)

---

### daily-expense.ts

```typescript
const createDailyExpenseSchema = z.object({
  accountId: z.string().uuid('Ungültige Konto-ID'),
  categoryId: z.string().uuid('Ungültige Kategorie-ID').nullable().optional(),
  description: z.string().min(1, 'Beschreibung ist erforderlich').max(500),
  amount: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Ungültiger Betrag'),
  date: z.string().or(z.date()),
});

const updateDailyExpenseSchema = createDailyExpenseSchema.partial();
```

**Key Differences**:
- Description max length: 500 (vs 200 in form)

---

### income.ts

```typescript
const incomeRecurrenceTypeValues = ['once', 'monthly', 'yearly'] as const;

const createIncomeSchema = z.object({
  accountId: z.string().uuid('Ungültige Konto-ID'),
  source: z.string().min(1, 'Quelle ist erforderlich').max(200),
  amount: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Ungültiger Betrag'),
  recurrenceType: z.enum(incomeRecurrenceTypeValues),
  startDate: z.string().or(z.date()),
});

const updateIncomeSchema = createIncomeSchema.partial();
```

---

## Type Exports

### Form Validation Types

```typescript
type ExpenseInput = z.infer<typeof expenseSchema>;
type DailyExpenseInput = z.infer<typeof dailyExpenseSchema>;
type IncomeInput = z.infer<typeof incomeSchema>;
type AccountInput = z.infer<typeof accountSchema>;
type TransferInput = z.infer<typeof transferSchema>;
type CategoryInput = z.infer<typeof categorySchema>;
```

### API Validator Types

```typescript
type CreateAccountInput = z.infer<typeof createAccountSchema>;
type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
type CreateDailyExpenseInput = z.infer<typeof createDailyExpenseSchema>;
type UpdateDailyExpenseInput = z.infer<typeof updateDailyExpenseSchema>;
type CreateIncomeInput = z.infer<typeof createIncomeSchema>;
type UpdateIncomeInput = z.infer<typeof updateIncomeSchema>;
```

---

## Usage with React Hook Form

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { expenseSchema, type ExpenseInput } from '@/lib/validations/expense';

function ExpenseForm() {
  const form = useForm<ExpenseInput>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      accountId: '',
      categoryId: '',
      name: '',
      amount: '',
      recurrenceType: 'monthly',
      startDate: new Date(),
    },
  });
  // ...
}
```
