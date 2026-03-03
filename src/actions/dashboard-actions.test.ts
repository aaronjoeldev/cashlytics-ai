import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireAuthMock = vi.fn();
const dbSelectMock = vi.fn();

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: dbSelectMock,
    query: {
      dailyExpenses: {
        findMany: vi.fn(),
      },
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  accounts: {},
  incomes: {},
  expenses: {
    id: "expenses.id",
    userId: "expenses.userId",
    categoryId: "expenses.categoryId",
    endDate: "expenses.endDate",
  },
  dailyExpenses: {
    id: "dailyExpenses.id",
    userId: "dailyExpenses.userId",
    date: "dailyExpenses.date",
    categoryId: "dailyExpenses.categoryId",
  },
  categories: {
    id: "categories.id",
    name: "categories.name",
    icon: "categories.icon",
    color: "categories.color",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...parts: unknown[]) => ({ kind: "and", parts })),
  eq: vi.fn((left: unknown, right: unknown) => ({ kind: "eq", left, right })),
  gte: vi.fn((left: unknown, right: unknown) => ({ kind: "gte", left, right })),
  lte: vi.fn((left: unknown, right: unknown) => ({ kind: "lte", left, right })),
  desc: vi.fn(),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
}));

function queueSelectResult(result: unknown) {
  const whereMock = vi.fn().mockResolvedValue(result);
  const leftJoinMock = vi.fn().mockReturnValue({ where: whereMock });
  const fromMock = vi.fn().mockReturnValue({ leftJoin: leftJoinMock });
  dbSelectMock.mockReturnValueOnce({ from: fromMock });
}

function buildRecurringExpense(
  id: string,
  recurrenceType: string,
  startDate: Date,
  recurrenceInterval: number | null = null
) {
  return {
    expense: {
      id,
      name: `${recurrenceType}-payment`,
      amount: "25.50",
      startDate,
      recurrenceType,
      recurrenceInterval,
      isSubscription: true,
    },
    category: null,
  };
}

describe("getUpcomingPayments recurrence windows", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    requireAuthMock.mockResolvedValue({ userId: "user-1" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("includes monthly recurrence due later this month", async () => {
    vi.setSystemTime(new Date("2026-01-10T12:00:00.000Z"));
    queueSelectResult([
      buildRecurringExpense("exp-monthly-current", "monthly", new Date("2020-01-20T00:00:00.000Z")),
    ]);
    queueSelectResult([]);

    const { getUpcomingPayments } = await import("./dashboard-actions");
    const result = await getUpcomingPayments(14);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected successful response");
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe("exp-monthly-current");
    expect(result.data[0]?.date.getFullYear()).toBe(2026);
    expect(result.data[0]?.date.getMonth()).toBe(0);
    expect(result.data[0]?.date.getDate()).toBe(20);
  });

  it("includes yearly recurrence due later this year", async () => {
    vi.setSystemTime(new Date("2026-03-03T12:00:00.000Z"));
    queueSelectResult([
      buildRecurringExpense("exp-yearly-current", "yearly", new Date("2019-11-15T00:00:00.000Z")),
    ]);
    queueSelectResult([]);

    const { getUpcomingPayments } = await import("./dashboard-actions");
    const result = await getUpcomingPayments(365);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected successful response");
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe("exp-yearly-current");
    expect(result.data[0]?.date.getFullYear()).toBe(2026);
    expect(result.data[0]?.date.getMonth()).toBe(10);
    expect(result.data[0]?.date.getDate()).toBe(15);
  });

  it("moves monthly recurrence to next month when current month date already passed", async () => {
    vi.setSystemTime(new Date("2026-01-25T12:00:00.000Z"));
    queueSelectResult([
      buildRecurringExpense("exp-monthly-next", "monthly", new Date("2020-01-10T00:00:00.000Z")),
    ]);
    queueSelectResult([]);

    const { getUpcomingPayments } = await import("./dashboard-actions");
    const result = await getUpcomingPayments(20);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected successful response");
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe("exp-monthly-next");
    expect(result.data[0]?.date.getFullYear()).toBe(2026);
    expect(result.data[0]?.date.getMonth()).toBe(1);
    expect(result.data[0]?.date.getDate()).toBe(10);
  });

  it("moves yearly recurrence to next year when current year date already passed", async () => {
    vi.setSystemTime(new Date("2026-12-20T12:00:00.000Z"));
    queueSelectResult([
      buildRecurringExpense("exp-yearly-next", "yearly", new Date("2020-03-15T00:00:00.000Z")),
    ]);
    queueSelectResult([]);

    const { getUpcomingPayments } = await import("./dashboard-actions");
    const result = await getUpcomingPayments(120);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected successful response");
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe("exp-yearly-next");
    expect(result.data[0]?.date.getFullYear()).toBe(2027);
    expect(result.data[0]?.date.getMonth()).toBe(2);
    expect(result.data[0]?.date.getDate()).toBe(15);
  });
});
