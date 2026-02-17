import { tool } from 'ai';
import { z } from 'zod';
import { getAccounts, createAccount, updateAccount, deleteAccount } from '@/actions/account-actions';
import { getExpenses, createExpense, updateExpense, deleteExpense, getDailyExpenses, createDailyExpense, deleteDailyExpense } from '@/actions/expense-actions';
import { getIncomes, createIncome, updateIncome, deleteIncome } from '@/actions/income-actions';
import { getCategories, createCategory } from '@/actions/category-actions';
import { getMonthlyOverview, getForecast, getCategoryBreakdown, getNormalizedMonthlyExpenses } from '@/actions/analytics-actions';

export const tools = {
  createAccount: tool({
    description: 'Erstellt ein neues Konto. Nutze dies wenn der Benutzer ein neues Konto anlegen möchte.',
    inputSchema: z.object({
      name: z.string().describe('Name des Kontos'),
      type: z.enum(['checking', 'savings', 'etf']).describe('Kontotyp: checking=Girokonto, savings=Sparkonto, etf=ETF-Portfolio'),
      balance: z.string().optional().describe('Aktueller Kontostand als String, z.B. "1000.00"'),
      currency: z.string().optional().describe('Währung, Standard ist EUR'),
    }),
    needsApproval: true,
    execute: async ({ name, type, balance = '0', currency = 'EUR' }) => {
      return createAccount({ name, type, balance, currency });
    },
  }),

  getAccounts: tool({
    description: 'Gibt alle Konten des Benutzers zurück mit Kontostand und Typ.',
    inputSchema: z.object({}),
    execute: async () => {
      return getAccounts();
    },
  }),

  updateAccount: tool({
    description: 'Aktualisiert ein bestehendes Konto.',
    inputSchema: z.object({
      id: z.uuid().describe('ID des Kontos'),
      name: z.string().optional().describe('Neuer Name des Kontos'),
      type: z.enum(['checking', 'savings', 'etf']).optional().describe('Neuer Kontotyp'),
      balance: z.string().optional().describe('Neuer Kontostand'),
    }),
    needsApproval: true,
    execute: async ({ id, name, type, balance }) => {
      const data: { name?: string; type?: 'checking' | 'savings' | 'etf'; balance?: string } = {};
      if (name !== undefined) data.name = name;
      if (type !== undefined) data.type = type;
      if (balance !== undefined) data.balance = balance;
      return updateAccount(id, data);
    },
  }),

  deleteAccount: tool({
    description: 'Löscht ein Konto. Warnung: Dies löscht auch alle zugehörigen Transaktionen.',
    inputSchema: z.object({
      id: z.uuid().describe('ID des zu löschenden Kontos'),
    }),
    needsApproval: true,
    execute: async ({ id }) => {
      return deleteAccount(id);
    },
  }),

  createExpense: tool({
    description: 'Erstellt eine WIEDERKEHRENDE Ausgabe (z.B. Miete, Netflix-Abo, Versicherung, Gym-Mitgliedschaft). NUR für Ausgaben nutzen, die sich regelmäßig wiederholen. Für einmalige Ausgaben (Einkauf, Tanken, Restaurant) IMMER createDailyExpense nutzen. Die accountId ist im Kontext bekannt – kein getAccounts nötig.',
    inputSchema: z.object({
      accountId: z.uuid().describe('ID des Kontos aus dem Kontext'),
      categoryId: z.uuid().optional().nullable().describe('ID der Kategorie aus dem Kontext, optional'),
      name: z.string().describe('Name/Beschreibung der Ausgabe'),
      amount: z.number().positive().describe('Betrag als Zahl'),
      recurrenceType: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom']).describe('Wiederholungstyp: daily=täglich, weekly=wöchentlich, monthly=monatlich, quarterly=quartalsweise, yearly=jährlich, custom=benutzerdefiniert'),
      recurrenceInterval: z.number().int().positive().optional().nullable().describe('Intervall für custom, z.B. alle 2 Wochen = 2'),
      startDate: z.string().describe('Startdatum im ISO-Format, z.B. "2024-01-01"'),
      endDate: z.string().optional().nullable().describe('Enddatum im ISO-Format, optional'),
    }),
    needsApproval: true,
    execute: async ({ accountId, categoryId, name, amount, recurrenceType, recurrenceInterval, startDate, endDate }) => {
      return createExpense({
        accountId,
        categoryId: categoryId ?? null,
        name,
        amount: amount.toString(),
        recurrenceType,
        recurrenceInterval: recurrenceInterval ?? null,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
      });
    },
  }),

  getExpenses: tool({
    description: 'Gibt periodische/wiederkehrende Ausgaben zurück. Nutze name um nach einer bestimmten Ausgabe zu suchen (z.B. name="Autofinanzierung"). Ohne Filter werden alle zurückgegeben.',
    inputSchema: z.object({
      accountId: z.uuid().optional().describe('Filter nach Konto-ID'),
      categoryId: z.uuid().optional().describe('Filter nach Kategorie-ID'),
      name: z.string().optional().describe('Suche nach Name/Beschreibung (Teilstring, case-insensitiv), z.B. "Miete" oder "Auto"'),
      startDate: z.string().optional().describe('Filter ab Datum (ISO-Format)'),
      endDate: z.string().optional().describe('Filter bis Datum (ISO-Format)'),
    }),
    execute: async ({ accountId, categoryId, name, startDate, endDate }) => {
      const filters: { accountId?: string; categoryId?: string; name?: string; startDate?: Date; endDate?: Date } = {};
      if (accountId) filters.accountId = accountId;
      if (categoryId) filters.categoryId = categoryId;
      if (name) filters.name = name;
      if (startDate) filters.startDate = new Date(startDate);
      if (endDate) filters.endDate = new Date(endDate);
      return getExpenses(filters);
    },
  }),

  updateExpense: tool({
    description: 'Aktualisiert eine bestehende periodische Ausgabe.',
    inputSchema: z.object({
      id: z.uuid().describe('ID der Ausgabe'),
      name: z.string().optional().describe('Neuer Name'),
      amount: z.number().positive().optional().describe('Neuer Betrag'),
      recurrenceType: z.enum(['once', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom']).optional(),
      endDate: z.string().optional().nullable().describe('Neues Enddatum'),
    }),
    needsApproval: true,
    execute: async ({ id, name, amount, recurrenceType, endDate }) => {
      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (amount !== undefined) updateData.amount = amount.toString();
      if (recurrenceType !== undefined) updateData.recurrenceType = recurrenceType;
      if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
      return updateExpense(id, updateData);
    },
  }),

  deleteExpense: tool({
    description: 'Löscht eine periodische Ausgabe.',
    inputSchema: z.object({
      id: z.uuid().describe('ID der zu löschenden Ausgabe'),
    }),
    needsApproval: true,
    execute: async ({ id }) => {
      return deleteExpense(id);
    },
  }),

  createDailyExpense: tool({
    description: 'Erstellt eine einmalige Ausgabe (z.B. Einkauf, Tanken, Restaurant, einmalige Zahlung). Für wirklich wiederkehrende Ausgaben (Miete, Abo) nutze createExpense. Die accountId und categoryId sind im Kontext bekannt – kein getAccounts nötig.',
    inputSchema: z.object({
      accountId: z.uuid().describe('ID des Kontos aus dem Kontext'),
      categoryId: z.uuid().optional().nullable().describe('ID der Kategorie aus dem Kontext, optional'),
      description: z.string().describe('Beschreibung der Ausgabe'),
      amount: z.number().positive().describe('Betrag als Zahl'),
      date: z.string().describe('Datum im ISO-Format, z.B. "2024-01-15"'),
    }),
    needsApproval: true,
    execute: async ({ accountId, categoryId, description, amount, date }) => {
      return createDailyExpense({
        accountId,
        categoryId: categoryId ?? null,
        description,
        amount: amount.toString(),
        date: new Date(date),
      });
    },
  }),

  getDailyExpenses: tool({
    description: 'Gibt einmalige Ausgaben zurück. Nutze description um nach einer bestimmten Ausgabe zu suchen (z.B. description="REWE"). Ohne Filter werden alle zurückgegeben.',
    inputSchema: z.object({
      accountId: z.uuid().optional().describe('Filter nach Konto-ID'),
      categoryId: z.uuid().optional().describe('Filter nach Kategorie-ID'),
      description: z.string().optional().describe('Suche nach Beschreibung (Teilstring, case-insensitiv), z.B. "REWE" oder "Tanken"'),
      startDate: z.string().optional().describe('Filter ab Datum (ISO-Format)'),
      endDate: z.string().optional().describe('Filter bis Datum (ISO-Format)'),
    }),
    execute: async ({ accountId, categoryId, description, startDate, endDate }) => {
      const filters: { accountId?: string; categoryId?: string; description?: string; startDate?: Date; endDate?: Date } = {};
      if (accountId) filters.accountId = accountId;
      if (categoryId) filters.categoryId = categoryId;
      if (description) filters.description = description;
      if (startDate) filters.startDate = new Date(startDate);
      if (endDate) filters.endDate = new Date(endDate);
      return getDailyExpenses(filters);
    },
  }),

  deleteDailyExpense: tool({
    description: 'Löscht eine tägliche Ausgabe.',
    inputSchema: z.object({
      id: z.uuid().describe('ID der zu löschenden Ausgabe'),
    }),
    needsApproval: true,
    execute: async ({ id }) => {
      return deleteDailyExpense(id);
    },
  }),

  createIncome: tool({
    description: 'Erstellt eine neue Einnahme (z.B. Gehalt, Nebenverdienst, Bonus). Die accountId ist im Kontext bekannt – kein getAccounts nötig.',
    inputSchema: z.object({
      accountId: z.uuid().describe('ID des Kontos aus dem Kontext'),
      source: z.string().describe('Quelle/Beschreibung der Einnahme, z.B. "Gehalt"'),
      amount: z.number().positive().describe('Betrag als Zahl'),
      recurrenceType: z.enum(['once', 'monthly', 'yearly']).describe('Wiederholungstyp'),
      startDate: z.string().describe('Startdatum im ISO-Format'),
    }),
    needsApproval: true,
    execute: async ({ accountId, source, amount, recurrenceType, startDate }) => {
      return createIncome({
        accountId,
        source,
        amount: amount.toString(),
        recurrenceType,
        startDate: new Date(startDate),
      });
    },
  }),

  getIncomes: tool({
    description: 'Gibt ALLE Einnahmen zurück (monthly, yearly, once). Nutze dies um dem Benutzer seine Einnahmen zu zeigen. Kann nach Konto oder Datum gefiltert werden.',
    inputSchema: z.object({
      accountId: z.uuid().optional().describe('Filter nach Konto-ID'),
      startDate: z.string().optional().describe('Filter ab Datum (ISO-Format)'),
      endDate: z.string().optional().describe('Filter bis Datum (ISO-Format)'),
    }),
    execute: async ({ accountId, startDate, endDate }) => {
      const filters: { accountId?: string; startDate?: Date; endDate?: Date } = {};
      if (accountId) filters.accountId = accountId;
      if (startDate) filters.startDate = new Date(startDate);
      if (endDate) filters.endDate = new Date(endDate);
      return getIncomes(filters);
    },
  }),

  updateIncome: tool({
    description: 'Aktualisiert eine bestehende Einnahme.',
    inputSchema: z.object({
      id: z.uuid().describe('ID der Einnahme'),
      source: z.string().optional().describe('Neue Quelle/Beschreibung'),
      amount: z.number().positive().optional().describe('Neuer Betrag'),
      recurrenceType: z.enum(['once', 'monthly', 'yearly']).optional(),
    }),
    needsApproval: true,
    execute: async ({ id, source, amount, recurrenceType }) => {
      const updateData: Record<string, unknown> = {};
      if (source !== undefined) updateData.source = source;
      if (amount !== undefined) updateData.amount = amount.toString();
      if (recurrenceType !== undefined) updateData.recurrenceType = recurrenceType;
      return updateIncome(id, updateData);
    },
  }),

  deleteIncome: tool({
    description: 'Löscht eine Einnahme.',
    inputSchema: z.object({
      id: z.uuid().describe('ID der zu löschenden Einnahme'),
    }),
    needsApproval: true,
    execute: async ({ id }) => {
      return deleteIncome(id);
    },
  }),

  getCategories: tool({
    description: 'Gibt alle verfügbaren Kategorien zurück.',
    inputSchema: z.object({}),
    execute: async () => {
      return getCategories();
    },
  }),

  createCategory: tool({
    description: 'Erstellt eine neue Kategorie für Ausgaben.',
    inputSchema: z.object({
      name: z.string().describe('Name der Kategorie'),
      icon: z.string().optional().describe('Emoji-Icon, z.B. "🏠"'),
      color: z.string().optional().describe('Farbe als Hex-Code, z.B. "#3b82f6"'),
    }),
    needsApproval: true,
    execute: async ({ name, icon, color }) => {
      return createCategory({ name, icon, color });
    },
  }),

  getMonthlyOverview: tool({
    description: 'Gibt eine kompakte Übersicht über Einnahmen, Ausgaben und Saldo für einen bestimmten Monat. Nutze immer den aktuellen Monat/Jahr aus dem Kontext, wenn kein anderer Monat genannt wird.',
    inputSchema: z.object({
      month: z.number().int().min(1).max(12).describe('Monat (1-12)'),
      year: z.number().int().min(2020).max(2100).describe('Jahr'),
    }),
    execute: async ({ month, year }) => {
      const result = await getMonthlyOverview(month, year);
      if (!result.success) return result;
      const { totalIncome, totalExpenses, balance, expenses, incomes } = result.data;
      return {
        success: true,
        data: {
          month,
          year,
          totalIncome: Math.round(totalIncome * 100) / 100,
          totalExpenses: Math.round(totalExpenses * 100) / 100,
          balance: Math.round(balance * 100) / 100,
          expenses: expenses.map((e) => ({
            name: e.name,
            amount: e.amount,
            recurrenceType: e.recurrenceType,
            startDate: e.startDate,
            endDate: e.endDate ?? null,
            category: e.category?.name ?? null,
          })),
          incomes: incomes.map((i) => ({
            source: i.source,
            amount: i.amount,
            recurrenceType: i.recurrenceType,
          })),
        },
      };
    },
  }),

  getForecast: tool({
    description: 'Erstellt eine Finanzprognose für die nächsten N Monate basierend auf aktuellen Einnahmen und Ausgaben.',
    inputSchema: z.object({
      months: z.number().int().min(1).max(24).describe('Anzahl der Monate für die Prognose'),
    }),
    execute: async ({ months }) => {
      return getForecast(months);
    },
  }),

  getCategoryBreakdown: tool({
    description: 'Gibt eine Aufschlüsselung der Ausgaben nach Kategorien für einen Zeitraum zurück.',
    inputSchema: z.object({
      startDate: z.string().describe('Startdatum im ISO-Format'),
      endDate: z.string().describe('Enddatum im ISO-Format'),
    }),
    execute: async ({ startDate, endDate }) => {
      return getCategoryBreakdown(new Date(startDate), new Date(endDate));
    },
  }),

  getNormalizedMonthlyExpenses: tool({
    description: 'Gibt alle periodischen Ausgaben zurück, normalisiert auf monatliche Beträge. Nützlich um die tatsächliche monatliche Belastung zu sehen.',
    inputSchema: z.object({}),
    execute: async () => {
      return getNormalizedMonthlyExpenses();
    },
  }),
};
