import { getMonthlyOverview, getCategoryBreakdown } from '@/actions/analytics-actions';
import { AnalyticsClient } from './client';
import type { MonthlyTrendItem, CategoryItem } from './client';

export default async function AnalyticsPage() {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const trendMonths: Array<{ month: number; year: number; label: string }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(currentYear, currentMonth - 1 - i, 1);
    trendMonths.push({
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      label: d.toLocaleDateString('de-DE', { month: 'short' }),
    });
  }

  const overviewResults = await Promise.all(
    trendMonths.map(({ month, year }) => getMonthlyOverview(month, year))
  );

  const monthlyTrend: MonthlyTrendItem[] = trendMonths.map(({ label }, i) => {
    const result = overviewResults[i];
    if (result.success && result.data) {
      return {
        month: label,
        income: result.data.totalIncome,
        expenses: result.data.totalExpenses,
        savings: result.data.totalIncome - result.data.totalExpenses,
      };
    }
    return { month: label, income: 0, expenses: 0, savings: 0 };
  });

  const currentOverview = overviewResults[5];
  const currentMonthIncome = currentOverview.success && currentOverview.data ? currentOverview.data.totalIncome : 0;
  const currentMonthExpenses = currentOverview.success && currentOverview.data ? currentOverview.data.totalExpenses : 0;

  const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
  const endOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59);
  const breakdownResult = await getCategoryBreakdown(startOfMonth, endOfMonth);

  const categoryBreakdown: CategoryItem[] = breakdownResult.success && breakdownResult.data
    ? breakdownResult.data.map((item) => ({
        name: item.category.name,
        amount: item.amount,
        percentage: item.percentage,
        color: item.category.color,
        icon: item.category.icon,
      }))
    : [];

  return (
    <AnalyticsClient
      monthlyTrend={monthlyTrend}
      categoryBreakdown={categoryBreakdown}
      currentMonthIncome={currentMonthIncome}
      currentMonthExpenses={currentMonthExpenses}
    />
  );
}
