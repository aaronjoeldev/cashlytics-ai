"use server";

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { accounts, categories, dailyExpenses, expenses, incomes, insights } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/require-auth";
import { logger } from "@/lib/logger";
import type { ApiResponse } from "@/types/database";

/** Current state of the record a tool call would change or delete. */
export type ToolPreviewRecord = {
  name: string;
  amount?: string;
  currency?: string;
  date?: string;
  endDate?: string | null;
  recurrenceType?: string;
  type?: string;
  categoryName?: string | null;
};

/** What the approval card needs beyond the tool input: names and currencies behind the ids. */
export type ToolPreview = {
  /** The existing record for update and delete tools, null when it does not exist (anymore) */
  record?: ToolPreviewRecord | null;
  accounts: Record<string, { name: string; currency: string }>;
  categories: Record<string, string>;
};

const uuid = z.guid();

function idsFrom(input: Record<string, unknown>, keys: string[]): string[] {
  return keys
    .map((key) => input[key])
    .filter((value): value is string => typeof value === "string" && uuid.safeParse(value).success);
}

function dateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

async function loadRecord(
  userId: string,
  toolName: string,
  id: string
): Promise<ToolPreviewRecord | null | undefined> {
  switch (toolName) {
    case "updateAccount":
    case "deleteAccount": {
      const [row] = await db
        .select({
          name: accounts.name,
          balance: accounts.balance,
          currency: accounts.currency,
          type: accounts.type,
        })
        .from(accounts)
        .where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
      return row
        ? { name: row.name, amount: row.balance, currency: row.currency, type: row.type }
        : null;
    }
    case "updateExpense":
    case "deleteExpense": {
      const [row] = await db
        .select({
          name: expenses.name,
          amount: expenses.amount,
          currency: expenses.currency,
          recurrenceType: expenses.recurrenceType,
          startDate: expenses.startDate,
          endDate: expenses.endDate,
          categoryName: categories.name,
        })
        .from(expenses)
        .leftJoin(categories, eq(categories.id, expenses.categoryId))
        .where(and(eq(expenses.id, id), eq(expenses.userId, userId)));
      return row
        ? {
            name: row.name,
            amount: row.amount,
            currency: row.currency,
            recurrenceType: row.recurrenceType,
            date: dateOnly(row.startDate) ?? undefined,
            endDate: dateOnly(row.endDate),
            categoryName: row.categoryName,
          }
        : null;
    }
    case "updateDailyExpense":
    case "deleteDailyExpense": {
      const [row] = await db
        .select({
          name: dailyExpenses.description,
          amount: dailyExpenses.amount,
          currency: dailyExpenses.currency,
          date: dailyExpenses.date,
          categoryName: categories.name,
        })
        .from(dailyExpenses)
        .leftJoin(categories, eq(categories.id, dailyExpenses.categoryId))
        .where(and(eq(dailyExpenses.id, id), eq(dailyExpenses.userId, userId)));
      return row
        ? {
            name: row.name,
            amount: row.amount,
            currency: row.currency,
            date: dateOnly(row.date) ?? undefined,
            categoryName: row.categoryName,
          }
        : null;
    }
    case "updateIncome":
    case "deleteIncome": {
      const [row] = await db
        .select({
          name: incomes.source,
          amount: incomes.amount,
          currency: incomes.currency,
          recurrenceType: incomes.recurrenceType,
          startDate: incomes.startDate,
        })
        .from(incomes)
        .where(and(eq(incomes.id, id), eq(incomes.userId, userId)));
      return row
        ? {
            name: row.name,
            amount: row.amount,
            currency: row.currency,
            recurrenceType: row.recurrenceType,
            date: dateOnly(row.startDate) ?? undefined,
          }
        : null;
    }
    case "markInsightRead": {
      const [row] = await db
        .select({ name: insights.title })
        .from(insights)
        .where(and(eq(insights.id, id), eq(insights.userId, userId)));
      return row ? { name: row.name } : null;
    }
    default:
      return undefined;
  }
}

/**
 * Looks up what an assistant tool call refers to, so the approval card can show names, current
 * values and currencies instead of bare ids. Read-only and limited to the caller's own records.
 */
export async function getToolPreview(
  toolName: string,
  input: Record<string, unknown>
): Promise<ApiResponse<ToolPreview>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }
    const { userId } = authResult;
    if (typeof toolName !== "string" || !input || typeof input !== "object") {
      return { success: false, error: "Ungültige Anfrage." };
    }

    const [recordId] = idsFrom(input, toolName === "markInsightRead" ? ["insightId"] : ["id"]);
    const accountIds = idsFrom(input, ["accountId", "sourceAccountId", "targetAccountId"]);
    const categoryIds = idsFrom(input, ["categoryId"]);

    const [record, accountRows, categoryRows] = await Promise.all([
      recordId ? loadRecord(userId, toolName, recordId) : Promise.resolve(undefined),
      accountIds.length > 0
        ? db
            .select({ id: accounts.id, name: accounts.name, currency: accounts.currency })
            .from(accounts)
            .where(and(eq(accounts.userId, userId), inArray(accounts.id, accountIds)))
        : Promise.resolve([]),
      categoryIds.length > 0
        ? db
            .select({ id: categories.id, name: categories.name })
            .from(categories)
            .where(and(eq(categories.userId, userId), inArray(categories.id, categoryIds)))
        : Promise.resolve([]),
    ]);

    return {
      success: true,
      data: {
        ...(record !== undefined && { record }),
        accounts: Object.fromEntries(
          accountRows.map((row) => [row.id, { name: row.name, currency: row.currency }])
        ),
        categories: Object.fromEntries(categoryRows.map((row) => [row.id, row.name])),
      },
    };
  } catch (error) {
    logger.error("Failed to load tool preview", "getToolPreview", error);
    return { success: false, error: "Vorschau konnte nicht geladen werden." };
  }
}
