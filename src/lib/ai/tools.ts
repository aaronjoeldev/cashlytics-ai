import { tool } from "ai";
import { z } from "zod";
import { learnMerchantCategory } from "@/actions/merchant-category-actions";
import {
  getAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
} from "@/actions/account-actions";
import {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getDailyExpenses,
  createDailyExpense,
  deleteDailyExpense,
} from "@/actions/expense-actions";
import { getIncomes, createIncome, updateIncome, deleteIncome } from "@/actions/income-actions";
import { getCategories, createCategory } from "@/actions/category-actions";
import {
  getMonthlyOverview,
  getForecast,
  getCategoryBreakdown,
  getNormalizedMonthlyExpenses,
  getSubscriptions,
} from "@/actions/analytics-actions";
import { updateDailyExpense } from "@/actions/daily-expenses-actions";
import { getTransfers, createTransfer } from "@/actions/transfer-actions";
import { currencies, defaultCurrency } from "@/lib/currency";

export const tools = {
  createAccount: tool({
    description:
      "Erstellt ein neues Konto. Nutze dies wenn der Benutzer ein neues Konto anlegen möchte.",
    inputSchema: z.object({
      name: z.string().describe("Name des Kontos"),
      type: z
        .enum(["checking", "savings", "etf"])
        .describe("Kontotyp: checking=Girokonto, savings=Sparkonto, etf=ETF-Portfolio"),
      balance: z.string().optional().describe('Aktueller Kontostand als String, z.B. "1000.00"'),
      currency: z.string().optional().describe(`Währung, Standard ist ${defaultCurrency}`),
    }),
    needsApproval: true,
    execute: async ({ name, type, balance = "0", currency = defaultCurrency }) => {
      return createAccount({ name, type, balance, currency });
    },
  }),

  getAccounts: tool({
    description: "Gibt alle Konten des Benutzers zurück mit Kontostand und Typ.",
    inputSchema: z.object({}),
    execute: async () => {
      return getAccounts();
    },
  }),

  updateAccount: tool({
    description: "Aktualisiert ein bestehendes Konto.",
    inputSchema: z.object({
      id: z.uuid().describe("ID des Kontos"),
      name: z.string().optional().describe("Neuer Name des Kontos"),
      type: z.enum(["checking", "savings", "etf"]).optional().describe("Neuer Kontotyp"),
      balance: z.string().optional().describe("Neuer Kontostand"),
    }),
    needsApproval: true,
    execute: async ({ id, name, type, balance }) => {
      const data: { name?: string; type?: "checking" | "savings" | "etf"; balance?: string } = {};
      if (name !== undefined) data.name = name;
      if (type !== undefined) data.type = type;
      if (balance !== undefined) data.balance = balance;
      return updateAccount(id, data);
    },
  }),

  deleteAccount: tool({
    description: "Löscht ein Konto. Warnung: Dies löscht auch alle zugehörigen Transaktionen.",
    inputSchema: z.object({
      id: z.uuid().describe("ID des zu löschenden Kontos"),
    }),
    needsApproval: true,
    execute: async ({ id }) => {
      return deleteAccount(id);
    },
  }),

  createExpense: tool({
    description:
      "Erstellt eine WIEDERKEHRENDE Ausgabe (z.B. Miete, Netflix-Abo, Versicherung, Gym-Mitgliedschaft). NUR für Ausgaben nutzen, die sich regelmäßig wiederholen. Für einmalige Ausgaben (Einkauf, Tanken, Restaurant) IMMER createDailyExpense nutzen. Die accountId ist im Kontext bekannt – kein getAccounts nötig.",
    inputSchema: z.object({
      accountId: z.uuid().describe("ID des Kontos aus dem Kontext"),
      categoryId: z
        .uuid()
        .optional()
        .nullable()
        .describe("ID der Kategorie aus dem Kontext, optional"),
      name: z.string().describe("Name/Beschreibung der Ausgabe"),
      amount: z.number().positive().describe("Betrag als Zahl"),
      recurrenceType: z
        .enum(["daily", "weekly", "monthly", "quarterly", "semiannual", "yearly", "custom"])
        .describe(
          "Wiederholungstyp: daily=täglich, weekly=wöchentlich, monthly=monatlich, quarterly=quartalsweise, semiannual=halbjährlich, yearly=jährlich, custom=benutzerdefiniert"
        ),
      recurrenceInterval: z
        .number()
        .int()
        .positive()
        .optional()
        .nullable()
        .describe("Intervall für custom, z.B. alle 2 Wochen = 2"),
      startDate: z.string().describe('Startdatum im ISO-Format, z.B. "2024-01-01"'),
      endDate: z.string().optional().nullable().describe("Enddatum im ISO-Format, optional"),
      currency: z
        .enum(currencies)
        .optional()
        .describe(
          "Währungscode (ISO 4217). Nur setzen wenn explizit vom User erwähnt oder aus Kontext klar ersichtlich. Default: Kontowährung."
        ),
    }),
    needsApproval: true,
    execute: async ({
      accountId,
      categoryId,
      name,
      amount,
      recurrenceType,
      recurrenceInterval,
      startDate,
      endDate,
      currency,
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return createExpense({
        accountId,
        categoryId: categoryId ?? null,
        name,
        amount: amount.toString(),
        recurrenceType,
        recurrenceInterval: recurrenceInterval ?? null,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        ...(currency !== undefined && { currency }),
      } as any);
    },
  }),

  getExpenses: tool({
    description:
      'Gibt periodische/wiederkehrende Ausgaben zurück. Nutze name um nach einer bestimmten Ausgabe zu suchen (z.B. name="Autofinanzierung"). Ohne Filter werden alle zurückgegeben.',
    inputSchema: z.object({
      accountId: z.uuid().optional().describe("Filter nach Konto-ID"),
      categoryId: z.uuid().optional().describe("Filter nach Kategorie-ID"),
      name: z
        .string()
        .optional()
        .describe(
          'Suche nach Name/Beschreibung (Teilstring, case-insensitiv), z.B. "Miete" oder "Auto"'
        ),
      startDate: z.string().optional().describe("Filter ab Datum (ISO-Format)"),
      endDate: z.string().optional().describe("Filter bis Datum (ISO-Format)"),
    }),
    execute: async ({ accountId, categoryId, name, startDate, endDate }) => {
      const filters: {
        accountId?: string;
        categoryId?: string;
        name?: string;
        startDate?: Date;
        endDate?: Date;
      } = {};
      if (accountId) filters.accountId = accountId;
      if (categoryId) filters.categoryId = categoryId;
      if (name) filters.name = name;
      if (startDate) filters.startDate = new Date(startDate);
      if (endDate) filters.endDate = new Date(endDate);
      const result = await getExpenses(filters);
      if (!result.success) return result;
      // Explicit allowlist: only return fields the AI needs.
      // Documents are intentionally excluded — uploaded files (invoices, bank statements)
      // may contain sensitive personal data and must never reach the AI context.
      return {
        success: true,
        data: result.data.map((e) => ({
          id: e.id,
          name: e.name,
          amount: e.amount,
          recurrenceType: e.recurrenceType,
          recurrenceInterval: e.recurrenceInterval,
          startDate: e.startDate,
          endDate: e.endDate,
          isSubscription: e.isSubscription,
          info: e.info,
          category: e.category
            ? { id: e.category.id, name: e.category.name, icon: e.category.icon }
            : null,
          account: e.account
            ? { id: e.account.id, name: e.account.name, type: e.account.type }
            : null,
        })),
      };
    },
  }),

  updateExpense: tool({
    description: "Aktualisiert eine bestehende periodische Ausgabe.",
    inputSchema: z.object({
      id: z.uuid().describe("ID der Ausgabe"),
      name: z.string().optional().describe("Neuer Name"),
      amount: z.number().positive().optional().describe("Neuer Betrag"),
      recurrenceType: z
        .enum(["once", "daily", "weekly", "monthly", "quarterly", "semiannual", "yearly", "custom"])
        .optional(),
      endDate: z.string().optional().nullable().describe("Neues Enddatum"),
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
    description: "Löscht eine periodische Ausgabe.",
    inputSchema: z.object({
      id: z.uuid().describe("ID der zu löschenden Ausgabe"),
    }),
    needsApproval: true,
    execute: async ({ id }) => {
      return deleteExpense(id);
    },
  }),

  createDailyExpense: tool({
    description:
      "Erstellt eine einmalige Ausgabe (z.B. Einkauf, Tanken, Restaurant, einmalige Zahlung). Für wirklich wiederkehrende Ausgaben (Miete, Abo) nutze createExpense. Die accountId und categoryId sind im Kontext bekannt – kein getAccounts nötig.",
    inputSchema: z.object({
      accountId: z.uuid().describe("ID des Kontos aus dem Kontext"),
      categoryId: z
        .uuid()
        .optional()
        .nullable()
        .describe("ID der Kategorie aus dem Kontext, optional"),
      description: z.string().describe("Beschreibung der Ausgabe"),
      amount: z.number().positive().describe("Betrag als Zahl"),
      date: z.string().describe('Datum im ISO-Format, z.B. "2024-01-15"'),
      currency: z
        .enum(currencies)
        .optional()
        .describe(
          "Währungscode (ISO 4217). Nur setzen wenn explizit vom User erwähnt oder aus Kontext klar ersichtlich. Default: Kontowährung."
        ),
    }),
    needsApproval: true,
    execute: async ({ accountId, categoryId, description, amount, date, currency }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await createDailyExpense({
        accountId,
        categoryId: categoryId ?? null,
        description,
        amount: amount.toString(),
        date: new Date(date),
        ...(currency !== undefined && { currency }),
      } as any);

      // Learn merchant→category mapping for future suggestions
      if (result.success && categoryId) {
        await learnMerchantCategory(description, categoryId).catch(() => {});
      }

      return result;
    },
  }),

  getDailyExpenses: tool({
    description:
      'Gibt einmalige Ausgaben zurück. Nutze description um nach einer bestimmten Ausgabe zu suchen (z.B. description="REWE"). Ohne Filter werden alle zurückgegeben.',
    inputSchema: z.object({
      accountId: z.uuid().optional().describe("Filter nach Konto-ID"),
      categoryId: z.uuid().optional().describe("Filter nach Kategorie-ID"),
      description: z
        .string()
        .optional()
        .describe(
          'Suche nach Beschreibung (Teilstring, case-insensitiv), z.B. "REWE" oder "Tanken"'
        ),
      startDate: z.string().optional().describe("Filter ab Datum (ISO-Format)"),
      endDate: z.string().optional().describe("Filter bis Datum (ISO-Format)"),
      minAmount: z
        .number()
        .positive()
        .optional()
        .describe('Mindestbetrag als Zahl, z.B. 50 für "Ausgaben über 50€"'),
      maxAmount: z
        .number()
        .positive()
        .optional()
        .describe('Höchstbetrag als Zahl, z.B. 100 für "Ausgaben unter 100€"'),
    }),
    execute: async ({
      accountId,
      categoryId,
      description,
      startDate,
      endDate,
      minAmount,
      maxAmount,
    }) => {
      const filters: {
        accountId?: string;
        categoryId?: string;
        description?: string;
        startDate?: Date;
        endDate?: Date;
        minAmount?: number;
        maxAmount?: number;
      } = {};
      if (accountId) filters.accountId = accountId;
      if (categoryId) filters.categoryId = categoryId;
      if (description) filters.description = description;
      if (startDate) filters.startDate = new Date(startDate);
      if (endDate) filters.endDate = new Date(endDate);
      if (minAmount) filters.minAmount = minAmount;
      if (maxAmount) filters.maxAmount = maxAmount;
      const result = await getDailyExpenses(filters);
      if (!result.success) return result;
      // Explicit allowlist: only return fields the AI needs.
      // Documents are intentionally excluded — uploaded files (invoices, bank statements)
      // may contain sensitive personal data and must never reach the AI context.
      return {
        success: true,
        data: result.data.map((e) => ({
          id: e.id,
          description: e.description,
          amount: e.amount,
          date: e.date,
          info: e.info,
          category: e.category
            ? { id: e.category.id, name: e.category.name, icon: e.category.icon }
            : null,
          account: e.account
            ? { id: e.account.id, name: e.account.name, type: e.account.type }
            : null,
        })),
      };
    },
  }),

  deleteDailyExpense: tool({
    description: "Löscht eine tägliche Ausgabe.",
    inputSchema: z.object({
      id: z.uuid().describe("ID der zu löschenden Ausgabe"),
    }),
    needsApproval: true,
    execute: async ({ id }) => {
      return deleteDailyExpense(id);
    },
  }),

  updateDailyExpense: tool({
    description:
      "Aktualisiert eine bestehende einmalige Ausgabe. Nutze dies um Beschreibung, Betrag, Datum oder Kategorie einer täglichen Ausgabe zu korrigieren. Die ID der Ausgabe ist aus getDailyExpenses bekannt.",
    inputSchema: z.object({
      id: z.uuid().describe("ID der zu aktualisierenden Ausgabe"),
      description: z.string().optional().describe("Neue Beschreibung"),
      amount: z.number().positive().optional().describe("Neuer Betrag"),
      categoryId: z.uuid().optional().nullable().describe("Neue Kategorie-ID aus dem Kontext"),
      date: z.string().optional().describe("Neues Datum im ISO-Format"),
    }),
    needsApproval: true,
    execute: async ({ id, description, amount, categoryId, date }) => {
      const data: Record<string, unknown> = {};
      if (description !== undefined) data.description = description;
      if (amount !== undefined) data.amount = amount.toString();
      if (categoryId !== undefined) data.categoryId = categoryId;
      if (date !== undefined) data.date = new Date(date);
      return updateDailyExpense(id, data);
    },
  }),

  createIncome: tool({
    description:
      "Erstellt eine neue Einnahme (z.B. Gehalt, Nebenverdienst, Bonus). Die accountId ist im Kontext bekannt – kein getAccounts nötig.",
    inputSchema: z.object({
      accountId: z.uuid().describe("ID des Kontos aus dem Kontext"),
      source: z.string().describe('Quelle/Beschreibung der Einnahme, z.B. "Gehalt"'),
      amount: z.number().positive().describe("Betrag als Zahl"),
      recurrenceType: z.enum(["once", "monthly", "yearly"]).describe("Wiederholungstyp"),
      startDate: z.string().describe("Startdatum im ISO-Format"),
      currency: z
        .enum(currencies)
        .optional()
        .describe(
          "Währungscode (ISO 4217). Nur setzen wenn explizit vom User erwähnt oder aus Kontext klar ersichtlich. Default: Kontowährung."
        ),
    }),
    needsApproval: true,
    execute: async ({ accountId, source, amount, recurrenceType, startDate, currency }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return createIncome({
        accountId,
        source,
        amount: amount.toString(),
        recurrenceType,
        startDate: new Date(startDate),
        ...(currency !== undefined && { currency }),
      } as any);
    },
  }),

  getIncomes: tool({
    description:
      "Gibt ALLE Einnahmen zurück (monthly, yearly, once). Nutze dies um dem Benutzer seine Einnahmen zu zeigen. Kann nach Konto oder Datum gefiltert werden.",
    inputSchema: z.object({
      accountId: z.uuid().optional().describe("Filter nach Konto-ID"),
      startDate: z.string().optional().describe("Filter ab Datum (ISO-Format)"),
      endDate: z.string().optional().describe("Filter bis Datum (ISO-Format)"),
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
    description: "Aktualisiert eine bestehende Einnahme.",
    inputSchema: z.object({
      id: z.uuid().describe("ID der Einnahme"),
      source: z.string().optional().describe("Neue Quelle/Beschreibung"),
      amount: z.number().positive().optional().describe("Neuer Betrag"),
      recurrenceType: z.enum(["once", "monthly", "yearly"]).optional(),
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
    description: "Löscht eine Einnahme.",
    inputSchema: z.object({
      id: z.uuid().describe("ID der zu löschenden Einnahme"),
    }),
    needsApproval: true,
    execute: async ({ id }) => {
      return deleteIncome(id);
    },
  }),

  getCategories: tool({
    description: "Gibt alle verfügbaren Kategorien zurück.",
    inputSchema: z.object({}),
    execute: async () => {
      return getCategories();
    },
  }),

  createCategory: tool({
    description: "Erstellt eine neue Kategorie für Ausgaben.",
    inputSchema: z.object({
      name: z.string().describe("Name der Kategorie"),
      icon: z.string().optional().describe('Emoji-Icon, z.B. "🏠"'),
      color: z.string().optional().describe('Farbe als Hex-Code, z.B. "#3b82f6"'),
    }),
    needsApproval: true,
    execute: async ({ name, icon, color }) => {
      return createCategory({ name, icon, color });
    },
  }),

  getMonthlyOverview: tool({
    description:
      "Gibt eine kompakte Übersicht über Einnahmen, Ausgaben und Saldo für einen bestimmten Monat. Nutze immer den aktuellen Monat/Jahr aus dem Kontext, wenn kein anderer Monat genannt wird.",
    inputSchema: z.object({
      month: z.number().int().min(1).max(12).describe("Monat (1-12)"),
      year: z.number().int().min(2020).max(2100).describe("Jahr"),
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
    description:
      "Erstellt eine Finanzprognose für die nächsten N Monate basierend auf aktuellen Einnahmen und Ausgaben.",
    inputSchema: z.object({
      months: z.number().int().min(1).max(24).describe("Anzahl der Monate für die Prognose"),
    }),
    execute: async ({ months }) => {
      return getForecast(months);
    },
  }),

  getCategoryBreakdown: tool({
    description:
      "Gibt eine Aufschlüsselung der Ausgaben nach Kategorien für einen Zeitraum zurück.",
    inputSchema: z.object({
      startDate: z.string().describe("Startdatum im ISO-Format"),
      endDate: z.string().describe("Enddatum im ISO-Format"),
    }),
    execute: async ({ startDate, endDate }) => {
      return getCategoryBreakdown(new Date(startDate), new Date(endDate));
    },
  }),

  getNormalizedMonthlyExpenses: tool({
    description:
      "Gibt alle periodischen Ausgaben zurück, normalisiert auf monatliche Beträge. Nützlich um die tatsächliche monatliche Belastung zu sehen.",
    inputSchema: z.object({}),
    execute: async () => {
      return getNormalizedMonthlyExpenses();
    },
  }),

  getTransfers: tool({
    description:
      "Gibt Überweisungen zwischen Konten zurück. Kann nach Quell- oder Zielkonto und Zeitraum gefiltert werden.",
    inputSchema: z.object({
      sourceAccountId: z.uuid().optional().describe("Filter nach Quellkonto-ID"),
      targetAccountId: z.uuid().optional().describe("Filter nach Zielkonto-ID"),
      startDate: z.string().optional().describe("Filter ab Datum (ISO-Format)"),
      endDate: z.string().optional().describe("Filter bis Datum (ISO-Format)"),
    }),
    execute: async ({ sourceAccountId, targetAccountId, startDate, endDate }) => {
      const filters: {
        sourceAccountId?: string;
        targetAccountId?: string;
        startDate?: Date;
        endDate?: Date;
      } = {};
      if (sourceAccountId) filters.sourceAccountId = sourceAccountId;
      if (targetAccountId) filters.targetAccountId = targetAccountId;
      if (startDate) filters.startDate = new Date(startDate);
      if (endDate) filters.endDate = new Date(endDate);
      const result = await getTransfers(filters);
      if (!result.success) return result;
      return {
        success: true,
        data: result.data.map((t) => ({
          id: t.id,
          amount: t.amount,
          description: t.description,
          recurrenceType: t.recurrenceType,
          startDate: t.startDate,
          endDate: t.endDate ?? null,
          sourceAccount: t.sourceAccount
            ? { id: t.sourceAccount.id, name: t.sourceAccount.name }
            : null,
          targetAccount: t.targetAccount
            ? { id: t.targetAccount.id, name: t.targetAccount.name }
            : null,
        })),
      };
    },
  }),

  createTransfer: tool({
    description:
      "Erstellt eine Überweisung zwischen zwei Konten. sourceAccountId und targetAccountId müssen unterschiedlich sein. Die Konto-IDs sind im Kontext bekannt.",
    inputSchema: z.object({
      sourceAccountId: z.uuid().describe("ID des Quellkontos (von dem Geld abgeht)"),
      targetAccountId: z.uuid().describe("ID des Zielkontos (auf das Geld kommt)"),
      amount: z.number().positive().describe("Betrag als Zahl"),
      description: z.string().optional().describe("Optionale Beschreibung der Überweisung"),
      recurrenceType: z
        .enum(["once", "monthly", "quarterly", "yearly"])
        .describe(
          "Wiederholungstyp: once=einmalig, monthly=monatlich, quarterly=quartalsweise, yearly=jährlich"
        ),
      startDate: z.string().describe("Startdatum im ISO-Format"),
      endDate: z.string().optional().nullable().describe("Enddatum im ISO-Format, optional"),
    }),
    needsApproval: true,
    execute: async ({
      sourceAccountId,
      targetAccountId,
      amount,
      description,
      recurrenceType,
      startDate,
      endDate,
    }) => {
      return createTransfer({
        sourceAccountId,
        targetAccountId,
        amount: amount.toString(),
        description: description ?? null,
        recurrenceType,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
      });
    },
  }),

  getSubscriptions: tool({
    description:
      "Gibt alle Abonnements/Subscriptions des Benutzers zurück mit monatlichen und jährlichen Kosten. Nutze dies bei Fragen wie 'Welche Abos habe ich?' oder 'Was kosten meine Subscriptions?'",
    inputSchema: z.object({}),
    execute: async () => {
      const result = await getSubscriptions();
      if (!result.success) return result;
      const monthlyTotal = result.data.reduce((sum, s) => sum + s.monthlyAmount, 0);
      return {
        success: true,
        data: {
          subscriptions: result.data.map((s) => ({
            name: s.expense.name,
            amount: Number(s.expense.amount),
            monthlyAmount: Math.round(s.monthlyAmount * 100) / 100,
            recurrenceType: s.expense.recurrenceType,
            category: s.expense.category?.name ?? null,
          })),
          monthlyTotal: Math.round(monthlyTotal * 100) / 100,
          yearlyTotal: Math.round(monthlyTotal * 12 * 100) / 100,
        },
      };
    },
  }),

  compareMonths: tool({
    description:
      "Vergleicht zwei Monate miteinander: Einnahmen, Ausgaben, Saldo und Veränderung in Prozent. Nutze dies bei Fragen wie 'Vergleiche Mai mit April' oder 'Gebe ich mehr aus als letzten Monat?'",
    inputSchema: z.object({
      month1: z.number().int().min(1).max(12).describe("Erster Monat (1-12)"),
      year1: z.number().int().min(2020).max(2100).describe("Jahr des ersten Monats"),
      month2: z.number().int().min(1).max(12).describe("Zweiter Monat (1-12)"),
      year2: z.number().int().min(2020).max(2100).describe("Jahr des zweiten Monats"),
    }),
    execute: async ({ month1, year1, month2, year2 }) => {
      const [result1, result2] = await Promise.all([
        getMonthlyOverview(month1, year1),
        getMonthlyOverview(month2, year2),
      ]);
      if (!result1.success || !result2.success) {
        return { success: false, error: "Monatsdaten konnten nicht geladen werden." };
      }
      const d1 = result1.data;
      const d2 = result2.data;
      const pctChange = (a: number, b: number) =>
        b === 0 ? (a > 0 ? 100 : 0) : Math.round(((a - b) / b) * 10000) / 100;
      return {
        success: true,
        data: {
          month1: { month: month1, year: year1, income: d1.totalIncome, expenses: d1.totalExpenses, balance: d1.balance },
          month2: { month: month2, year: year2, income: d2.totalIncome, expenses: d2.totalExpenses, balance: d2.balance },
          changes: {
            incomeChange: pctChange(d1.totalIncome, d2.totalIncome),
            expensesChange: pctChange(d1.totalExpenses, d2.totalExpenses),
            balanceChange: pctChange(d1.balance, d2.balance),
          },
        },
      };
    },
  }),

  checkAffordability: tool({
    description:
      "Prüft ob sich der Benutzer eine bestimmte Ausgabe leisten kann. Vergleicht den gewünschten Betrag mit dem verfügbaren Budget (Einnahmen minus Ausgaben) des aktuellen Monats. Nutze dies bei Fragen wie 'Kann ich mir X leisten?' oder 'Habe ich noch Budget für Y?'",
    inputSchema: z.object({
      amount: z.number().positive().describe("Gewünschter Betrag"),
      description: z.string().optional().describe("Wofür das Geld ausgegeben werden soll"),
    }),
    execute: async ({ amount, description }) => {
      const now = new Date();
      const result = await getMonthlyOverview(now.getMonth() + 1, now.getFullYear());
      if (!result.success) return { success: false, error: "Monatsdaten nicht verfügbar." };
      const { totalIncome, totalExpenses, balance } = result.data;
      const remainingBudget = Math.round(balance * 100) / 100;
      const affordable = remainingBudget >= amount;
      return {
        success: true,
        data: {
          description: description ?? "Geplante Ausgabe",
          requestedAmount: amount,
          monthlyIncome: Math.round(totalIncome * 100) / 100,
          monthlyExpenses: Math.round(totalExpenses * 100) / 100,
          remainingBudget,
          affordable,
          remainingAfterPurchase: Math.round((remainingBudget - amount) * 100) / 100,
        },
      };
    },
  }),

  getSpendingSummary: tool({
    description:
      "Gibt eine kompakte Ausgaben-Zusammenfassung: Top-5-Kategorien, größte Einzelausgaben, und Vergleich zum Vormonat. Nutze dies für allgemeine Fragen wie 'Wie sieht es finanziell aus?' oder 'Zusammenfassung meiner Ausgaben'.",
    inputSchema: z.object({
      month: z.number().int().min(1).max(12).optional().describe("Monat (1-12), Standard: aktuell"),
      year: z.number().int().min(2020).max(2100).optional().describe("Jahr, Standard: aktuell"),
    }),
    execute: async ({ month, year }) => {
      const now = new Date();
      const targetMonth = month ?? now.getMonth() + 1;
      const targetYear = year ?? now.getFullYear();

      const prevMonth = targetMonth === 1 ? 12 : targetMonth - 1;
      const prevYear = targetMonth === 1 ? targetYear - 1 : targetYear;

      const startDate = new Date(Date.UTC(targetYear, targetMonth - 1, 1));
      const endDate = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59));

      const [overviewResult, prevOverviewResult, breakdownResult, dailyResult] = await Promise.all([
        getMonthlyOverview(targetMonth, targetYear),
        getMonthlyOverview(prevMonth, prevYear),
        getCategoryBreakdown(startDate, endDate),
        getDailyExpenses({}),
      ]);

      const topCategories = breakdownResult.success
        ? breakdownResult.data.slice(0, 5).map((c) => ({
            name: c.category.name,
            amount: Math.round(c.amount * 100) / 100,
            percentage: Math.round(c.percentage * 100) / 100,
          }))
        : [];

      const topExpenses = dailyResult.success
        ? dailyResult.data
            .filter((e) => {
              const d = new Date(e.date);
              return d >= startDate && d <= endDate;
            })
            .sort((a, b) => Number(b.amount) - Number(a.amount))
            .slice(0, 5)
            .map((e) => ({
              description: e.description,
              amount: Number(e.amount),
              date: new Date(e.date).toISOString().split("T")[0],
              category: e.category?.name ?? null,
            }))
        : [];

      const currentExpenses = overviewResult.success ? overviewResult.data.totalExpenses : 0;
      const prevExpenses = prevOverviewResult.success ? prevOverviewResult.data.totalExpenses : 0;
      const expenseChange =
        prevExpenses > 0
          ? Math.round(((currentExpenses - prevExpenses) / prevExpenses) * 10000) / 100
          : 0;

      return {
        success: true,
        data: {
          month: targetMonth,
          year: targetYear,
          totalExpenses: Math.round(currentExpenses * 100) / 100,
          totalIncome: overviewResult.success ? Math.round(overviewResult.data.totalIncome * 100) / 100 : 0,
          balance: overviewResult.success ? Math.round(overviewResult.data.balance * 100) / 100 : 0,
          expenseChangeVsPrevMonth: expenseChange,
          topCategories,
          topExpenses,
        },
      };
    },
  }),
};
