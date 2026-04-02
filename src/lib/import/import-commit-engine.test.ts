import assert from "node:assert/strict";
import test from "node:test";
import {
  createImportCommitEngine,
  type ImportCommitEngineDeps,
  type ImportConflictDecisionInput,
} from "./import-commit-engine";

type MemorySession = {
  id: string;
  userId: string;
  accountId: string;
  accountCurrency: string;
  status: "draft" | "review" | "confirmed" | "cancelled";
};

type MemoryRow = {
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

type MemoryConflict = {
  id: string;
  sessionId: string;
  userId: string;
  importRowId: string;
  existingExpenseId: string | null;
  existingIncomeId: string | null;
};

type MemoryDecision = {
  conflictId: string;
  sessionId: string;
  userId: string;
  decision: "keep_both" | "replace_existing" | "skip_import_row";
};

type MemoryExpense = {
  id: string;
  userId: string;
  accountId: string;
  description: string;
  amount: string;
  date: Date;
  info: string;
};

type MemoryIncome = {
  id: string;
  userId: string;
  accountId: string;
  source: string;
  amount: string;
  startDate: Date;
  info: string;
};

type MemoryState = {
  accountOwnership: Record<string, string[]>;
  sessions: MemorySession[];
  rows: MemoryRow[];
  conflicts: MemoryConflict[];
  decisions: MemoryDecision[];
  expenses: MemoryExpense[];
  incomes: MemoryIncome[];
};

function createMemoryDeps(state: MemoryState): ImportCommitEngineDeps {
  return {
    async inTransaction(callback) {
      const draft = structuredClone(state) as MemoryState;

      const store = {
        async getSessionById(userId: string, sessionId: string) {
          return (
            draft.sessions.find(
              (session) => session.id === sessionId && session.userId === userId
            ) ?? null
          );
        },

        async isAccountOwnedByUser(userId: string, accountId: string) {
          return (draft.accountOwnership[userId] ?? []).includes(accountId);
        },

        async getSessionRows(userId: string, sessionId: string) {
          return draft.rows
            .filter((row) => row.userId === userId && row.sessionId === sessionId)
            .sort((a, b) => a.rowIndex - b.rowIndex);
        },

        async getSessionConflicts(userId: string, sessionId: string) {
          return draft.conflicts.filter(
            (conflict) => conflict.userId === userId && conflict.sessionId === sessionId
          );
        },

        async replaceDecisions(
          userId: string,
          sessionId: string,
          decisions: ImportConflictDecisionInput[]
        ) {
          const conflictIds = new Set(decisions.map((decision) => decision.conflictId));
          draft.decisions = draft.decisions.filter(
            (decision) =>
              !(
                decision.userId === userId &&
                decision.sessionId === sessionId &&
                conflictIds.has(decision.conflictId)
              )
          );

          draft.decisions.push(
            ...decisions.map((decision) => ({
              userId,
              sessionId,
              conflictId: decision.conflictId,
              decision: decision.decision,
            }))
          );
        },

        async getSessionDecisions(userId: string, sessionId: string) {
          return draft.decisions
            .filter((decision) => decision.userId === userId && decision.sessionId === sessionId)
            .map((decision) => ({ conflictId: decision.conflictId, decision: decision.decision }));
        },

        async insertIncome(params: {
          userId: string;
          accountId: string;
          source: string;
          amount: string;
          startDate: Date;
          info: string;
        }) {
          draft.incomes.push({
            id: `inc-${draft.incomes.length + 1}`,
            ...params,
          });
        },

        async insertExpense(params: {
          userId: string;
          accountId: string;
          description: string;
          amount: string;
          date: Date;
          info: string;
        }) {
          draft.expenses.push({
            id: `exp-${draft.expenses.length + 1}`,
            ...params,
          });
        },

        async updateIncome(
          userId: string,
          incomeId: string,
          params: {
            accountId: string;
            source: string;
            amount: string;
            startDate: Date;
            info: string;
          }
        ) {
          const income = draft.incomes.find(
            (item) => item.id === incomeId && item.userId === userId
          );
          if (!income) {
            throw new Error(`Income replacement target not found: ${incomeId}`);
          }

          Object.assign(income, params);
        },

        async updateExpense(
          userId: string,
          expenseId: string,
          params: {
            accountId: string;
            description: string;
            amount: string;
            date: Date;
            info: string;
          }
        ) {
          const expense = draft.expenses.find(
            (item) => item.id === expenseId && item.userId === userId
          );
          if (!expense) {
            throw new Error(`Expense replacement target not found: ${expenseId}`);
          }

          Object.assign(expense, params);
        },

        async markSessionConfirmed(userId: string, sessionId: string) {
          const session = draft.sessions.find(
            (item) => item.id === sessionId && item.userId === userId
          );
          if (!session) {
            throw new Error(`Import session not found for confirmation: ${sessionId}`);
          }

          session.status = "confirmed";
        },
      };

      try {
        const result = await callback(store);
        Object.assign(state, draft);
        return result;
      } catch (error) {
        throw error;
      }
    },
  };
}

test("commitApprovedRows persists approved rows and conflict outcomes", async () => {
  const state: MemoryState = {
    accountOwnership: { "user-1": ["acc-1"] },
    sessions: [{ id: "session-1", userId: "user-1", accountId: "acc-1", accountCurrency: "EUR", status: "review" }],
    rows: [
      {
        id: "row-1",
        sessionId: "session-1",
        userId: "user-1",
        rowIndex: 1,
        bookingDate: new Date("2026-03-01T10:00:00.000Z"),
        amount: "100.00",
        currency: "EUR",
        description: "Salary",
        excludedByUser: false,
      },
      {
        id: "row-2",
        sessionId: "session-1",
        userId: "user-1",
        rowIndex: 2,
        bookingDate: new Date("2026-03-02T10:00:00.000Z"),
        amount: "-15.99",
        currency: "EUR",
        description: "Coffee Shop",
        excludedByUser: false,
      },
      {
        id: "row-3",
        sessionId: "session-1",
        userId: "user-1",
        rowIndex: 3,
        bookingDate: new Date("2026-03-03T10:00:00.000Z"),
        amount: "-8.50",
        currency: "EUR",
        description: "Parking",
        excludedByUser: false,
      },
    ],
    conflicts: [
      {
        id: "conflict-1",
        sessionId: "session-1",
        userId: "user-1",
        importRowId: "row-2",
        existingExpenseId: "exp-existing-1",
        existingIncomeId: null,
      },
      {
        id: "conflict-2",
        sessionId: "session-1",
        userId: "user-1",
        importRowId: "row-3",
        existingExpenseId: "exp-existing-2",
        existingIncomeId: null,
      },
    ],
    decisions: [],
    expenses: [
      {
        id: "exp-existing-1",
        userId: "user-1",
        accountId: "acc-1",
        description: "Old Coffee",
        amount: "12.00",
        date: new Date("2026-02-01T10:00:00.000Z"),
        info: "existing",
      },
      {
        id: "exp-existing-2",
        userId: "user-1",
        accountId: "acc-1",
        description: "Old Parking",
        amount: "8.50",
        date: new Date("2026-02-01T10:00:00.000Z"),
        info: "existing",
      },
    ],
    incomes: [],
  };

  const engine = createImportCommitEngine(createMemoryDeps(state));
  const result = await engine.commitApprovedRows({
    userId: "user-1",
    sessionId: "session-1",
    decisions: [
      { conflictId: "conflict-1", decision: "replace_existing" },
      { conflictId: "conflict-2", decision: "skip_import_row" },
    ],
  });

  assert.equal(result.idempotent, false);
  assert.equal(result.insertedIncomeCount, 1);
  assert.equal(result.insertedExpenseCount, 0);
  assert.equal(result.replacedExpenseCount, 1);
  assert.equal(result.skippedCount, 1);
  assert.equal(state.sessions[0]?.status, "confirmed");
  assert.equal(state.decisions.length, 2);
  assert.equal(state.incomes.length, 1);
  assert.equal(
    state.expenses.find((item) => item.id === "exp-existing-1")?.description,
    "Coffee Shop"
  );
});

test("commitApprovedRows rolls back all writes when one write fails", async () => {
  const state: MemoryState = {
    accountOwnership: { "user-1": ["acc-1"] },
    sessions: [{ id: "session-rollback", userId: "user-1", accountId: "acc-1", accountCurrency: "EUR", status: "review" }],
    rows: [
      {
        id: "row-rollback",
        sessionId: "session-rollback",
        userId: "user-1",
        rowIndex: 1,
        bookingDate: new Date("2026-03-04T10:00:00.000Z"),
        amount: "-20.00",
        currency: "EUR",
        description: "Broken replacement",
        excludedByUser: false,
      },
    ],
    conflicts: [
      {
        id: "conflict-rollback",
        sessionId: "session-rollback",
        userId: "user-1",
        importRowId: "row-rollback",
        existingExpenseId: "missing-expense-id",
        existingIncomeId: null,
      },
    ],
    decisions: [],
    expenses: [],
    incomes: [],
  };

  const engine = createImportCommitEngine(createMemoryDeps(state));

  await assert.rejects(
    () =>
      engine.commitApprovedRows({
        userId: "user-1",
        sessionId: "session-rollback",
        decisions: [{ conflictId: "conflict-rollback", decision: "replace_existing" }],
      }),
    /Expense replacement target not found/
  );

  assert.equal(state.sessions[0]?.status, "review");
  assert.equal(state.decisions.length, 0);
  assert.equal(state.expenses.length, 0);
  assert.equal(state.incomes.length, 0);
});
