import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuthMock = vi.fn();
const revalidatePathMock = vi.fn();
const loggerErrorMock = vi.fn();

const dbSelectMock = vi.fn();
const dbInsertMock = vi.fn();
const dbUpdateMock = vi.fn();
const dbDeleteMock = vi.fn();
const dbTransactionMock = vi.fn();
const txSelectMock = vi.fn();
const txDeleteMock = vi.fn();

const accountsMock = {
  id: "accounts.id",
  userId: "accounts.userId",
  balance: "accounts.balance",
};
const categoriesMock = {
  id: "categories.id",
  userId: "categories.userId",
};

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: loggerErrorMock,
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: dbSelectMock,
    insert: dbInsertMock,
    update: dbUpdateMock,
    delete: dbDeleteMock,
    transaction: dbTransactionMock,
  },
}));

vi.mock("@/lib/db/schema", () => ({
  expenses: { id: "expenses.id" },
  incomes: { id: "incomes.id" },
  dailyExpenses: { id: "dailyExpenses.id" },
  accounts: accountsMock,
  categories: categoriesMock,
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((left: unknown, right: unknown) => ({ kind: "eq", left, right })),
  and: vi.fn((...parts: unknown[]) => ({ kind: "and", parts })),
  gte: vi.fn(),
  lte: vi.fn(),
  desc: vi.fn(),
  ilike: vi.fn(),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
}));

function setOwnedAccountSelect() {
  const limitMock = vi.fn().mockResolvedValue([{ id: "acct-1" }]);
  const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
  const fromMock = vi.fn().mockReturnValue({ where: whereMock });
  dbSelectMock.mockReturnValueOnce({ from: fromMock });
}

function setInsertSuccess<T>(record: T) {
  const returningMock = vi.fn().mockResolvedValue([record]);
  const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
  dbInsertMock.mockReturnValueOnce({ values: valuesMock });
}

function setTransactionSuccess() {
  type Tx = {
    insert: typeof dbInsertMock;
    update: typeof dbUpdateMock;
    select: typeof txSelectMock;
    delete: typeof txDeleteMock;
  };

  const tx: Tx = {
    insert: dbInsertMock,
    update: dbUpdateMock,
    select: txSelectMock,
    delete: txDeleteMock,
  };

  dbTransactionMock.mockImplementationOnce(async (callback: (tx: Tx) => Promise<unknown>) =>
    callback(tx)
  );
}

function setUpdateSuccess() {
  const whereMock = vi.fn().mockResolvedValue(undefined);
  const setMock = vi.fn().mockReturnValue({ where: whereMock });
  dbUpdateMock.mockReturnValueOnce({ set: setMock });
}

function setUpdateFailure(error: Error) {
  const whereMock = vi.fn().mockRejectedValue(error);
  const setMock = vi.fn().mockReturnValue({ where: whereMock });
  dbUpdateMock.mockReturnValueOnce({ set: setMock });
}

describe("financial mutation consistency", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAuthMock.mockResolvedValue({ userId: "user-1" });
  });

  it("createExpense inserts before account balance decrement and attempts both", async () => {
    const { createExpense } = await import("./expense-actions");
    setOwnedAccountSelect();
    setTransactionSuccess();
    setInsertSuccess({ id: "exp-1", amount: 25 });
    setUpdateSuccess();

    const result = await createExpense({
      name: "Lunch",
      amount: "25",
      accountId: "acct-1",
      categoryId: undefined,
      startDate: new Date("2026-01-01"),
      recurrenceType: "monthly",
    });

    expect(result.success).toBe(true);
    expect(dbTransactionMock).toHaveBeenCalledTimes(1);
    expect(dbInsertMock).toHaveBeenCalledTimes(1);
    expect(dbUpdateMock).toHaveBeenCalledTimes(1);
    expect(dbInsertMock.mock.invocationCallOrder[0]).toBeLessThan(
      dbUpdateMock.mock.invocationCallOrder[0]
    );
  });

  it("createIncome inserts before account balance increment and attempts both", async () => {
    const { createIncome } = await import("./income-actions");
    setOwnedAccountSelect();
    setTransactionSuccess();
    setInsertSuccess({ id: "inc-1", amount: 55 });
    setUpdateSuccess();

    const result = await createIncome({
      source: "Salary",
      amount: "55",
      accountId: "acct-1",
      startDate: new Date("2026-01-01"),
      recurrenceType: "monthly",
    });

    expect(result.success).toBe(true);
    expect(dbTransactionMock).toHaveBeenCalledTimes(1);
    expect(dbInsertMock).toHaveBeenCalledTimes(1);
    expect(dbUpdateMock).toHaveBeenCalledTimes(1);
    expect(dbInsertMock.mock.invocationCallOrder[0]).toBeLessThan(
      dbUpdateMock.mock.invocationCallOrder[0]
    );
  });

  it("createExpense returns success false when balance update fails", async () => {
    const { createExpense } = await import("./expense-actions");
    setOwnedAccountSelect();
    setTransactionSuccess();
    setInsertSuccess({ id: "exp-2", amount: 99 });
    setUpdateFailure(new Error("balance update failed"));

    const result = await createExpense({
      name: "Laptop",
      amount: "99",
      accountId: "acct-1",
      categoryId: undefined,
      startDate: new Date("2026-01-01"),
      recurrenceType: "monthly",
    });

    expect(dbTransactionMock).toHaveBeenCalledTimes(1);
    expect(dbInsertMock).toHaveBeenCalledTimes(1);
    expect(dbUpdateMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ success: false, error: "Ausgabe konnte nicht erstellt werden." });
  });
});
