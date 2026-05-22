"use server";

import { db } from "@/lib/db";
import {
  insights,
  dailyExpenses,
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
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const expiresAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  let generated = 0;
  const newInsights: Array<typeof insights.$inferInsert> = [];

  // --- Spending Anomaly Detection ---
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

  // Insert (skip duplicates by title within current month)
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
