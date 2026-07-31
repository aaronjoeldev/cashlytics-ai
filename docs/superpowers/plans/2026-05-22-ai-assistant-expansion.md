# AI-Assistent Expansion — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den bestehenden KI-Finanzassistenten von einem CRUD-Chat zu einem intelligenten Finanzberater ausbauen — mit erweiterten Abfrage-Tools, lernfähiger Kategorisierung, angereichertem Kontext und proaktiven Insights.

**Architecture:** Schrittweise Erweiterung der bestehenden Tool-Calling-Architektur (Vercel AI SDK + OpenAI GPT-4o). Neue Server Actions liefern Daten an neue AI-Tools. Eine `merchant_categories`-Tabelle ermöglicht lernfähige Kategorisierung. Eine `insights`-Tabelle speichert proaktive Finanz-Insights, die in den System-Prompt injiziert werden. Der System-Prompt wird um Budget-Status, letzte Transaktionen und aktive Insights angereichert.

**Tech Stack:** Next.js 16, Vercel AI SDK 6, OpenAI GPT-4o, Drizzle ORM, PostgreSQL 16, Zod 4, TypeScript 5

---

## File Structure

### New files:
- `src/lib/db/schema.ts` — erweitern um `merchantCategories` + `insights` Tabellen
- `drizzle/XXXX_merchant_categories.sql` — Migration (auto-generiert via `drizzle-kit generate`)
- `drizzle/XXXX_insights.sql` — Migration (auto-generiert)
- `src/actions/merchant-category-actions.ts` — CRUD für Merchant-Mapping-Tabelle
- `src/actions/insights-actions.ts` — Insights generieren + abfragen
- `src/lib/ai/insight-tools.ts` — Neue AI-Tools für Insights + erweiterte Abfragen
- `src/app/api/cron/insights/route.ts` — Cron-Endpoint für tägliche Insight-Generierung
- `messages/de.json` / `messages/en.json` — Neue Übersetzungsschlüssel

### Modified files:
- `src/lib/ai/tools.ts` — Neue Tools registrieren
- `src/app/api/chat/route.ts` — System-Prompt anreichern, Tools erweitern
- `src/actions/expense-actions.ts` — Merchant-Learning-Hook nach Kategorie-Korrektur
- `src/components/organisms/chat-interface.tsx` — Neue Suggested Prompts, Insight-Banner
- `src/components/molecules/chat-message.tsx` — Insight-Karten-Rendering

---

## Phase 1: Erweiterte Abfrage-Tools

### Task 1: `getSubscriptions` AI-Tool

Gibt alle als Abo markierten Ausgaben zurück, mit monatlichen/jährlichen Kosten.

**Files:**
- Modify: `src/lib/ai/tools.ts`
- Uses: `src/actions/analytics-actions.ts:846-892` (existierende `getSubscriptions` Action)

- [ ] **Step 1: Tool-Definition hinzufügen**

In `src/lib/ai/tools.ts`, nach dem `createTransfer`-Tool (Zeile 618), das neue Tool einfügen:

```ts
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
```

- [ ] **Step 2: Import hinzufügen**

In `src/lib/ai/tools.ts`, den Import von `analytics-actions.ts` (Zeile 22-26) erweitern:

```ts
import {
  getMonthlyOverview,
  getForecast,
  getCategoryBreakdown,
  getNormalizedMonthlyExpenses,
  getSubscriptions,
} from "@/actions/analytics-actions";
```

- [ ] **Step 3: Manuell testen**

App starten, im Chat fragen: "Welche Abos habe ich?" — das Tool sollte aufgerufen werden und eine Liste zurückgeben.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/tools.ts
git commit -m "feat(ai): add getSubscriptions tool for subscription overview queries"
```

---

### Task 2: `compareMonths` AI-Tool

Vergleicht Einnahmen/Ausgaben zweier Monate.

**Files:**
- Modify: `src/lib/ai/tools.ts`
- Uses: `src/actions/analytics-actions.ts:67-192` (existierende `getMonthlyOverview`)

- [ ] **Step 1: Tool-Definition hinzufügen**

In `src/lib/ai/tools.ts`, nach `getSubscriptions`:

```ts
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
```

- [ ] **Step 2: Manuell testen**

Im Chat: "Vergleiche Mai mit April" — sollte beide Monate mit %-Veränderung zeigen.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/tools.ts
git commit -m "feat(ai): add compareMonths tool for month-over-month analysis"
```

---

### Task 3: `checkAffordability` AI-Tool

Prüft ob eine geplante Ausgabe ins Budget passt.

**Files:**
- Modify: `src/lib/ai/tools.ts`

- [ ] **Step 1: Tool-Definition hinzufügen**

```ts
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
```

- [ ] **Step 2: Manuell testen**

Im Chat: "Kann ich mir eine PS5 für 500€ leisten?" — sollte Budget prüfen und antworten.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/tools.ts
git commit -m "feat(ai): add checkAffordability tool for budget feasibility checks"
```

---

### Task 4: `getSpendingSummary` AI-Tool

Kompakte Zusammenfassung: Top-Ausgaben, Kategorie-Ranking, Vergleich zum Vormonat.

**Files:**
- Modify: `src/lib/ai/tools.ts`

- [ ] **Step 1: Tool-Definition hinzufügen**

```ts
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
    const expenseChange = prevExpenses > 0
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
```

- [ ] **Step 2: Import `getDailyExpenses` hinzufügen**

Prüfen ob `getDailyExpenses` bereits importiert ist in `tools.ts` (Zeile 14). Falls ja, ist dieser Schritt erledigt.

- [ ] **Step 3: Manuell testen**

Im Chat: "Gib mir eine Zusammenfassung meiner Ausgaben" — sollte Top-Kategorien und -Ausgaben zeigen.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/tools.ts
git commit -m "feat(ai): add getSpendingSummary tool for compact financial overviews"
```

---

### Task 5: System-Prompt-Regeln für neue Tools aktualisieren

**Files:**
- Modify: `src/app/api/chat/route.ts:91-97`

- [ ] **Step 1: Tool-Wahl-Sektion im System-Prompt erweitern**

In `src/app/api/chat/route.ts`, den Abschnitt `## TOOL-WAHL FÜR ABFRAGEN` (Zeile 91-97) ersetzen:

```ts
## TOOL-WAHL FÜR ABFRAGEN

- "Wie hoch sind meine Einnahmen?" → getIncomes (ohne Filter)
- "Wie viel Geld habe ich diesen Monat?" → getMonthlyOverview mit aktuellem Monat/Jahr aus Kontext
- "Wie viel ausgegeben?" → getMonthlyOverview
- "Alle Konten zeigen" → Kontext-Abschnitt direkt nutzen, kein Tool nötig
- "Welche Abos habe ich?" / "Meine Subscriptions" → getSubscriptions
- "Vergleiche Mai mit April" / "Mehr ausgegeben als letzten Monat?" → compareMonths
- "Kann ich mir X leisten?" / "Habe ich Budget für Y?" → checkAffordability
- "Zusammenfassung" / "Wie sieht es finanziell aus?" → getSpendingSummary
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat(ai): update system prompt with routing rules for new query tools"
```

---

## Phase 2: Angereicherter System-Prompt-Kontext

### Task 6: Letzte Transaktionen + Budget-Status in den Kontext injizieren

**Files:**
- Modify: `src/app/api/chat/route.ts:113-175` (`buildSystemPrompt`)

- [ ] **Step 1: Imports erweitern**

In `src/app/api/chat/route.ts`, die Imports (Zeile 4-7) erweitern:

```ts
import { getAccounts } from "@/actions/account-actions";
import { getCategories } from "@/actions/category-actions";
import { getExpenses } from "@/actions/expense-actions";
import { getDailyExpenses } from "@/actions/expense-actions";
import { getIncomes } from "@/actions/income-actions";
import { getDashboardStats } from "@/actions/dashboard-actions";
import { currencies } from "@/lib/currency";
```

- [ ] **Step 2: `buildSystemPrompt` erweitern**

In `src/app/api/chat/route.ts`, innerhalb von `buildSystemPrompt()`, den `Promise.all`-Block (Zeile 125-129) erweitern:

```ts
const [accountsResult, categoriesResult, expensesResult, dashboardResult, recentDailyResult, incomesResult] = await Promise.all([
  getAccounts(),
  getCategories(),
  getExpenses(),
  getDashboardStats(),
  getDailyExpenses({ startDate: new Date(today.getFullYear(), today.getMonth(), 1) }),
  getIncomes(),
]);
```

- [ ] **Step 3: Neue Kontext-Sektionen anhängen**

Am Ende der `buildSystemPrompt`-Funktion (vor dem finalen `return`), die neuen Sektionen hinzufügen:

```ts
const dashboardContext = dashboardResult.success
  ? `### Budget-Status (aktueller Monat):
  - Einnahmen: ${Math.round(dashboardResult.data.reserveView.monthlyIncome * 100) / 100}
  - Ausgaben: ${Math.round(dashboardResult.data.reserveView.monthlyExpenses * 100) / 100}
  - Sparrate: ${Math.round(dashboardResult.data.reserveView.savingsRate * 100) / 100}
  - Gesamtvermögen: ${Math.round(dashboardResult.data.totalAssets * 100) / 100}
  - Einnahmen-Trend: ${dashboardResult.data.reserveView.incomeTrend > 0 ? "+" : ""}${Math.round(dashboardResult.data.reserveView.incomeTrend * 100) / 100}%
  - Ausgaben-Trend: ${dashboardResult.data.reserveView.expenseTrend > 0 ? "+" : ""}${Math.round(dashboardResult.data.reserveView.expenseTrend * 100) / 100}%`
  : "";

const recentExpensesContext =
  recentDailyResult.success && recentDailyResult.data.length > 0
    ? `### Letzte Ausgaben (aktueller Monat):
${recentDailyResult.data
  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  .slice(0, 10)
  .map((e) => `  - ${new Date(e.date).toLocaleDateString("de-DE")}: "${sanitizeForPrompt(e.description)}" ${e.amount}€${e.category ? ` [${sanitizeForPrompt(e.category.name)}]` : ""}`)
  .join("\n")}`
    : "";

const incomesContext =
  incomesResult.success && incomesResult.data.length > 0
    ? `### Bestehende Einnahmen:
${incomesResult.data
  .map((i) => `  - "${sanitizeForPrompt(i.source)}" | ${i.amount}€ | ${i.recurrenceType} | ID: ${i.id}`)
  .join("\n")}`
    : "";
```

- [ ] **Step 4: Return-Statement anpassen**

Das bestehende `return`-Statement in `buildSystemPrompt` erweitern, sodass die neuen Sektionen angehängt werden:

```ts
return `${BASE_SYSTEM_PROMPT}

## AKTUELLER KONTEXT

Heutiges Datum: ${dateStr} (ISO: ${isoDate})
Aktueller Monat: ${currentMonth}, Jahr: ${currentYear}

### Verfügbare Konten:
${accountsContext}

### Verfügbare Kategorien:
${categoriesContext}

### Bestehende periodische Ausgaben (für Updates/Löschungen direkt ID verwenden, kein getExpenses nötig):
${expensesContext}

${incomesContext}

${dashboardContext}

${recentExpensesContext}`;
```

- [ ] **Step 5: Manuell testen**

Im Chat fragen: "Wie sieht mein Budget gerade aus?" — Die Antwort sollte spezifische Zahlen zum aktuellen Monat enthalten, ohne ein Tool aufzurufen.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat(ai): enrich system prompt with budget status, recent expenses, and incomes"
```

---

## Phase 3: Lernfähige Kategorisierung

### Task 7: `merchant_categories` DB-Tabelle

**Files:**
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Tabelle + Relations definieren**

In `src/lib/db/schema.ts`, vor den Type-Exports (Zeile 587), die neue Tabelle einfügen:

```ts
export const merchantCategories = pgTable("merchant_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  merchantPattern: text("merchant_pattern").notNull(),
  categoryId: uuid("category_id")
    .references(() => categories.id, { onDelete: "cascade" })
    .notNull(),
  usageCount: integer("usage_count").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueUserMerchant: unique().on(table.userId, table.merchantPattern),
}));

export const merchantCategoriesRelations = relations(merchantCategories, ({ one }) => ({
  user: one(users, {
    fields: [merchantCategories.userId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [merchantCategories.categoryId],
    references: [categories.id],
  }),
}));
```

- [ ] **Step 2: Type-Exports hinzufügen**

Am Ende der Type-Exports in `schema.ts`:

```ts
export type MerchantCategory = typeof merchantCategories.$inferSelect;
export type NewMerchantCategory = typeof merchantCategories.$inferInsert;
```

- [ ] **Step 3: User-Relations erweitern**

In `usersRelations` (Zeile 119-137), `merchantCategories: many(merchantCategories),` hinzufügen.

- [ ] **Step 4: Migration generieren**

```bash
npx drizzle-kit generate
```

- [ ] **Step 5: Migration anwenden**

```bash
npx drizzle-kit push
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/schema.ts drizzle/
git commit -m "feat(db): add merchant_categories table for learning category mappings"
```

---

### Task 8: Merchant-Category Server Actions

**Files:**
- Create: `src/actions/merchant-category-actions.ts`

- [ ] **Step 1: Datei erstellen**

```ts
"use server";

import { db } from "@/lib/db";
import { merchantCategories, categories } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/require-auth";
import type { ApiResponse } from "@/types/database";

/**
 * Finds the best matching category for a merchant description.
 * Returns null if no learned mapping exists.
 */
export async function suggestCategoryForMerchant(
  description: string
): Promise<ApiResponse<{ categoryId: string; categoryName: string; confidence: number } | null>> {
  const auth = await requireAuth();
  if (auth.error) return { success: false, error: "Unauthorized" };
  const { userId } = auth;

  try {
    const normalized = description.toLowerCase().trim();

    const mappings = await db
      .select({
        merchantPattern: merchantCategories.merchantPattern,
        categoryId: merchantCategories.categoryId,
        categoryName: categories.name,
        usageCount: merchantCategories.usageCount,
      })
      .from(merchantCategories)
      .innerJoin(categories, eq(merchantCategories.categoryId, categories.id))
      .where(eq(merchantCategories.userId, userId));

    let bestMatch: { categoryId: string; categoryName: string; confidence: number } | null = null;
    let bestScore = 0;

    for (const mapping of mappings) {
      const pattern = mapping.merchantPattern.toLowerCase();
      if (normalized.includes(pattern) || pattern.includes(normalized)) {
        const score = mapping.usageCount;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = {
            categoryId: mapping.categoryId,
            categoryName: mapping.categoryName,
            confidence: Math.min(score / 5, 1),
          };
        }
      }
    }

    return { success: true, data: bestMatch };
  } catch (error) {
    return { success: false, error: `Fehler: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * Records or updates a merchant→category mapping.
 * Called when user confirms a category for a daily expense.
 */
export async function learnMerchantCategory(
  merchantPattern: string,
  categoryId: string
): Promise<ApiResponse<{ learned: boolean }>> {
  const auth = await requireAuth();
  if (auth.error) return { success: false, error: "Unauthorized" };
  const { userId } = auth;

  try {
    const normalized = merchantPattern.toLowerCase().trim();
    if (!normalized) return { success: true, data: { learned: false } };

    await db
      .insert(merchantCategories)
      .values({ userId, merchantPattern: normalized, categoryId })
      .onConflictDoUpdate({
        target: [merchantCategories.userId, merchantCategories.merchantPattern],
        set: {
          categoryId,
          usageCount: sql`${merchantCategories.usageCount} + 1`,
          updatedAt: new Date(),
        },
      });

    return { success: true, data: { learned: true } };
  } catch (error) {
    return { success: false, error: `Fehler: ${error instanceof Error ? error.message : String(error)}` };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/actions/merchant-category-actions.ts
git commit -m "feat(ai): add merchant-category learning actions"
```

---

### Task 9: Merchant-Learning in Daily-Expense-Erstellung integrieren

**Files:**
- Modify: `src/lib/ai/tools.ts` — `createDailyExpense` Tool

- [ ] **Step 1: Import hinzufügen**

In `src/lib/ai/tools.ts`:

```ts
import { learnMerchantCategory, suggestCategoryForMerchant } from "@/actions/merchant-category-actions";
```

- [ ] **Step 2: `createDailyExpense` Tool erweitern**

Den `execute`-Block des `createDailyExpense`-Tools (Zeile 255-265) ersetzen:

```ts
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
```

- [ ] **Step 3: `suggestCategoryForMerchant` in den System-Prompt-Kontext einbauen**

In `src/app/api/chat/route.ts`, innerhalb von `buildSystemPrompt()`, die Merchant-Mappings laden und als Kontext anhängen. Vor dem `return`-Statement:

```ts
// Lade gelernte Merchant-Mappings für Kategorie-Vorschläge
const { suggestCategoryForMerchant: _suggest } = await import("@/actions/merchant-category-actions");
// Wir fügen stattdessen eine Anweisung zum System-Prompt hinzu
```

Dann im System-Prompt (`BASE_SYSTEM_PROMPT`), unter `## KATEGORIEN-PFLICHT`, einen Hinweis ergänzen:

```
Bevor du den Benutzer nach einer Kategorie fragst, versuche basierend auf der Beschreibung eine bekannte Kategorie aus dem Kontext zuzuordnen. Wenn der Benutzer z.B. "REWE" sagt und eine Kategorie "Lebensmittel" existiert, schlage diese direkt vor.
```

- [ ] **Step 4: Manuell testen**

1. Im Chat: "20€ bei REWE" → Benutzer bestätigt "Lebensmittel"
2. Nochmal: "15€ bei REWE" → Sollte automatisch "Lebensmittel" vorschlagen

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/tools.ts src/app/api/chat/route.ts
git commit -m "feat(ai): integrate merchant-category learning into expense creation"
```

---

## Phase 4: Proaktive Insights-Engine

### Task 10: `insights` DB-Tabelle

**Files:**
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Enum + Tabelle definieren**

In `src/lib/db/schema.ts`, vor den Type-Exports:

```ts
export const insightTypeEnum = pgEnum("insight_type", [
  "spending_anomaly",
  "budget_warning",
  "saving_opportunity",
  "subscription_alert",
  "trend_info",
]);

export const insights = pgTable("insights", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  type: insightTypeEnum("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  severity: text("severity", { enum: ["info", "warning", "critical"] }).notNull().default("info"),
  isRead: boolean("is_read").default(false).notNull(),
  expiresAt: timestamp("expires_at"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insightsRelations = relations(insights, ({ one }) => ({
  user: one(users, {
    fields: [insights.userId],
    references: [users.id],
  }),
}));
```

- [ ] **Step 2: Type-Exports**

```ts
export type Insight = typeof insights.$inferSelect;
export type NewInsight = typeof insights.$inferInsert;
```

- [ ] **Step 3: User-Relations erweitern**

In `usersRelations`: `insights: many(insights),` hinzufügen.

- [ ] **Step 4: Migration generieren + anwenden**

```bash
npx drizzle-kit generate && npx drizzle-kit push
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/schema.ts drizzle/
git commit -m "feat(db): add insights table for proactive financial insights"
```

---

### Task 11: Insights-Generierung Server Actions

**Files:**
- Create: `src/actions/insights-actions.ts`

- [ ] **Step 1: Datei erstellen**

```ts
"use server";

import { db } from "@/lib/db";
import {
  insights,
  expenses,
  dailyExpenses,
  incomes,
  categories,
} from "@/lib/db/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/require-auth";
import { safeParseFloat } from "@/lib/safe-parse";
import type { ApiResponse } from "@/types/database";
import type { Insight } from "@/lib/db/schema";

/**
 * Returns active (unread, unexpired) insights for the current user.
 */
export async function getActiveInsights(): Promise<ApiResponse<Insight[]>> {
  const auth = await requireAuth();
  if (auth.error) return { success: false, error: "Unauthorized" };
  const { userId } = auth;

  try {
    const now = new Date();
    const result = await db
      .select()
      .from(insights)
      .where(
        and(
          eq(insights.userId, userId),
          eq(insights.isRead, false),
          sql`(${insights.expiresAt} IS NULL OR ${insights.expiresAt} > ${now.toISOString()})`
        )
      )
      .orderBy(desc(insights.createdAt))
      .limit(10);

    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: `Fehler: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * Marks an insight as read.
 */
export async function markInsightRead(insightId: string): Promise<ApiResponse<{ ok: boolean }>> {
  const auth = await requireAuth();
  if (auth.error) return { success: false, error: "Unauthorized" };
  const { userId } = auth;

  try {
    await db
      .update(insights)
      .set({ isRead: true })
      .where(and(eq(insights.id, insightId), eq(insights.userId, userId)));
    return { success: true, data: { ok: true } };
  } catch (error) {
    return { success: false, error: `Fehler: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * Generates insights by analyzing user's financial data.
 * Called by cron job or on-demand.
 */
export async function generateInsights(userId: string): Promise<{ generated: number }> {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const expiresAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  let generated = 0;
  const newInsights: Array<typeof insights.$inferInsert> = [];

  // --- Spending Anomaly Detection ---
  // Compare current month category totals vs. 3-month average
  const currentDailyByCategory = await db
    .select({
      categoryId: dailyExpenses.categoryId,
      categoryName: categories.name,
      total: sql<string>`SUM(CAST(${dailyExpenses.amount} AS numeric))`,
    })
    .from(dailyExpenses)
    .leftJoin(categories, eq(dailyExpenses.categoryId, categories.id))
    .where(
      and(
        eq(dailyExpenses.userId, userId),
        gte(dailyExpenses.date, currentMonthStart),
        lte(dailyExpenses.date, currentMonthEnd)
      )
    )
    .groupBy(dailyExpenses.categoryId, categories.name);

  const threeMonthsAgoStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const avgDailyByCategory = await db
    .select({
      categoryId: dailyExpenses.categoryId,
      categoryName: categories.name,
      avgMonthly: sql<string>`SUM(CAST(${dailyExpenses.amount} AS numeric)) / 3`,
    })
    .from(dailyExpenses)
    .leftJoin(categories, eq(dailyExpenses.categoryId, categories.id))
    .where(
      and(
        eq(dailyExpenses.userId, userId),
        gte(dailyExpenses.date, threeMonthsAgoStart),
        lte(dailyExpenses.date, lastMonthEnd)
      )
    )
    .groupBy(dailyExpenses.categoryId, categories.name);

  const avgMap = new Map(avgDailyByCategory.map((a) => [a.categoryId, safeParseFloat(a.avgMonthly)]));

  for (const current of currentDailyByCategory) {
    const avg = avgMap.get(current.categoryId) ?? 0;
    const currentTotal = safeParseFloat(current.total);
    if (avg > 0 && currentTotal > avg * 1.5 && currentTotal > 50) {
      const pctOver = Math.round(((currentTotal - avg) / avg) * 100);
      newInsights.push({
        userId,
        type: "spending_anomaly",
        title: `${current.categoryName}: ${pctOver}% über Durchschnitt`,
        message: `Du hast diesen Monat ${Math.round(currentTotal)}€ für "${current.categoryName}" ausgegeben — das sind ${pctOver}% mehr als dein 3-Monats-Durchschnitt von ${Math.round(avg)}€.`,
        severity: pctOver > 100 ? "warning" : "info",
        expiresAt,
      });
    }
  }

  // --- Budget Warning ---
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthProgress = dayOfMonth / daysInMonth;

  const totalCurrentExpenses = currentDailyByCategory.reduce(
    (sum, c) => sum + safeParseFloat(c.total), 0
  );
  const totalAvgExpenses = Array.from(avgMap.values()).reduce((sum, v) => sum + v, 0);

  if (totalAvgExpenses > 0 && totalCurrentExpenses > totalAvgExpenses * monthProgress * 1.2) {
    const projected = Math.round((totalCurrentExpenses / monthProgress));
    newInsights.push({
      userId,
      type: "budget_warning",
      title: "Ausgaben-Tempo über Plan",
      message: `Bei aktuellem Tempo wirst du diesen Monat ca. ${projected}€ ausgeben — ${Math.round(((projected / totalAvgExpenses) - 1) * 100)}% mehr als üblich (${Math.round(totalAvgExpenses)}€).`,
      severity: "warning",
      expiresAt,
    });
  }

  // Insert new insights (skip duplicates by checking title)
  for (const insight of newInsights) {
    const existing = await db
      .select({ id: insights.id })
      .from(insights)
      .where(
        and(
          eq(insights.userId, userId),
          eq(insights.title, insight.title),
          gte(insights.createdAt, currentMonthStart)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(insights).values(insight);
      generated++;
    }
  }

  return { generated };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/actions/insights-actions.ts
git commit -m "feat(ai): add insights generation engine with anomaly and budget warnings"
```

---

### Task 12: Cron-Endpoint für Insight-Generierung

**Files:**
- Create: `src/app/api/cron/insights/route.ts`

- [ ] **Step 1: Datei erstellen**

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { generateInsights } from "@/actions/insights-actions";
import { logger } from "@/lib/logger";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const allUsers = await db.select({ id: users.id }).from(users);
    let totalGenerated = 0;

    for (const user of allUsers) {
      const result = await generateInsights(user.id);
      totalGenerated += result.generated;
    }

    logger.info(`Insights generated: ${totalGenerated} for ${allUsers.length} users`, "cron/insights");
    return NextResponse.json({ success: true, totalGenerated, users: allUsers.length });
  } catch (error) {
    logger.error("Cron insights failed", "cron/insights", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/cron/insights/route.ts
git commit -m "feat(ai): add cron endpoint for daily insight generation"
```

---

### Task 13: Insights in den System-Prompt injizieren

**Files:**
- Modify: `src/app/api/chat/route.ts`

- [ ] **Step 1: Import hinzufügen**

```ts
import { getActiveInsights } from "@/actions/insights-actions";
```

- [ ] **Step 2: Insights laden in `buildSystemPrompt`**

Im `Promise.all`-Block `getActiveInsights()` hinzufügen und das Ergebnis als Kontext anhängen:

```ts
const insightsResult = await getActiveInsights();
```

- [ ] **Step 3: Kontext-Sektion für Insights**

```ts
const insightsContext =
  insightsResult.success && insightsResult.data.length > 0
    ? `### Aktuelle Finanz-Insights (proaktiv erwähnen wenn relevant):
${insightsResult.data
  .map((i) => `  - [${i.severity.toUpperCase()}] ${sanitizeForPrompt(i.title)}: ${sanitizeForPrompt(i.message)}`)
  .join("\n")}`
    : "";
```

- [ ] **Step 4: Im Return anhängen**

Am Ende des Kontext-Strings `${insightsContext}` anhängen.

- [ ] **Step 5: System-Prompt-Anweisung ergänzen**

Im `BASE_SYSTEM_PROMPT`, unter `## VERHALTEN`, Punkt 3 ("Proaktiv") erweitern:

```
3. Proaktiv: Bei Ausgaben-Erwähnung sofort das passende Tool aufrufen. Wenn Insights im Kontext vorhanden sind, erwähne relevante Insights proaktiv zu Beginn des Gesprächs oder wenn sie zur Frage des Benutzers passen. Beispiel: "Übrigens, deine Restaurant-Ausgaben liegen 50% über dem Durchschnitt diesen Monat."
```

- [ ] **Step 6: Manuell testen**

1. Cron-Endpoint aufrufen: `curl http://localhost:3000/api/cron/insights`
2. Im Chat eine Frage stellen — Insights sollten proaktiv erwähnt werden

- [ ] **Step 7: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat(ai): inject active insights into system prompt for proactive mentions"
```

---

### Task 14: `getInsights` AI-Tool

**Files:**
- Modify: `src/lib/ai/tools.ts`

- [ ] **Step 1: Import hinzufügen**

```ts
import { getActiveInsights, markInsightRead } from "@/actions/insights-actions";
```

- [ ] **Step 2: Tool-Definition**

```ts
getInsights: tool({
  description:
    "Gibt aktuelle Finanz-Insights und Warnungen zurück (Ausgaben-Anomalien, Budget-Warnungen, Spar-Chancen). Nutze dies bei Fragen wie 'Gibt es etwas Auffälliges?' oder 'Was sollte ich beachten?'",
  inputSchema: z.object({}),
  execute: async () => {
    return getActiveInsights();
  },
}),

markInsightRead: tool({
  description: "Markiert einen Insight als gelesen/erledigt.",
  inputSchema: z.object({
    insightId: z.uuid().describe("ID des Insights"),
  }),
  needsApproval: true,
  execute: async ({ insightId }) => {
    return markInsightRead(insightId);
  },
}),
```

- [ ] **Step 3: System-Prompt Tool-Routing erweitern**

```
- "Gibt es etwas Auffälliges?" / "Was sollte ich beachten?" → getInsights
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/tools.ts src/app/api/chat/route.ts
git commit -m "feat(ai): add getInsights and markInsightRead tools"
```

---

## Phase 5: Chat-UI-Erweiterungen

### Task 15: Suggested Prompts aktualisieren

**Files:**
- Modify: `src/components/organisms/chat-interface.tsx:28-32`

- [ ] **Step 1: Neue Suggested Prompts**

Die `SUGGESTED_PROMPTS` (Zeile 28-32) ersetzen:

```ts
import { MessageSquare, Sparkles, TrendingUp, CreditCard, AlertCircle } from 'lucide-react';

const SUGGESTED_PROMPTS = [
  { icon: Sparkles, text: 'Wie sieht es finanziell aus?' },
  { icon: CreditCard, text: 'Welche Abos habe ich?' },
  { icon: TrendingUp, text: 'Vergleiche diesen Monat mit dem letzten' },
  { icon: AlertCircle, text: 'Gibt es etwas Auffälliges bei meinen Ausgaben?' },
  { icon: MessageSquare, text: 'Ich habe 45€ bei REWE ausgegeben' },
];
```

- [ ] **Step 2: Welcome-Text anpassen**

Den `WELCOME_TEXT` (Zeile 12-20) ersetzen:

```ts
const WELCOME_TEXT = `Hallo! Ich bin dein Cashlytics Assistent.

Ich kann dir bei deinen Finanzen helfen:

• Ausgaben erfassen: "45€ Tanken"
• Budget prüfen: "Kann ich mir X leisten?"
• Trends analysieren: "Vergleiche Mai mit April"
• Abos überblicken: "Welche Subscriptions habe ich?"
• Insights zeigen: "Gibt es etwas Auffälliges?"

Wie kann ich dir helfen?`;
```

- [ ] **Step 3: Commit**

```bash
git add src/components/organisms/chat-interface.tsx
git commit -m "feat(ui): update chat suggested prompts and welcome text for new capabilities"
```

---

### Task 16: Übersetzungen synchronisieren

**Files:**
- Modify: `messages/de.json`, `messages/en.json`

- [ ] **Step 1: Sync-Translations Skill ausführen**

```
/sync-translations
```

Dies erkennt automatisch fehlende Schlüssel für neue UI-Texte und synchronisiert beide Sprachdateien.

- [ ] **Step 2: Commit**

```bash
git add messages/
git commit -m "chore(i18n): sync translation files for AI assistant expansion"
```

---

## Zusammenfassung der Ergebnisse

Nach Abschluss aller Tasks hat der AI-Assistent:

| Fähigkeit | Vorher | Nachher |
|---|---|---|
| **Tools** | 25 (CRUD + 4 Analytics) | 31 (+Subscriptions, Compare, Affordability, Summary, Insights, MarkRead) |
| **Kontext im Prompt** | Konten, Kategorien, periodische Ausgaben | + Budget-Status, letzte Transaktionen, Einnahmen, aktive Insights |
| **Kategorisierung** | Manuell via Prompt-Logik | Lernfähig via `merchant_categories` DB-Tabelle |
| **Proaktive Insights** | Keine | Spending-Anomalien, Budget-Warnungen via Cron |
| **Suggested Prompts** | 3 (einfach) | 5 (erweitert mit neuen Fähigkeiten) |
