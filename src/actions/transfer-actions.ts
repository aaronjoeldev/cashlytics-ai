"use server";

import { db } from "@/lib/db";
import { transfers, accounts } from "@/lib/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { ApiResponse, Transfer, NewTransfer, TransferWithDetails } from "@/types/database";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/lib/auth/require-auth";

export async function getTransfers(filters?: {
  sourceAccountId?: string;
  targetAccountId?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<ApiResponse<TransferWithDetails[]>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }
    const { userId } = authResult;

    const conditions = [eq(transfers.userId, userId)];
    if (filters?.sourceAccountId) {
      conditions.push(eq(transfers.sourceAccountId, filters.sourceAccountId));
    }
    if (filters?.targetAccountId) {
      conditions.push(eq(transfers.targetAccountId, filters.targetAccountId));
    }
    if (filters?.startDate) {
      conditions.push(gte(transfers.startDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(transfers.startDate, filters.endDate));
    }

    const result = await db.query.transfers.findMany({
      where: and(...conditions),
      with: {
        sourceAccount: true,
        targetAccount: true,
      },
      orderBy: [desc(transfers.startDate)],
    });

    return { success: true, data: result as TransferWithDetails[] };
  } catch (error) {
    logger.error("Failed to fetch transfers", "getTransfers", error);
    return { success: false, error: "Transfers konnten nicht geladen werden" };
  }
}

export async function createTransfer(
  data: Omit<NewTransfer, "userId">
): Promise<ApiResponse<Transfer>> {
  try {
    if (data.sourceAccountId === data.targetAccountId) {
      return { success: false, error: "Quell- und Zielkonto müssen unterschiedlich sein" };
    }

    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }
    const { userId } = authResult;

    // FK Validation: BOTH accounts must belong to the authenticated user (DATA-10)
    const [sourceAccount] = await db
      .select({ id: accounts.id, currency: accounts.currency })
      .from(accounts)
      .where(and(eq(accounts.id, data.sourceAccountId), eq(accounts.userId, userId)))
      .limit(1);
    if (!sourceAccount) {
      return { success: false, error: "Quellkonto nicht gefunden oder kein Zugriff." };
    }
    const [targetAccount] = await db
      .select({ id: accounts.id, currency: accounts.currency })
      .from(accounts)
      .where(and(eq(accounts.id, data.targetAccountId), eq(accounts.userId, userId)))
      .limit(1);
    if (!targetAccount) {
      return { success: false, error: "Zielkonto nicht gefunden oder kein Zugriff." };
    }

    const [transfer] = await db
      .insert(transfers)
      .values({
        ...data,
        sourceCurrency: data.sourceCurrency ?? sourceAccount.currency,
        targetCurrency: data.targetCurrency ?? targetAccount.currency,
        userId,
      })
      .returning();

    revalidatePath("/transfers");
    revalidatePath("/dashboard");
    revalidatePath("/accounts");
    return { success: true, data: transfer };
  } catch (error) {
    logger.error("Failed to create transfer", "createTransfer", error);
    return { success: false, error: "Transfer konnte nicht erstellt werden" };
  }
}

export async function updateTransfer(
  id: string,
  data: Partial<NewTransfer>
): Promise<ApiResponse<Transfer>> {
  try {
    if (
      data.sourceAccountId &&
      data.targetAccountId &&
      data.sourceAccountId === data.targetAccountId
    ) {
      return { success: false, error: "Quell- und Zielkonto müssen unterschiedlich sein" };
    }

    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }
    const { userId } = authResult;

    const [transfer] = await db
      .update(transfers)
      .set(data)
      .where(and(eq(transfers.id, id), eq(transfers.userId, userId)))
      .returning();

    if (!transfer) {
      return { success: false, error: "Transfer nicht gefunden." };
    }

    revalidatePath("/transfers");
    revalidatePath("/dashboard");
    revalidatePath("/accounts");
    return { success: true, data: transfer };
  } catch (error) {
    logger.error("Failed to update transfer", "updateTransfer", error);
    return { success: false, error: "Transfer konnte nicht aktualisiert werden" };
  }
}

export async function deleteTransfer(id: string): Promise<ApiResponse<void>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }
    const { userId } = authResult;

    const [deleted] = await db
      .delete(transfers)
      .where(and(eq(transfers.id, id), eq(transfers.userId, userId)))
      .returning();

    if (!deleted) {
      return { success: false, error: "Transfer nicht gefunden." };
    }

    revalidatePath("/transfers");
    revalidatePath("/dashboard");
    revalidatePath("/accounts");
    return { success: true, data: undefined };
  } catch (error) {
    logger.error("Failed to delete transfer", "deleteTransfer", error);
    return { success: false, error: "Transfer konnte nicht gelöscht werden" };
  }
}
