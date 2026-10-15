"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  accounts,
  dailyExpenses,
  importConflicts,
  importDecisions,
  importRows,
  importSessions,
  incomes,
} from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/require-auth";
import {
  importCommitEngine,
  type ImportCommitResult,
  type ImportConflictDecisionInput,
} from "@/lib/import/import-commit-engine";
import { importReconciliationEngine } from "@/lib/import/import-reconciliation-engine";
import { importReviewService, type ImportDecisionValue } from "@/lib/import/import-review-service";
import {
  createCsvImportStagingService,
  type HeaderMapping,
  type NormalizedCsvRow,
} from "@/lib/import/csv-import-staging";
import { getImportFeatureGateError } from "@/lib/import/feature-gating";
import { logger } from "@/lib/logger";
import type { ApiResponse } from "@/types/database";

export type ImportSessionSnapshot = {
  session: {
    id: string;
    accountId: string;
    status: "draft" | "review" | "confirmed" | "cancelled";
    sourceFileName: string;
    totalRows: number;
    stagedRows: number;
    conflictRows: number;
  };
  rows: Array<{
    id: string;
    rowIndex: number;
    bookingDate: Date | null;
    amount: string;
    currency: string;
    description: string;
    counterparty: string | null;
    senderAccount: string | null;
    receiverAccount: string | null;
    balanceAfterBooking: string | null;
    excludedByUser: boolean;
  }>;
  conflicts: Array<{
    id: string;
    importRowId: string;
    suggestion: "keep_both" | "replace_existing" | "skip_import_row" | "needs_user_review";
    confidence: string | null;
    similarityScore: string | null;
    explanation: string | null;
    existingRecord: {
      id: string;
      type: "expense" | "income";
      description: string;
      amount: string;
      currency: string;
      date: Date;
    } | null;
    decision: ImportDecisionValue | null;
  }>;
};

function parseHeaderMapping(rawValue: FormDataEntryValue | null): HeaderMapping | undefined {
  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object") {
      return undefined;
    }
    return parsed as HeaderMapping;
  } catch {
    return undefined;
  }
}

function rejectIfImportFeatureDisabled<T>(): ApiResponse<T> | null {
  return getImportFeatureGateError<T>();
}

function resolveImportActionErrorMessage(error: unknown, fallback: string): string {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (message.includes("econnrefused") || message.includes("connect")) {
    return "Database connection failed. Please ensure PostgreSQL is running.";
  }

  if (
    message.includes('relation "import_sessions" does not exist') ||
    message.includes('relation "import_rows" does not exist') ||
    message.includes('type "import_session_status" does not exist')
  ) {
    return "Import database schema is missing. Please run database migrations.";
  }

  return fallback;
}

const csvImportStagingService = createCsvImportStagingService({
  store: {
    async isAccountOwnedByUser(userId, accountId) {
      const [ownedAccount] = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
        .limit(1);

      return Boolean(ownedAccount);
    },

    async createSessionWithRows({ userId, accountId, sourceFileName, sourceFileHash, rows }) {
      return db.transaction(async (tx) => {
        const [session] = await tx
          .insert(importSessions)
          .values({
            userId,
            accountId,
            sourceFileName,
            sourceFileHash,
            totalRows: rows.length,
            stagedRows: rows.length,
            status: "review",
            updatedAt: new Date(),
          })
          .returning({ id: importSessions.id });

        await tx
          .insert(importRows)
          .values(rows.map((row) => buildImportRowInsert(session.id, userId, row)));

        return { sessionId: session.id };
      });
    },
  },
});

function buildImportRowInsert(sessionId: string, userId: string, row: NormalizedCsvRow) {
  return {
    sessionId,
    userId,
    rowIndex: row.rowIndex,
    bookingDate: row.bookingDate,
    amount: row.amount,
    currency: row.currency,
    description: row.description,
    counterparty: row.counterparty,
    senderAccount: row.senderAccount,
    receiverAccount: row.receiverAccount,
    balanceAfterBooking: row.balanceAfterBooking,
    normalizedPayload: JSON.stringify({
      bookingDate: row.bookingDate.toISOString().slice(0, 10),
      amount: row.amount,
      currency: row.currency,
      description: row.description,
      counterparty: row.counterparty,
      senderAccount: row.senderAccount,
      receiverAccount: row.receiverAccount,
      balanceAfterBooking: row.balanceAfterBooking,
      reference: row.reference,
    }),
    updatedAt: new Date(),
  };
}

export async function stageCsvImportUpload(
  formData: FormData
): Promise<ApiResponse<{ sessionId: string; stagedRows: number; totalRows: number }>> {
  const featureGateError = rejectIfImportFeatureDisabled<{
    sessionId: string;
    stagedRows: number;
    totalRows: number;
  }>();
  if (featureGateError) {
    return featureGateError;
  }

  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }

    const accountId = formData.get("accountId");
    if (typeof accountId !== "string" || accountId.trim().length === 0) {
      return { success: false, error: "Account is required" };
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { success: false, error: "CSV file is required" };
    }

    const parseResult = await csvImportStagingService.stageCsvUpload({
      userId: authResult.userId,
      accountId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      csvContent: await file.text(),
      headerMapping: parseHeaderMapping(formData.get("headerMapping")),
    });

    if (!parseResult.success) {
      return { success: false, error: parseResult.error };
    }

    revalidatePath("/import");
    revalidatePath("/dashboard");
    return { success: true, data: parseResult.data };
  } catch (error) {
    logger.error("Failed to stage CSV import", "stageCsvImportUpload", error);
    return {
      success: false,
      error: resolveImportActionErrorMessage(error, "CSV import staging failed."),
    };
  }
}

export async function confirmImportSession(
  sessionId: string,
  decisions?: ImportConflictDecisionInput[]
): Promise<ApiResponse<ImportCommitResult>> {
  const featureGateError = rejectIfImportFeatureDisabled<ImportCommitResult>();
  if (featureGateError) {
    return featureGateError;
  }

  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }

    const result = await importCommitEngine.commitApprovedRows({
      userId: authResult.userId,
      sessionId,
      decisions,
    });

    revalidatePath("/dashboard");
    revalidatePath("/expenses");
    revalidatePath("/income");
    revalidatePath("/accounts");
    revalidatePath("/import");

    return { success: true, data: result };
  } catch (error) {
    logger.error("Failed to confirm import session", "confirmImportSession", error);
    return {
      success: false,
      error: resolveImportActionErrorMessage(error, "Import commit failed."),
    };
  }
}

export async function runImportReconciliation(sessionId: string): Promise<
  ApiResponse<{
    sessionId: string;
    exactMatchCount: number;
    nearMatchCount: number;
    conflictRows: number;
  }>
> {
  const featureGateError = rejectIfImportFeatureDisabled<{
    sessionId: string;
    exactMatchCount: number;
    nearMatchCount: number;
    conflictRows: number;
  }>();
  if (featureGateError) {
    return featureGateError;
  }

  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }

    const result = await importReconciliationEngine.detectAndStageConflicts({
      userId: authResult.userId,
      sessionId,
    });

    revalidatePath("/import");
    return {
      success: true,
      data: {
        sessionId: result.sessionId,
        exactMatchCount: result.exactMatchCount,
        nearMatchCount: result.nearMatchCount,
        conflictRows: result.conflictRows,
      },
    };
  } catch (error) {
    logger.error("Failed to run import reconciliation", "runImportReconciliation", error);
    return {
      success: false,
      error: resolveImportActionErrorMessage(error, "Reconciliation failed."),
    };
  }
}

export async function getImportSessionSnapshot(
  sessionId: string
): Promise<ApiResponse<ImportSessionSnapshot>> {
  const featureGateError = rejectIfImportFeatureDisabled<ImportSessionSnapshot>();
  if (featureGateError) {
    return featureGateError;
  }

  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }

    const [session] = await db
      .select({
        id: importSessions.id,
        accountId: importSessions.accountId,
        status: importSessions.status,
        sourceFileName: importSessions.sourceFileName,
        totalRows: importSessions.totalRows,
        stagedRows: importSessions.stagedRows,
        conflictRows: importSessions.conflictRows,
      })
      .from(importSessions)
      .where(and(eq(importSessions.id, sessionId), eq(importSessions.userId, authResult.userId)))
      .limit(1);

    if (!session) {
      return { success: false, error: "Import session not found" };
    }

    const [rows, conflicts, decisions] = await Promise.all([
      db
        .select({
          id: importRows.id,
          rowIndex: importRows.rowIndex,
          bookingDate: importRows.bookingDate,
          amount: importRows.amount,
          currency: importRows.currency,
          description: importRows.description,
          counterparty: importRows.counterparty,
          senderAccount: importRows.senderAccount,
          receiverAccount: importRows.receiverAccount,
          balanceAfterBooking: importRows.balanceAfterBooking,
          excludedByUser: importRows.excludedByUser,
        })
        .from(importRows)
        .where(and(eq(importRows.sessionId, sessionId), eq(importRows.userId, authResult.userId))),
      db
        .select({
          id: importConflicts.id,
          importRowId: importConflicts.importRowId,
          existingExpenseId: importConflicts.existingExpenseId,
          existingIncomeId: importConflicts.existingIncomeId,
          suggestion: importConflicts.suggestion,
          confidence: importConflicts.confidence,
          similarityScore: importConflicts.similarityScore,
          explanation: importConflicts.explanation,
        })
        .from(importConflicts)
        .where(
          and(
            eq(importConflicts.sessionId, sessionId),
            eq(importConflicts.userId, authResult.userId)
          )
        ),
      db
        .select({
          conflictId: importDecisions.conflictId,
          decision: importDecisions.decision,
        })
        .from(importDecisions)
        .where(
          and(
            eq(importDecisions.sessionId, sessionId),
            eq(importDecisions.userId, authResult.userId)
          )
        ),
    ]);

    const expenseIds = conflicts
      .map((conflict) => conflict.existingExpenseId)
      .filter((id): id is string => Boolean(id));
    const incomeIds = conflicts
      .map((conflict) => conflict.existingIncomeId)
      .filter((id): id is string => Boolean(id));

    const [expenseRecords, incomeRecords] = await Promise.all([
      expenseIds.length === 0
        ? Promise.resolve([])
        : db
            .select({
              id: dailyExpenses.id,
              description: dailyExpenses.description,
              amount: dailyExpenses.amount,
              currency: dailyExpenses.currency,
              date: dailyExpenses.date,
            })
            .from(dailyExpenses)
            .where(
              and(
                eq(dailyExpenses.userId, authResult.userId),
                inArray(dailyExpenses.id, expenseIds)
              )
            ),
      incomeIds.length === 0
        ? Promise.resolve([])
        : db
            .select({
              id: incomes.id,
              description: incomes.source,
              amount: incomes.amount,
              currency: incomes.currency,
              date: incomes.startDate,
            })
            .from(incomes)
            .where(and(eq(incomes.userId, authResult.userId), inArray(incomes.id, incomeIds))),
    ]);

    const expenseById = new Map(expenseRecords.map((record) => [record.id, record]));
    const incomeById = new Map(incomeRecords.map((record) => [record.id, record]));
    const decisionByConflictId = new Map(
      decisions.map((decision) => [decision.conflictId, decision.decision])
    );

    return {
      success: true,
      data: {
        session,
        rows: rows.sort((a, b) => a.rowIndex - b.rowIndex),
        conflicts: conflicts.map((conflict) => {
          const expenseRecord = conflict.existingExpenseId
            ? expenseById.get(conflict.existingExpenseId)
            : null;
          const incomeRecord = conflict.existingIncomeId
            ? incomeById.get(conflict.existingIncomeId)
            : null;

          return {
            id: conflict.id,
            importRowId: conflict.importRowId,
            suggestion: conflict.suggestion,
            confidence: conflict.confidence,
            similarityScore: conflict.similarityScore,
            explanation: conflict.explanation,
            existingRecord: expenseRecord
              ? {
                  id: expenseRecord.id,
                  type: "expense" as const,
                  description: expenseRecord.description,
                  amount: expenseRecord.amount,
                  currency: expenseRecord.currency,
                  date: expenseRecord.date,
                }
              : incomeRecord
                ? {
                    id: incomeRecord.id,
                    type: "income" as const,
                    description: incomeRecord.description,
                    amount: incomeRecord.amount,
                    currency: incomeRecord.currency,
                    date: incomeRecord.date,
                  }
                : null,
            decision: decisionByConflictId.get(conflict.id) ?? null,
          };
        }),
      },
    };
  } catch (error) {
    logger.error("Failed to fetch import session snapshot", "getImportSessionSnapshot", error);
    return {
      success: false,
      error: resolveImportActionErrorMessage(error, "Failed to fetch import session."),
    };
  }
}

export async function updateStagedImportRow(
  sessionId: string,
  rowId: string,
  patch: {
    bookingDate?: Date | string | null;
    amount?: string;
    currency?: string;
    description?: string;
    counterparty?: string | null;
    senderAccount?: string | null;
    receiverAccount?: string | null;
    balanceAfterBooking?: string | null;
  }
): Promise<ApiResponse<{ rowId: string }>> {
  const featureGateError = rejectIfImportFeatureDisabled<{ rowId: string }>();
  if (featureGateError) {
    return featureGateError;
  }

  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }

    const result = await importReviewService.updateStagedRow({
      userId: authResult.userId,
      sessionId,
      rowId,
      patch,
    });

    revalidatePath("/import");
    return { success: true, data: result };
  } catch (error) {
    logger.error("Failed to update staged import row", "updateStagedImportRow", error);
    return {
      success: false,
      error: resolveImportActionErrorMessage(error, "Staged row update failed."),
    };
  }
}

export async function removeStagedImportRow(
  sessionId: string,
  rowId: string
): Promise<ApiResponse<{ rowId: string; stagedRows: number; conflictRows: number }>> {
  const featureGateError = rejectIfImportFeatureDisabled<{
    rowId: string;
    stagedRows: number;
    conflictRows: number;
  }>();
  if (featureGateError) {
    return featureGateError;
  }

  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }

    const result = await importReviewService.removeStagedRow({
      userId: authResult.userId,
      sessionId,
      rowId,
    });

    revalidatePath("/import");
    return { success: true, data: result };
  } catch (error) {
    logger.error("Failed to remove staged import row", "removeStagedImportRow", error);
    return {
      success: false,
      error: resolveImportActionErrorMessage(error, "Staged row removal failed."),
    };
  }
}

export async function saveImportConflictDecisions(
  sessionId: string,
  decisions: Array<{ conflictId: string; decision: ImportDecisionValue }>
): Promise<ApiResponse<{ savedCount: number }>> {
  const featureGateError = rejectIfImportFeatureDisabled<{ savedCount: number }>();
  if (featureGateError) {
    return featureGateError;
  }

  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }

    const result = await importReviewService.saveConflictDecisions({
      userId: authResult.userId,
      sessionId,
      decisions,
    });

    revalidatePath("/import");
    return { success: true, data: result };
  } catch (error) {
    logger.error(
      "Failed to persist import conflict decisions",
      "saveImportConflictDecisions",
      error
    );
    return {
      success: false,
      error: resolveImportActionErrorMessage(error, "Conflict decision save failed."),
    };
  }
}
