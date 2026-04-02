"use server";

import { db } from "@/lib/db";
import { incomes, accounts } from "@/lib/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { ApiResponse, Income, IncomeWithAccount, NewIncome } from "@/types/database";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/lib/auth/require-auth";
import { defaultCurrency } from "@/lib/currency";

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

export async function getIncomeById(id: string): Promise<ApiResponse<IncomeWithAccount>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }
    const { userId } = authResult;

    const [result] = await db
      .select({
        income: incomes,
        account: accounts,
      })
      .from(incomes)
      .leftJoin(accounts, eq(incomes.accountId, accounts.id))
      .where(and(eq(incomes.id, id), eq(incomes.userId, userId)))
      .limit(1);

    if (!result) {
      return { success: false, error: "Einnahme nicht gefunden." };
    }

    return {
      success: true,
      data: {
        ...result.income,
        account: result.account,
      },
    };
  } catch (error) {
    logger.error("Failed to fetch income", "getIncomeById", error);
    return { success: false, error: "Einnahme konnte nicht geladen werden." };
  }
}

export async function createIncome(data: {
  accountId: string;
  source: string;
  amount: number;
  recurrenceType: "once" | "monthly" | "yearly";
  startDate: Date | string;
  currency?: string;
  originalAmount?: number | null;
  exchangeRate?: number | null;
}): Promise<ApiResponse<Income>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }
    const { userId } = authResult;

    // FK Validation: accountId must belong to authenticated user (DATA-10)
    const [ownedAccount] = await db
      .select({ id: accounts.id, currency: accounts.currency })
      .from(accounts)
      .where(and(eq(accounts.id, data.accountId), eq(accounts.userId, userId)))
      .limit(1);
    if (!ownedAccount) {
      return { success: false, error: "Konto nicht gefunden oder kein Zugriff." };
    }

    const currency = data.currency ?? defaultCurrency;

    // TODO (Phase 2): If currency !== ownedAccount.currency, call getExchangeRate(currency, ownedAccount.currency)
    // to auto-populate exchangeRate for currency conversion at booking time.

    const [newIncome] = await db
      .insert(incomes)
      .values({
        userId,
        accountId: data.accountId,
        source: data.source,
        amount: data.amount.toString(),
        recurrenceType: data.recurrenceType,
        startDate: typeof data.startDate === "string" ? new Date(data.startDate) : data.startDate,
        currency,
        originalAmount: data.originalAmount != null ? data.originalAmount.toString() : null,
        exchangeRate: data.exchangeRate != null ? data.exchangeRate.toString() : null,
      })
      .returning();

    revalidatePath("/income");
    revalidatePath("/dashboard");
    return { success: true, data: newIncome };
  } catch (error) {
    logger.error("Failed to create income", "createIncome", error);
    return { success: false, error: "Einnahme konnte nicht erstellt werden." };
  }
}

export async function updateIncome(
  id: string,
  data: Partial<Omit<NewIncome, "id" | "createdAt">>
): Promise<ApiResponse<Income>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }
    const { userId } = authResult;

    const updateData = { ...data };
    if (data.startDate && typeof data.startDate === "string") {
      updateData.startDate = new Date(data.startDate);
    }

    const [updatedIncome] = await db
      .update(incomes)
      .set(updateData)
      .where(and(eq(incomes.id, id), eq(incomes.userId, userId)))
      .returning();

    if (!updatedIncome) {
      return { success: false, error: "Einnahme nicht gefunden." };
    }

    revalidatePath("/income");
    revalidatePath("/dashboard");
    return { success: true, data: updatedIncome };
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

    const [deletedIncome] = await db
      .delete(incomes)
      .where(and(eq(incomes.id, id), eq(incomes.userId, userId)))
      .returning();

    if (!deletedIncome) {
      return { success: false, error: "Einnahme nicht gefunden." };
    }

    revalidatePath("/income");
    revalidatePath("/dashboard");
    return { success: true, data: undefined };
  } catch (error) {
    logger.error("Failed to delete income", "deleteIncome", error);
    return { success: false, error: "Einnahme konnte nicht gelöscht werden." };
  }
}
