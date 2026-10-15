import { db } from "@/lib/db";
import { insights, dailyExpenses, categories, userSettings } from "@/lib/db/schema";
import { eq, and, gte, lt, like, min, notInArray, sql } from "drizzle-orm";
import { currencies, defaultCurrency, type Currency } from "@/lib/currency";
import { computeInsights, HISTORY_MONTHS, monthKey } from "@/lib/insights/compute-insights";
import { getAllRates } from "@/lib/exchange-rates";

/**
 * Generates insights by analyzing user's financial data.
 * Called by the insights cron route only. Kept out of `src/actions` because every export of a
 * "use server" file is a public endpoint, and this one takes the user id as an argument.
 *
 * Each finding has a key per month: a later run updates its text instead of adding a copy, and an
 * unread finding that no longer applies is removed.
 */
export async function generateInsights(
  userId: string,
  now: Date = new Date()
): Promise<{ generated: number }> {
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const historyStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - HISTORY_MONTHS, 1)
  );

  const [[settings], [first]] = await Promise.all([
    db
      .select({ baseCurrency: userSettings.baseCurrency })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1),
    db
      .select({ date: min(dailyExpenses.date) })
      .from(dailyExpenses)
      .where(eq(dailyExpenses.userId, userId)),
  ]);

  const baseCurrency =
    settings && currencies.includes(settings.baseCurrency as Currency)
      ? (settings.baseCurrency as Currency)
      : defaultCurrency;

  const rows = await db
    .select({
      categoryId: dailyExpenses.categoryId,
      categoryName: categories.name,
      amount: dailyExpenses.amount,
      currency: dailyExpenses.currency,
      date: dailyExpenses.date,
    })
    .from(dailyExpenses)
    .leftJoin(categories, eq(dailyExpenses.categoryId, categories.id))
    .where(
      and(
        eq(dailyExpenses.userId, userId),
        gte(dailyExpenses.date, historyStart),
        lt(dailyExpenses.date, nextMonthStart)
      )
    );

  const computed = computeInsights({
    now,
    baseCurrency,
    rates: await getAllRates(),
    firstExpenseDate: first?.date ?? null,
    rows,
  });

  let generated = 0;
  for (const insight of computed) {
    const [row] = await db
      .insert(insights)
      .values({ userId, ...insight, expiresAt: nextMonthStart })
      .onConflictDoUpdate({
        target: [insights.userId, insights.dedupKey],
        set: { title: insight.title, message: insight.message, severity: insight.severity },
      })
      // xmax is 0 for a freshly inserted row and set for one the conflict clause updated
      .returning({ inserted: sql<boolean>`(xmax = 0)` });
    if (row?.inserted) generated++;
  }

  const keys = computed.map((i) => i.dedupKey);
  await db
    .delete(insights)
    .where(
      and(
        eq(insights.userId, userId),
        eq(insights.isRead, false),
        like(insights.dedupKey, `%:${monthKey(now)}`),
        keys.length > 0 ? notInArray(insights.dedupKey, keys) : undefined
      )
    );

  return { generated };
}
