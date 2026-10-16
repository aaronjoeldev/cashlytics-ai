/**
 * Salary plan math: how the monthly income splits into fixed costs, reserves for infrequent bills,
 * an everyday budget and savings, and what is left.
 *
 * Dates are UTC-midnight calendar days, like everywhere in `recurrence.ts`.
 */

/**
 * Average monthly spending over the last `months` full calendar months before `today`'s month.
 * Months without any entry are left out, so a new user is not averaged down by empty months.
 */
export function averageMonthlySpending(
  entries: Array<{ date: Date; amount: number }>,
  today: Date,
  months = 3
): { average: number; monthsWithData: number } {
  const totals = new Map<number, number>();
  const currentMonth = today.getUTCFullYear() * 12 + today.getUTCMonth();
  for (const entry of entries) {
    const date = new Date(entry.date);
    const month = date.getUTCFullYear() * 12 + date.getUTCMonth();
    if (month >= currentMonth - months && month < currentMonth) {
      totals.set(month, (totals.get(month) ?? 0) + entry.amount);
    }
  }
  const monthsWithData = totals.size;
  const sum = [...totals.values()].reduce((a, b) => a + b, 0);
  return { average: monthsWithData > 0 ? sum / monthsWithData : 0, monthsWithData };
}

export type PlanAmounts = {
  income: number;
  fixed: number;
  reserves: number;
  everyday: number;
  savings: number;
};

export type PlanSplit = {
  /** Income minus all planned amounts; negative when the plan does not add up. */
  free: number;
  /** Share of the income per part, 0 to 1, for the bar. A negative remainder counts as 0. */
  shares: { fixed: number; reserves: number; everyday: number; savings: number; free: number };
};

export function splitIncome({
  income,
  fixed,
  reserves,
  everyday,
  savings,
}: PlanAmounts): PlanSplit {
  const free = Math.round((income - fixed - reserves - everyday - savings) * 100) / 100;
  // Without income, or when the plan exceeds it, the parts are shown relative to their own total
  const base = Math.max(income, fixed + reserves + everyday + savings, 0);
  const share = (n: number) => (base > 0 ? Math.max(0, n) / base : 0);
  return {
    free,
    shares: {
      fixed: share(fixed),
      reserves: share(reserves),
      everyday: share(everyday),
      savings: share(savings),
      free: share(free),
    },
  };
}
