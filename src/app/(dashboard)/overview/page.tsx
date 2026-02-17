import { getMonthlyOverview, getForecast, getCategoryBreakdown, getNormalizedMonthlyExpenses, getSubscriptions, getMonthlyPaymentsCalendar } from '@/actions/analytics-actions';
import { OverviewClient } from './client';

export default async function OverviewPage() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);

  const [overviewResult, forecastResult, breakdownResult, normalizedResult, subscriptionsResult, calendarResult] = await Promise.all([
    getMonthlyOverview(month, year),
    getForecast(3),
    getCategoryBreakdown(startOfMonth, endOfMonth),
    getNormalizedMonthlyExpenses(),
    getSubscriptions(),
    getMonthlyPaymentsCalendar(year, month),
  ]);

  const overview = overviewResult.success ? overviewResult.data : null;
  const forecast = forecastResult.success ? forecastResult.data : null;
  const breakdown = breakdownResult.success ? breakdownResult.data : [];
  const normalizedExpenses = normalizedResult.success ? normalizedResult.data : [];
  const subscriptions = subscriptionsResult.success ? subscriptionsResult.data : [];
  const calendarDays = calendarResult.success ? calendarResult.data : [];

  return (
    <OverviewClient
      month={month}
      year={year}
      overview={overview}
      forecast={forecast}
      categoryBreakdown={breakdown}
      normalizedExpenses={normalizedExpenses}
      subscriptions={subscriptions}
      calendarDays={calendarDays}
    />
  );
}
