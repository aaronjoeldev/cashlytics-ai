"use server";

import { db } from "@/lib/db";
import { incomes, accounts } from "@/lib/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { ApiResponse, Income, NewIncome, IncomeWithAccount } from "@/types/database";
import { logger } from "@/lib/logger";
import { ownsAccount } from "@/lib/auth/ownership";
import { requireAuth } from "@/lib/auth/require-auth";
import {
  changesDateRange,
  checkUpdatedRange,
  createIncomeInput,
  parseInput,
  updateIncomeInput,
} from "@/lib/validations/action-input";

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
      .orderBy(desc(incomes.startDate));

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

export async function createIncome(
  rawData: Omit<NewIncome, "userId">
): Promise<ApiResponse<Income>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }
    const { userId } = authResult;

    const input = parseInput(createIncomeInput, rawData);
    if (!input.success) return input;
    const data = input.data;

    // FK Validation: accountId must belong to authenticated user (DATA-10)
    let accountCurrency: string | undefined;
    if (data.accountId) {
      const [ownedAccount] = await db
        .select({ id: accounts.id, currency: accounts.currency })
        .from(accounts)
        .where(and(eq(accounts.id, data.accountId), eq(accounts.userId, userId)))
        .limit(1);
      if (!ownedAccount) {
        return { success: false, error: "Konto nicht gefunden oder kein Zugriff." };
      }
      accountCurrency = ownedAccount.currency;
    }

    const [income] = await db
      .insert(incomes)
      .values({ ...data, currency: data.currency ?? accountCurrency, userId })
      .returning();

    revalidatePath("/income");
    revalidatePath("/dashboard");
    revalidatePath("/accounts");
    return { success: true, data: income };
  } catch (error) {
    logger.error("Failed to create income", "createIncome", error);
    return { success: false, error: "Einnahme konnte nicht erstellt werden." };
  }
}

export async function updateIncome(
  id: string,
  data: Partial<NewIncome>
): Promise<ApiResponse<Income>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }
    const { userId } = authResult;

    const input = parseInput(updateIncomeInput, data);
    if (!input.success) return input;
    const updates = input.data;
    if (Object.keys(updates).length === 0) {
      return { success: false, error: "Keine Änderungen übergeben." };
    }
    if (updates.accountId && !(await ownsAccount(userId, updates.accountId))) {
      return { success: false, error: "Konto nicht gefunden oder kein Zugriff." };
    }

    if (changesDateRange(updates)) {
      const [stored] = await db
        .select({ startDate: incomes.startDate, endDate: incomes.endDate })
        .from(incomes)
        .where(and(eq(incomes.id, id), eq(incomes.userId, userId)))
        .limit(1);
      if (!stored) {
        return { success: false, error: "Einnahme nicht gefunden." };
      }
      const rangeError = checkUpdatedRange(updates, stored);
      if (rangeError) return { success: false, error: rangeError };
    }

    const [income] = await db
      .update(incomes)
      .set(updates)
      .where(and(eq(incomes.id, id), eq(incomes.userId, userId)))
      .returning();
    if (!income) {
      return { success: false, error: "Einnahme nicht gefunden." };
    }
    revalidatePath("/income");
    revalidatePath("/dashboard");
    return { success: true, data: income };
  } catch (error) {
    logger.error("Failed to update income", "updateIncome", error);
    return { success: false, error: "Einnahme konnte nicht aktualisiert werden." };
  }
}

export async function deleteIncome(id: string): Promise<ApiResponse<void>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }
    const { userId } = authResult;

    const [deleted] = await db
      .delete(incomes)
      .where(and(eq(incomes.id, id), eq(incomes.userId, userId)))
      .returning({ id: incomes.id });
    if (!deleted) {
      return { success: false, error: "Income not found" };
    }
    revalidatePath("/income");
    revalidatePath("/dashboard");
    revalidatePath("/accounts");
    return { success: true, data: undefined };
  } catch (error) {
    logger.error("Failed to delete income", "deleteIncome", error);
    return { success: false, error: "Einnahme konnte nicht gelöscht werden." };
  }
}
