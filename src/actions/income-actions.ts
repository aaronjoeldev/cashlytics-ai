"use server";

import { db } from "@/lib/db";
import { incomes, accounts } from "@/lib/db/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { ApiResponse, Income, NewIncome, IncomeWithAccount } from "@/types/database";
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

export async function createIncome(data: Omit<NewIncome, "userId">): Promise<ApiResponse<Income>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }
    const { userId } = authResult;

    // FK Validation: accountId must belong to authenticated user (DATA-10)
    if (data.accountId) {
      const [ownedAccount] = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.id, data.accountId), eq(accounts.userId, userId)))
        .limit(1);
      if (!ownedAccount) {
        return { success: false, error: "Konto nicht gefunden oder kein Zugriff." };
      }
    }

    const income = await db.transaction(async (tx) => {
      const [createdIncome] = await tx
        .insert(incomes)
        .values({ ...data, userId })
        .returning();

      // Kontostand aktualisieren (hinzufügen)
      if (data.accountId) {
        await tx
          .update(accounts)
          .set({
            balance: sql`${accounts.balance} + ${data.amount}`,
          })
          .where(eq(accounts.id, data.accountId));
      }

      return createdIncome;
    });

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

    const [income] = await db
      .update(incomes)
      .set(data)
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

    await db.transaction(async (tx) => {
      // Erst die Income holen um den Betrag und Account zu kennen (userId filter ensures ownership)
      const [income] = await tx
        .select()
        .from(incomes)
        .where(and(eq(incomes.id, id), eq(incomes.userId, userId)));
      if (income && income.accountId) {
        // Kontostand aktualisieren (abziehen)
        await tx
          .update(accounts)
          .set({
            balance: sql`${accounts.balance} - ${income.amount}`,
          })
          .where(eq(accounts.id, income.accountId));
      }

      await tx.delete(incomes).where(and(eq(incomes.id, id), eq(incomes.userId, userId)));
    });
    revalidatePath("/income");
    revalidatePath("/dashboard");
    revalidatePath("/accounts");
    return { success: true, data: undefined };
  } catch (error) {
    logger.error("Failed to delete income", "deleteIncome", error);
    return { success: false, error: "Einnahme konnte nicht gelöscht werden." };
  }
}
