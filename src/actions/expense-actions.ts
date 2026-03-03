"use server";

import { db } from "@/lib/db";
import { expenses, dailyExpenses, accounts, categories } from "@/lib/db/schema";
import { eq, and, gte, lte, desc, sql, ilike } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type {
  ApiResponse,
  Expense,
  NewExpense,
  DailyExpense,
  NewDailyExpense,
  ExpenseWithDetails,
  DailyExpenseWithDetails,
} from "@/types/database";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/lib/auth/require-auth";

export async function getExpenses(filters?: {
  accountId?: string;
  categoryId?: string;
  name?: string;
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
    if (filters?.name) {
      conditions.push(ilike(expenses.name, `%${filters.name}%`));
    }
    if (filters?.startDate) {
      conditions.push(gte(expenses.startDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(expenses.startDate, filters.endDate));
    }

    const result = await db.query.expenses.findMany({
      where: and(...conditions),
      with: {
        account: true,
        category: true,
      },
      orderBy: [desc(expenses.startDate)],
    });

    return { success: true, data: result as ExpenseWithDetails[] };
  } catch (error) {
    logger.error("Failed to fetch expenses", "getExpenses", error);
    return { success: false, error: "Periodische Ausgaben konnten nicht geladen werden." };
  }
}

export async function createExpense(
  data: Omit<NewExpense, "userId">
): Promise<ApiResponse<Expense>> {
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

    // FK Validation: categoryId must belong to authenticated user (DATA-10)
    if (data.categoryId) {
      const [ownedCategory] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.id, data.categoryId), eq(categories.userId, userId)))
        .limit(1);
      if (!ownedCategory) {
        return { success: false, error: "Kategorie nicht gefunden oder kein Zugriff." };
      }
    }

    const expense = await db.transaction(async (tx) => {
      const [createdExpense] = await tx
        .insert(expenses)
        .values({ ...data, userId })
        .returning();

      // Kontostand aktualisieren (abziehen) mit SQL
      if (data.accountId) {
        await tx
          .update(accounts)
          .set({
            balance: sql`${accounts.balance} - ${data.amount}`,
          })
          .where(eq(accounts.id, data.accountId));
      }

      return createdExpense;
    });

    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    revalidatePath("/accounts");
    return { success: true, data: expense };
  } catch (error) {
    logger.error("Failed to create expense", "createExpense", error);
    return { success: false, error: "Ausgabe konnte nicht erstellt werden." };
  }
}

export async function updateExpense(
  id: string,
  data: Partial<NewExpense>
): Promise<ApiResponse<Expense>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }
    const { userId } = authResult;

    const [expense] = await db
      .update(expenses)
      .set(data)
      .where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
      .returning();
    if (!expense) {
      return { success: false, error: "Ausgabe nicht gefunden." };
    }
    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    return { success: true, data: expense };
  } catch (error) {
    logger.error("Failed to update expense", "updateExpense", error);
    return { success: false, error: "Ausgabe konnte nicht aktualisiert werden." };
  }
}

export async function deleteExpense(id: string): Promise<ApiResponse<void>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }
    const { userId } = authResult;

    await db.transaction(async (tx) => {
      // Erst die Expense holen um den Betrag und Account zu kennen (userId filter ensures ownership)
      const [expense] = await tx
        .select()
        .from(expenses)
        .where(and(eq(expenses.id, id), eq(expenses.userId, userId)));
      if (expense && expense.accountId) {
        // Kontostand aktualisieren (zurückbuchen)
        await tx
          .update(accounts)
          .set({
            balance: sql`${accounts.balance} + ${expense.amount}`,
          })
          .where(eq(accounts.id, expense.accountId));
      }

      await tx.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.userId, userId)));
    });
    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    revalidatePath("/accounts");
    return { success: true, data: undefined };
  } catch (error) {
    logger.error("Failed to delete expense", "deleteExpense", error);
    return { success: false, error: "Ausgabe konnte nicht gelöscht werden." };
  }
}

export async function getDailyExpenses(filters?: {
  accountId?: string;
  categoryId?: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<ApiResponse<DailyExpenseWithDetails[]>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }
    const { userId } = authResult;

    const conditions = [eq(dailyExpenses.userId, userId)];
    if (filters?.accountId) {
      conditions.push(eq(dailyExpenses.accountId, filters.accountId));
    }
    if (filters?.categoryId) {
      conditions.push(eq(dailyExpenses.categoryId, filters.categoryId));
    }
    if (filters?.description) {
      conditions.push(ilike(dailyExpenses.description, `%${filters.description}%`));
    }
    if (filters?.startDate) {
      conditions.push(gte(dailyExpenses.date, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(dailyExpenses.date, filters.endDate));
    }

    const result = await db.query.dailyExpenses.findMany({
      where: and(...conditions),
      with: {
        account: true,
        category: true,
      },
      orderBy: [desc(dailyExpenses.date)],
    });

    return { success: true, data: result as DailyExpenseWithDetails[] };
  } catch (error) {
    logger.error("Failed to fetch daily expenses", "getDailyExpenses", error);
    return { success: false, error: "Tagesausgaben konnten nicht geladen werden." };
  }
}

export async function createDailyExpense(
  data: Omit<NewDailyExpense, "userId">
): Promise<ApiResponse<DailyExpense>> {
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

    const expense = await db.transaction(async (tx) => {
      const [createdExpense] = await tx
        .insert(dailyExpenses)
        .values({ ...data, userId })
        .returning();

      // Kontostand aktualisieren (abziehen)
      if (data.accountId) {
        await tx
          .update(accounts)
          .set({
            balance: sql`${accounts.balance} - ${data.amount}`,
          })
          .where(eq(accounts.id, data.accountId));
      }

      return createdExpense;
    });

    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    revalidatePath("/accounts");
    return { success: true, data: expense };
  } catch (error) {
    logger.error("Failed to create daily expense", "createDailyExpense", error);
    return { success: false, error: "Tägliche Ausgabe konnte nicht erstellt werden." };
  }
}

export async function updateDailyExpense(
  id: string,
  data: Partial<NewDailyExpense>
): Promise<ApiResponse<DailyExpense>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }
    const { userId } = authResult;

    const [expense] = await db
      .update(dailyExpenses)
      .set(data)
      .where(and(eq(dailyExpenses.id, id), eq(dailyExpenses.userId, userId)))
      .returning();
    if (!expense) {
      return { success: false, error: "Tägliche Ausgabe nicht gefunden." };
    }
    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    return { success: true, data: expense };
  } catch (error) {
    logger.error("Failed to update daily expense", "updateDailyExpense", error);
    return { success: false, error: "Tägliche Ausgabe konnte nicht aktualisiert werden." };
  }
}

export async function deleteDailyExpense(id: string): Promise<ApiResponse<void>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }
    const { userId } = authResult;

    await db.transaction(async (tx) => {
      const [expense] = await tx
        .select()
        .from(dailyExpenses)
        .where(and(eq(dailyExpenses.id, id), eq(dailyExpenses.userId, userId)));
      if (expense && expense.accountId) {
        await tx
          .update(accounts)
          .set({
            balance: sql`${accounts.balance} + ${expense.amount}`,
          })
          .where(eq(accounts.id, expense.accountId));
      }

      await tx
        .delete(dailyExpenses)
        .where(and(eq(dailyExpenses.id, id), eq(dailyExpenses.userId, userId)));
    });
    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    revalidatePath("/accounts");
    return { success: true, data: undefined };
  } catch (error) {
    logger.error("Failed to delete daily expense", "deleteDailyExpense", error);
    return { success: false, error: "Tägliche Ausgabe konnte nicht gelöscht werden." };
  }
}
