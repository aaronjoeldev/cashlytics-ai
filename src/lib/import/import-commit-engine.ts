import { and, eq, inArray } from "drizzle-orm";
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

export type ImportDecisionValue = "keep_both" | "replace_existing" | "skip_import_row";

export type ImportConflictDecisionInput = {
  conflictId: string;
  decision: ImportDecisionValue;
};

export type ImportCommitInput = {
  userId: string;
  sessionId: string;
  decisions?: ImportConflictDecisionInput[];
};

export type ImportCommitResult = {
  sessionId: string;
  idempotent: boolean;
  insertedIncomeCount: number;
  insertedExpenseCount: number;
  replacedIncomeCount: number;
  replacedExpenseCount: number;
  skippedCount: number;
};

type ImportSessionRecord = {
  id: string;
  userId: string;
  accountId: string;
  accountCurrency: string;
  status: "draft" | "review" | "confirmed" | "cancelled";
};

type ImportRowRecord = {
  id: string;
  sessionId: string;
  userId: string;
  rowIndex: number;
  bookingDate: Date | null;
  amount: string;
  currency: string;
  description: string;
  excludedByUser: boolean;
};

type ImportConflictRecord = {
  id: string;
  sessionId: string;
  userId: string;
  importRowId: string;
  existingExpenseId: string | null;
  existingIncomeId: string | null;
};

type ImportDecisionRecord = {
  conflictId: string;
  decision: ImportDecisionValue;
};

type ImportCommitDataStore = {
  getSessionById(userId: string, sessionId: string): Promise<ImportSessionRecord | null>;
  isAccountOwnedByUser(userId: string, accountId: string): Promise<boolean>;
  getSessionRows(userId: string, sessionId: string): Promise<ImportRowRecord[]>;
  getSessionConflicts(userId: string, sessionId: string): Promise<ImportConflictRecord[]>;
  replaceDecisions(
    userId: string,
    sessionId: string,
    decisions: ImportConflictDecisionInput[]
  ): Promise<void>;
  getSessionDecisions(userId: string, sessionId: string): Promise<ImportDecisionRecord[]>;
  insertIncome(params: {
    userId: string;
    accountId: string;
    source: string;
    amount: string;
    startDate: Date;
    info: string;
  }): Promise<void>;
  insertExpense(params: {
    userId: string;
    accountId: string;
    description: string;
    amount: string;
    currency: string;
    originalAmount: string | null;
    date: Date;
    info: string;
  }): Promise<void>;
  updateIncome(
    userId: string,
    incomeId: string,
    params: {
      accountId: string;
      source: string;
      amount: string;
      startDate: Date;
      info: string;
    }
  ): Promise<void>;
  updateExpense(
    userId: string,
    expenseId: string,
    params: {
      accountId: string;
      description: string;
      amount: string;
      currency: string;
      originalAmount: string | null;
      date: Date;
      info: string;
    }
  ): Promise<void>;
  markSessionConfirmed(userId: string, sessionId: string): Promise<void>;
};

export type ImportCommitEngineDeps = {
  inTransaction<T>(callback: (store: ImportCommitDataStore) => Promise<T>): Promise<T>;
};

type RowConflictResolution = {
  decision: ImportDecisionValue;
  existingExpenseId: string | null;
  existingIncomeId: string | null;
};

function parseAmountToDecimalString(amountText: string): string {
  const parsed = Number.parseFloat(amountText);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid import amount: ${amountText}`);
  }
  return Math.abs(parsed).toFixed(2);
}

function getRowDate(row: ImportRowRecord): Date {
  return row.bookingDate ?? new Date();
}

function buildAuditInfo(sessionId: string, rowIndex: number): string {
  return `CSV import session ${sessionId} row ${rowIndex}`;
}

function getRowResolutionByRowId(
  conflicts: ImportConflictRecord[],
  decisions: ImportDecisionRecord[]
): Map<string, RowConflictResolution> {
  const conflictById = new Map(conflicts.map((conflict) => [conflict.id, conflict]));
  const decisionByConflictId = new Map(
    decisions.map((decision) => [decision.conflictId, decision.decision])
  );
  const resolutionByRowId = new Map<string, RowConflictResolution>();

  for (const conflict of conflicts) {
    const decision = decisionByConflictId.get(conflict.id);
    if (!decision) {
      throw new Error(`Missing conflict decision for conflict ${conflict.id}`);
    }

    if (resolutionByRowId.has(conflict.importRowId)) {
      throw new Error(`Multiple conflicts detected for import row ${conflict.importRowId}`);
    }

    const sourceConflict = conflictById.get(conflict.id);
    if (!sourceConflict) {
      throw new Error(`Conflict not found while resolving decision ${conflict.id}`);
    }

    resolutionByRowId.set(conflict.importRowId, {
      decision,
      existingExpenseId: sourceConflict.existingExpenseId,
      existingIncomeId: sourceConflict.existingIncomeId,
    });
  }

  return resolutionByRowId;
}

async function applyRow(
  store: ImportCommitDataStore,
  session: ImportSessionRecord,
  row: ImportRowRecord,
  rowResolution: RowConflictResolution | undefined,
  counters: {
    insertedIncomeCount: number;
    insertedExpenseCount: number;
    replacedIncomeCount: number;
    replacedExpenseCount: number;
    skippedCount: number;
  }
): Promise<void> {
  const amount = parseAmountToDecimalString(row.amount);
  const amountDirection = Number.parseFloat(row.amount);
  const rowDate = getRowDate(row);
  const info = buildAuditInfo(session.id, row.rowIndex);

  // Resolve currency: row currency takes precedence, fallback to account currency
  const rowCurrency = row.currency || session.accountCurrency;
  const originalAmount =
    row.currency && row.currency !== session.accountCurrency ? amount : null;
  // exchangeRate: null — TODO: Phase 2 — getExchangeRate(row.currency, session.accountCurrency)

  const decision = rowResolution?.decision ?? "keep_both";

  if (decision === "skip_import_row") {
    counters.skippedCount += 1;
    return;
  }

  if (decision === "replace_existing") {
    if (rowResolution?.existingIncomeId) {
      await store.updateIncome(session.userId, rowResolution.existingIncomeId, {
        accountId: session.accountId,
        source: row.description,
        amount,
        startDate: rowDate,
        info,
      });
      counters.replacedIncomeCount += 1;
      return;
    }

    if (rowResolution?.existingExpenseId) {
      await store.updateExpense(session.userId, rowResolution.existingExpenseId, {
        accountId: session.accountId,
        description: row.description,
        amount,
        currency: rowCurrency,
        originalAmount,
        date: rowDate,
        info,
      });
      counters.replacedExpenseCount += 1;
      return;
    }

    throw new Error(`replace_existing decision has no target for row ${row.id}`);
  }

  if (amountDirection >= 0) {
    await store.insertIncome({
      userId: session.userId,
      accountId: session.accountId,
      source: row.description,
      amount,
      startDate: rowDate,
      info,
    });
    counters.insertedIncomeCount += 1;
    return;
  }

  await store.insertExpense({
    userId: session.userId,
    accountId: session.accountId,
    description: row.description,
    amount,
    currency: rowCurrency,
    originalAmount,
    date: rowDate,
    info,
  });
  counters.insertedExpenseCount += 1;
}

export function createImportCommitEngine(deps: ImportCommitEngineDeps) {
  return {
    async commitApprovedRows(input: ImportCommitInput): Promise<ImportCommitResult> {
      return deps.inTransaction(async (store) => {
        const session = await store.getSessionById(input.userId, input.sessionId);
        if (!session) {
          throw new Error("Import session not found");
        }

        if (session.status === "confirmed") {
          return {
            sessionId: session.id,
            idempotent: true,
            insertedIncomeCount: 0,
            insertedExpenseCount: 0,
            replacedIncomeCount: 0,
            replacedExpenseCount: 0,
            skippedCount: 0,
          };
        }

        if (session.status === "cancelled") {
          throw new Error("Cancelled import session cannot be committed");
        }

        const accountOwnedByUser = await store.isAccountOwnedByUser(
          input.userId,
          session.accountId
        );
        if (!accountOwnedByUser) {
          throw new Error("Import session account is not owned by user");
        }

        if (input.decisions && input.decisions.length > 0) {
          await store.replaceDecisions(input.userId, input.sessionId, input.decisions);
        }

        const [rows, conflicts, decisions] = await Promise.all([
          store.getSessionRows(input.userId, input.sessionId),
          store.getSessionConflicts(input.userId, input.sessionId),
          store.getSessionDecisions(input.userId, input.sessionId),
        ]);

        const resolutionByRowId = getRowResolutionByRowId(conflicts, decisions);
        const counters = {
          insertedIncomeCount: 0,
          insertedExpenseCount: 0,
          replacedIncomeCount: 0,
          replacedExpenseCount: 0,
          skippedCount: 0,
        };

        for (const row of rows) {
          if (row.excludedByUser) {
            counters.skippedCount += 1;
            continue;
          }

          const rowResolution = resolutionByRowId.get(row.id);
          await applyRow(store, session, row, rowResolution, counters);
        }

        await store.markSessionConfirmed(input.userId, input.sessionId);

        return {
          sessionId: session.id,
          idempotent: false,
          ...counters,
        };
      });
    },
  };
}

type TransactionClient = Pick<typeof db, "select" | "insert" | "update" | "delete">;

function createTxStore(tx: TransactionClient): ImportCommitDataStore {
  return {
    async getSessionById(userId, sessionId) {
      const [row] = await tx
        .select({
          id: importSessions.id,
          userId: importSessions.userId,
          accountId: importSessions.accountId,
          status: importSessions.status,
          accountCurrency: accounts.currency,
        })
        .from(importSessions)
        .innerJoin(accounts, eq(accounts.id, importSessions.accountId))
        .where(and(eq(importSessions.id, sessionId), eq(importSessions.userId, userId)))
        .limit(1);

      if (!row) return null;
      return {
        id: row.id,
        userId: row.userId,
        accountId: row.accountId,
        status: row.status,
        accountCurrency: row.accountCurrency ?? "EUR",
      };
    },

    async isAccountOwnedByUser(userId, accountId) {
      const [ownedAccount] = await tx
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
        .limit(1);

      return Boolean(ownedAccount);
    },

    async getSessionRows(userId, sessionId) {
      return tx
        .select({
          id: importRows.id,
          sessionId: importRows.sessionId,
          userId: importRows.userId,
          rowIndex: importRows.rowIndex,
          bookingDate: importRows.bookingDate,
          amount: importRows.amount,
          currency: importRows.currency,
          description: importRows.description,
          excludedByUser: importRows.excludedByUser,
        })
        .from(importRows)
        .where(and(eq(importRows.sessionId, sessionId), eq(importRows.userId, userId)))
        .orderBy(importRows.rowIndex);
    },

    async getSessionConflicts(userId, sessionId) {
      return tx
        .select({
          id: importConflicts.id,
          sessionId: importConflicts.sessionId,
          userId: importConflicts.userId,
          importRowId: importConflicts.importRowId,
          existingExpenseId: importConflicts.existingExpenseId,
          existingIncomeId: importConflicts.existingIncomeId,
        })
        .from(importConflicts)
        .where(and(eq(importConflicts.sessionId, sessionId), eq(importConflicts.userId, userId)));
    },

    async replaceDecisions(userId, sessionId, decisions) {
      const conflictIds = decisions.map((decision) => decision.conflictId);
      if (conflictIds.length === 0) {
        return;
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
        }))
      );
    },

    async getSessionDecisions(userId, sessionId) {
      return tx
        .select({
          conflictId: importDecisions.conflictId,
          decision: importDecisions.decision,
        })
        .from(importDecisions)
        .where(and(eq(importDecisions.sessionId, sessionId), eq(importDecisions.userId, userId)));
    },

    async insertIncome(params) {
      await tx.insert(incomes).values({
        userId: params.userId,
        accountId: params.accountId,
        source: params.source,
        amount: params.amount,
        recurrenceType: "once",
        startDate: params.startDate,
        endDate: null,
        info: params.info,
      });
    },

    async insertExpense(params) {
      await tx.insert(dailyExpenses).values({
        userId: params.userId,
        accountId: params.accountId,
        description: params.description,
        amount: params.amount,
        currency: params.currency,
        originalAmount: params.originalAmount ?? null,
        // exchangeRate: null, // TODO: Phase 2 — getExchangeRate(row.currency, account.currency)
        date: params.date,
        info: params.info,
      });
    },

    async updateIncome(userId, incomeId, params) {
      const [updatedIncome] = await tx
        .update(incomes)
        .set({
          accountId: params.accountId,
          source: params.source,
          amount: params.amount,
          recurrenceType: "once",
          startDate: params.startDate,
          endDate: null,
          info: params.info,
        })
        .where(and(eq(incomes.id, incomeId), eq(incomes.userId, userId)))
        .returning({ id: incomes.id });

      if (!updatedIncome) {
        throw new Error(`Income replacement target not found: ${incomeId}`);
      }
    },

    async updateExpense(userId, expenseId, params) {
      const [updatedExpense] = await tx
        .update(dailyExpenses)
        .set({
          accountId: params.accountId,
          description: params.description,
          amount: params.amount,
          date: params.date,
          info: params.info,
        })
        .where(and(eq(dailyExpenses.id, expenseId), eq(dailyExpenses.userId, userId)))
        .returning({ id: dailyExpenses.id });

      if (!updatedExpense) {
        throw new Error(`Expense replacement target not found: ${expenseId}`);
      }
    },

    async markSessionConfirmed(userId, sessionId) {
      const [updatedSession] = await tx
        .update(importSessions)
        .set({
          status: "confirmed",
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(importSessions.id, sessionId), eq(importSessions.userId, userId)))
        .returning({ id: importSessions.id });

      if (!updatedSession) {
        throw new Error(`Import session not found for confirmation: ${sessionId}`);
      }
    },
  };
}

export const importCommitEngine = createImportCommitEngine({
  inTransaction: async (callback) => {
    return db.transaction(async (tx) => {
      return callback(createTxStore(tx));
    });
  },
});
