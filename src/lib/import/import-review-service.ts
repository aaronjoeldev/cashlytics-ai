import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { importConflicts, importDecisions, importRows, importSessions } from "@/lib/db/schema";

const SESSION_MUTABLE_STATUSES = new Set(["draft", "review"]);
const DECISION_VALUES = ["keep_both", "replace_existing", "skip_import_row"] as const;

export type ImportDecisionValue = (typeof DECISION_VALUES)[number];

export type UpdateStagedImportRowInput = {
  userId: string;
  sessionId: string;
  rowId: string;
  patch: {
    bookingDate?: Date | string | null;
    amount?: string;
    currency?: string;
    description?: string;
    counterparty?: string | null;
    senderAccount?: string | null;
    receiverAccount?: string | null;
    balanceAfterBooking?: string | null;
  };
};

export type RemoveStagedImportRowInput = {
  userId: string;
  sessionId: string;
  rowId: string;
};

export type SaveConflictDecisionsInput = {
  userId: string;
  sessionId: string;
  decisions: {
    conflictId: string;
    decision: ImportDecisionValue;
  }[];
};

type ImportSessionRecord = {
  id: string;
  userId: string;
  status: "draft" | "review" | "confirmed" | "cancelled";
};

type ImportRowRecord = {
  id: string;
  userId: string;
  sessionId: string;
  bookingDate: Date | null;
  amount: string;
  currency: string;
  description: string;
  counterparty: string | null;
  senderAccount: string | null;
  receiverAccount: string | null;
  balanceAfterBooking: string | null;
  normalizedPayload: string;
  excludedByUser: boolean;
};

type ImportReviewStore = {
  getSessionById(userId: string, sessionId: string): Promise<ImportSessionRecord | null>;
  getRowById(userId: string, sessionId: string, rowId: string): Promise<ImportRowRecord | null>;
  updateRow(userId: string, sessionId: string, rowId: string, row: ImportRowRecord): Promise<void>;
  excludeRowAndClearConflicts(userId: string, sessionId: string, rowId: string): Promise<void>;
  countIncludedRows(userId: string, sessionId: string): Promise<number>;
  countConflicts(userId: string, sessionId: string): Promise<number>;
  replaceDecisions(
    userId: string,
    sessionId: string,
    decisions: SaveConflictDecisionsInput["decisions"]
  ): Promise<number>;
  updateSessionCounters(
    userId: string,
    sessionId: string,
    counters: { stagedRows: number; conflictRows: number }
  ): Promise<void>;
};

export type ImportReviewServiceDeps = {
  inTransaction<T>(callback: (store: ImportReviewStore) => Promise<T>): Promise<T>;
};

const updateRowInputSchema = z.object({
  userId: z.guid(),
  sessionId: z.guid(),
  rowId: z.guid(),
  patch: z
    .object({
      bookingDate: z
        .union([z.date(), z.string(), z.null()])
        .optional()
        .transform((value) => {
          if (value === undefined || value === null || value instanceof Date) {
            return value;
          }
          const parsed = new Date(value);
          return Number.isNaN(parsed.getTime()) ? undefined : parsed;
        }),
      amount: z.string().min(1).optional(),
      currency: z.string().trim().min(3).max(3).optional(),
      description: z.string().trim().min(1).max(255).optional(),
      counterparty: z.string().trim().max(255).optional().nullable(),
      senderAccount: z.string().trim().max(255).optional().nullable(),
      receiverAccount: z.string().trim().max(255).optional().nullable(),
      balanceAfterBooking: z.string().min(1).optional().nullable(),
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: "At least one staged row field must be provided",
    }),
});

const removeRowInputSchema = z.object({
  userId: z.guid(),
  sessionId: z.guid(),
  rowId: z.guid(),
});

const saveDecisionsInputSchema = z.object({
  userId: z.guid(),
  sessionId: z.guid(),
  decisions: z
    .array(
      z.object({
        conflictId: z.guid(),
        decision: z.enum(DECISION_VALUES),
      })
    )
    .min(1),
});

function normalizeDecimalString(value: string, fieldName: string): string {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid ${fieldName}`);
  }
  return parsed.toFixed(2);
}

function normalizeDateValue(value: Date | null | undefined, fieldName: string): Date | null {
  if (value === undefined || value === null) {
    return value ?? null;
  }

  if (Number.isNaN(value.getTime())) {
    throw new Error(`Invalid ${fieldName}`);
  }

  return value;
}

function parseNormalizedPayload(payload: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(payload);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

function assertSessionMutable(session: ImportSessionRecord | null): ImportSessionRecord {
  if (!session) {
    throw new Error("Import session not found");
  }

  if (!SESSION_MUTABLE_STATUSES.has(session.status)) {
    throw new Error("Import session is not editable");
  }

  return session;
}

export function createImportReviewService(deps: ImportReviewServiceDeps) {
  return {
    async updateStagedRow(input: UpdateStagedImportRowInput): Promise<{ rowId: string }> {
      const parsedInput = updateRowInputSchema.safeParse(input);
      if (!parsedInput.success) {
        throw new Error("Invalid staged row update payload");
      }

      return deps.inTransaction(async (store) => {
        const session = await store.getSessionById(
          parsedInput.data.userId,
          parsedInput.data.sessionId
        );
        assertSessionMutable(session);

        const row = await store.getRowById(
          parsedInput.data.userId,
          parsedInput.data.sessionId,
          parsedInput.data.rowId
        );
        if (!row) {
          throw new Error("Staged import row not found");
        }

        if (row.excludedByUser) {
          throw new Error("Excluded rows cannot be edited");
        }

        const nextRow: ImportRowRecord = {
          ...row,
          bookingDate:
            parsedInput.data.patch.bookingDate === undefined
              ? row.bookingDate
              : normalizeDateValue(parsedInput.data.patch.bookingDate, "bookingDate"),
          amount:
            parsedInput.data.patch.amount === undefined
              ? row.amount
              : normalizeDecimalString(parsedInput.data.patch.amount, "amount"),
          currency:
            parsedInput.data.patch.currency === undefined
              ? row.currency
              : parsedInput.data.patch.currency.toUpperCase(),
          description:
            parsedInput.data.patch.description === undefined
              ? row.description
              : parsedInput.data.patch.description.trim(),
          counterparty:
            parsedInput.data.patch.counterparty === undefined
              ? row.counterparty
              : parsedInput.data.patch.counterparty?.trim() || null,
          senderAccount:
            parsedInput.data.patch.senderAccount === undefined
              ? row.senderAccount
              : parsedInput.data.patch.senderAccount?.trim() || null,
          receiverAccount:
            parsedInput.data.patch.receiverAccount === undefined
              ? row.receiverAccount
              : parsedInput.data.patch.receiverAccount?.trim() || null,
          balanceAfterBooking:
            parsedInput.data.patch.balanceAfterBooking === undefined
              ? row.balanceAfterBooking
              : parsedInput.data.patch.balanceAfterBooking === null
                ? null
                : normalizeDecimalString(
                    parsedInput.data.patch.balanceAfterBooking,
                    "balanceAfterBooking"
                  ),
        };

        const normalizedPayload = parseNormalizedPayload(row.normalizedPayload);
        const nextNormalizedPayload = {
          ...normalizedPayload,
          bookingDate: nextRow.bookingDate ? nextRow.bookingDate.toISOString().slice(0, 10) : null,
          amount: nextRow.amount,
          currency: nextRow.currency,
          description: nextRow.description,
          counterparty: nextRow.counterparty,
          senderAccount: nextRow.senderAccount,
          receiverAccount: nextRow.receiverAccount,
          balanceAfterBooking: nextRow.balanceAfterBooking,
        };

        await store.updateRow(
          parsedInput.data.userId,
          parsedInput.data.sessionId,
          parsedInput.data.rowId,
          {
            ...nextRow,
            normalizedPayload: JSON.stringify(nextNormalizedPayload),
          }
        );

        return { rowId: nextRow.id };
      });
    },

    async removeStagedRow(
      input: RemoveStagedImportRowInput
    ): Promise<{ rowId: string; stagedRows: number; conflictRows: number }> {
      const parsedInput = removeRowInputSchema.safeParse(input);
      if (!parsedInput.success) {
        throw new Error("Invalid staged row removal payload");
      }

      return deps.inTransaction(async (store) => {
        const session = await store.getSessionById(
          parsedInput.data.userId,
          parsedInput.data.sessionId
        );
        assertSessionMutable(session);

        await store.excludeRowAndClearConflicts(
          parsedInput.data.userId,
          parsedInput.data.sessionId,
          parsedInput.data.rowId
        );

        const [stagedRows, conflictRows] = await Promise.all([
          store.countIncludedRows(parsedInput.data.userId, parsedInput.data.sessionId),
          store.countConflicts(parsedInput.data.userId, parsedInput.data.sessionId),
        ]);

        await store.updateSessionCounters(parsedInput.data.userId, parsedInput.data.sessionId, {
          stagedRows,
          conflictRows,
        });

        return {
          rowId: parsedInput.data.rowId,
          stagedRows,
          conflictRows,
        };
      });
    },

    async saveConflictDecisions(
      input: SaveConflictDecisionsInput
    ): Promise<{ savedCount: number }> {
      const parsedInput = saveDecisionsInputSchema.safeParse(input);
      if (!parsedInput.success) {
        throw new Error("Invalid conflict decision payload");
      }

      const uniqueConflictIds = new Set(
        parsedInput.data.decisions.map((decision) => decision.conflictId)
      );
      if (uniqueConflictIds.size !== parsedInput.data.decisions.length) {
        throw new Error("Duplicate conflict decisions are not allowed");
      }

      return deps.inTransaction(async (store) => {
        const session = await store.getSessionById(
          parsedInput.data.userId,
          parsedInput.data.sessionId
        );
        assertSessionMutable(session);

        const savedCount = await store.replaceDecisions(
          parsedInput.data.userId,
          parsedInput.data.sessionId,
          parsedInput.data.decisions
        );

        return { savedCount };
      });
    },
  };
}

type TransactionClient = Pick<typeof db, "select" | "insert" | "update" | "delete">;

function createTxStore(tx: TransactionClient): ImportReviewStore {
  return {
    async getSessionById(userId, sessionId) {
      const [session] = await tx
        .select({
          id: importSessions.id,
          userId: importSessions.userId,
          status: importSessions.status,
        })
        .from(importSessions)
        .where(and(eq(importSessions.id, sessionId), eq(importSessions.userId, userId)))
        .limit(1);

      return session ?? null;
    },

    async getRowById(userId, sessionId, rowId) {
      const [row] = await tx
        .select({
          id: importRows.id,
          userId: importRows.userId,
          sessionId: importRows.sessionId,
          bookingDate: importRows.bookingDate,
          amount: importRows.amount,
          currency: importRows.currency,
          description: importRows.description,
          counterparty: importRows.counterparty,
          senderAccount: importRows.senderAccount,
          receiverAccount: importRows.receiverAccount,
          balanceAfterBooking: importRows.balanceAfterBooking,
          normalizedPayload: importRows.normalizedPayload,
          excludedByUser: importRows.excludedByUser,
        })
        .from(importRows)
        .where(
          and(
            eq(importRows.id, rowId),
            eq(importRows.sessionId, sessionId),
            eq(importRows.userId, userId)
          )
        )
        .limit(1);

      return row ?? null;
    },

    async updateRow(userId, sessionId, rowId, row) {
      const [updatedRow] = await tx
        .update(importRows)
        .set({
          bookingDate: row.bookingDate,
          amount: row.amount,
          currency: row.currency,
          description: row.description,
          counterparty: row.counterparty,
          senderAccount: row.senderAccount,
          receiverAccount: row.receiverAccount,
          balanceAfterBooking: row.balanceAfterBooking,
          normalizedPayload: row.normalizedPayload,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(importRows.id, rowId),
            eq(importRows.sessionId, sessionId),
            eq(importRows.userId, userId)
          )
        )
        .returning({ id: importRows.id });

      if (!updatedRow) {
        throw new Error("Staged import row not found");
      }
    },

    async excludeRowAndClearConflicts(userId, sessionId, rowId) {
      const [updatedRow] = await tx
        .update(importRows)
        .set({ excludedByUser: true, updatedAt: new Date() })
        .where(
          and(
            eq(importRows.id, rowId),
            eq(importRows.sessionId, sessionId),
            eq(importRows.userId, userId)
          )
        )
        .returning({ id: importRows.id });

      if (!updatedRow) {
        throw new Error("Staged import row not found");
      }

      await tx
        .delete(importConflicts)
        .where(
          and(
            eq(importConflicts.userId, userId),
            eq(importConflicts.sessionId, sessionId),
            eq(importConflicts.importRowId, rowId)
          )
        );
    },

    async countIncludedRows(userId, sessionId) {
      const rows = await tx
        .select({ id: importRows.id })
        .from(importRows)
        .where(
          and(
            eq(importRows.userId, userId),
            eq(importRows.sessionId, sessionId),
            eq(importRows.excludedByUser, false)
          )
        );

      return rows.length;
    },

    async countConflicts(userId, sessionId) {
      const conflicts = await tx
        .select({ id: importConflicts.id })
        .from(importConflicts)
        .where(and(eq(importConflicts.userId, userId), eq(importConflicts.sessionId, sessionId)));

      return conflicts.length;
    },

    async replaceDecisions(userId, sessionId, decisions) {
      const conflictIds = decisions.map((decision) => decision.conflictId);
      const matchingConflicts = await tx
        .select({ id: importConflicts.id })
        .from(importConflicts)
        .where(
          and(
            eq(importConflicts.userId, userId),
            eq(importConflicts.sessionId, sessionId),
            inArray(importConflicts.id, conflictIds)
          )
        );

      if (matchingConflicts.length !== decisions.length) {
        throw new Error("One or more conflict decisions target invalid rows");
      }

      await tx
        .delete(importDecisions)
        .where(
          and(
            eq(importDecisions.userId, userId),
            eq(importDecisions.sessionId, sessionId),
            inArray(importDecisions.conflictId, conflictIds)
          )
        );

      await tx.insert(importDecisions).values(
        decisions.map((decision) => ({
          userId,
          sessionId,
          conflictId: decision.conflictId,
          decision: decision.decision,
          decidedAt: new Date(),
          updatedAt: new Date(),
        }))
      );

      return decisions.length;
    },

    async updateSessionCounters(userId, sessionId, counters) {
      const [updatedSession] = await tx
        .update(importSessions)
        .set({
          stagedRows: counters.stagedRows,
          conflictRows: counters.conflictRows,
          updatedAt: new Date(),
        })
        .where(and(eq(importSessions.id, sessionId), eq(importSessions.userId, userId)))
        .returning({ id: importSessions.id });

      if (!updatedSession) {
        throw new Error("Import session not found");
      }
    },
  };
}

export const importReviewService = createImportReviewService({
  inTransaction: async (callback) => {
    return db.transaction(async (tx) => {
      return callback(createTxStore(tx));
    });
  },
});
