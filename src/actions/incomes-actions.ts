"use server";

import { db } from "@/lib/db";
import { incomes, accounts } from "@/lib/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import type { ApiResponse, IncomeWithAccount } from "@/types/database";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/lib/auth/require-auth";

export async function getIncomes(filters?: {
  accountId?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<ApiResponse<IncomeWithAccount[]>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }
    const { userId } = authResult;

    const conditions = [eq(incomes.userId, userId)];

    if (filters?.accountId) {
      conditions.push(eq(incomes.accountId, filters.accountId));
    }
    if (filters?.startDate) {
      conditions.push(gte(incomes.startDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(incomes.startDate, filters.endDate));
    }

    const result = await db
      .select({
        income: incomes,
        account: accounts,
      })
      .from(incomes)
      .leftJoin(accounts, eq(incomes.accountId, accounts.id))
      .where(and(...conditions))
      .orderBy(desc(incomes.createdAt));

    const incomesWithAccount: IncomeWithAccount[] = result.map((r) => ({
      ...r.income,
      account: r.account,
    }));

    return { success: true, data: incomesWithAccount };
  } catch (error) {
    logger.error("Failed to fetch incomes", "getIncomes", error);
    return { success: false, error: "Einnahmen konnten nicht geladen werden." };
  }
}
