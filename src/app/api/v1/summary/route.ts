import { apiJson, calendarDay, money, parseQuery, percent, withApiToken } from "@/lib/api/v1";
import { isActiveInMonth } from "@/lib/recurrence";
import { computeDashboardStats, listUpcomingPayments } from "@/lib/services/dashboard";
import type { DashboardView } from "@/lib/services/dashboard";
import { computeForecast, listNormalizedExpenses } from "@/lib/services/analytics";
import { listActiveInsights } from "@/lib/services/insights";
import { summaryQuery } from "@/lib/validations/api";

function serializeView(view: DashboardView) {
  return {
    income: money(view.monthlyIncome),
    expenses: money(view.monthlyExpenses),
    surplus: money(view.savingsRate),
    incomeChangePct: percent(view.incomeTrend),
    // The dashboard negates the expense trend for its colouring; the API reports the change
    expensesChangePct: percent(-view.expenseTrend),
  };
}

/**
 * Everything an integration polls in one request: assets, the current month in both views,
 * recurring costs, upcoming payments, the forecast and the insight counts. Amounts are in the
 * user's base currency.
 */
export const GET = withApiToken("summary", async (request, context) => {
  const query = parseQuery(request, summaryQuery);
  if (query.response) return query.response;
  const { upcomingDays, forecastMonths } = query.data;

  const now = new Date();
  const [stats, upcoming, recurring, forecast, insights] = await Promise.all([
    computeDashboardStats(context, now),
    listUpcomingPayments(context, upcomingDays, now),
    listNormalizedExpenses(context),
    computeForecast(context, forecastMonths, now),
    listActiveInsights(context.userId, 50),
  ]);

  // The current month as the dashboard counts it
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const activeRecurring = recurring.filter(
    ({ expense }) => expense.recurrenceType !== "once" && isActiveInMonth(expense, year, month)
  );
  const subscriptions = activeRecurring.filter(({ expense }) => expense.isSubscription);
  const sumMonthly = (items: typeof recurring) =>
    money(items.reduce((sum, item) => sum + item.monthlyAmount, 0));

  const countBy = <K extends string>(values: K[]) =>
    values.reduce<Partial<Record<K, number>>>((counts, value) => {
      counts[value] = (counts[value] ?? 0) + 1;
      return counts;
    }, {});

  const payments = upcoming.map((payment) => ({
    id: payment.id,
    type: payment.type,
    name: payment.name,
    date: calendarDay(payment.date),
    amount: money(payment.amount),
    category: payment.category,
    isSubscription: payment.isSubscription,
  }));

  return apiJson({
    generatedAt: now.toISOString(),
    currency: context.baseCurrency,
    totalAssets: money(stats.totalAssets),
    hasMultiCurrency: stats.hasMultiCurrency,
    month: {
      year,
      month,
      cashflow: serializeView(stats.cashflowView),
      reserve: serializeView(stats.reserveView),
    },
    recurring: {
      fixedCostsMonthly: sumMonthly(activeRecurring),
      fixedCostsCount: activeRecurring.length,
      subscriptionsMonthly: sumMonthly(subscriptions),
      subscriptionsCount: subscriptions.length,
    },
    upcoming: {
      days: upcomingDays,
      count: payments.length,
      total: money(upcoming.reduce((sum, payment) => sum + payment.amount, 0)),
      next: payments[0] ?? null,
      payments,
    },
    forecast: {
      months: forecastMonths,
      projectedIncome: money(forecast.projectedIncome),
      projectedExpenses: money(forecast.projectedExpenses),
      projectedBalance: money(forecast.projectedBalance),
      monthly: forecast.monthlyDetails.map((detail) => ({
        year: detail.year,
        month: detail.month,
        income: money(detail.income),
        expenses: money(detail.expenses),
        balance: money(detail.balance),
      })),
    },
    insights: {
      unread: insights.length,
      bySeverity: countBy(insights.map((insight) => insight.severity)),
      byType: countBy(insights.map((insight) => insight.type)),
    },
  });
});
