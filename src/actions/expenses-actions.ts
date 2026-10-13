"use server";

import { db } from "@/lib/db";
import { expenses, categories, accounts } from "@/lib/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import type { ApiResponse, ExpenseWithDetails } from "@/types/database";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/lib/auth/require-auth";

export async function getExpenses(filters?: {
  accountId?: string;
  categoryId?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<ApiResponse<ExpenseWithDetails[]>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }
    const { userId } = authResult;

    const conditions = [eq(expenses.userId, userId)];

    if (filters?.accountId) {
      conditions.push(eq(expenses.accountId, filters.accountId));
    }
    if (filters?.categoryId) {
      conditions.push(eq(expenses.categoryId, filters.categoryId));
    }
    if (filters?.startDate) {
      conditions.push(gte(expenses.startDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(expenses.startDate, filters.endDate));
    }

    const result = await db
      .select({
        expense: expenses,
        category: categories,
        account: accounts,
      })
      .from(expenses)
      .leftJoin(categories, eq(expenses.categoryId, categories.id))
      .leftJoin(accounts, eq(expenses.accountId, accounts.id))
      .where(and(...conditions))
      .orderBy(desc(expenses.createdAt));

    const expensesWithDetails: ExpenseWithDetails[] = result.map((r) => ({
      ...r.expense,
      category: r.category,
      account: r.account,
    }));

    return { success: true, data: expensesWithDetails };
  } catch (error) {
    logger.error("Failed to fetch expenses", "getExpenses", error);
    return { success: false, error: "Ausgaben konnten nicht geladen werden." };
  }
}
