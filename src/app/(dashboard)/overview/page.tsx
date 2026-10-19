import {
  getMonthlyOverview,
  getForecast,
  getCategoryBreakdown,
  getNormalizedMonthlyExpenses,
  getSubscriptions,
  getMonthlyPaymentsCalendar,
} from "@/actions/analytics-actions";
import { getAccounts } from "@/actions/account-actions";
import { OverviewClient } from "./client";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string | string[] }>;
}) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);

  // Only an own account filters; anything else shows all accounts
  const accountsResult = await getAccounts();
  const accounts = accountsResult.success ? accountsResult.data : [];
  const { account } = await searchParams;
  const accountId = accounts.find((a) => a.id === account)?.id;

  const [
    overviewResult,
    forecastResult,
    breakdownResult,
    normalizedResult,
    subscriptionsResult,
    calendarResult,
  ] = await Promise.all([
    getMonthlyOverview(month, year, accountId),
    getForecast(3, accountId),
    getCategoryBreakdown(startOfMonth, endOfMonth, accountId),
    getNormalizedMonthlyExpenses(),
    getSubscriptions(),
    getMonthlyPaymentsCalendar(year, month, accountId),
  ]);

  const overview = overviewResult.success ? overviewResult.data : null;
  const forecast = forecastResult.success ? forecastResult.data : null;
  const breakdown = breakdownResult.success ? breakdownResult.data : [];
  const normalizedExpenses = normalizedResult.success ? normalizedResult.data : [];
  const subscriptions = subscriptionsResult.success ? subscriptionsResult.data : [];
  const calendarDays = calendarResult.success ? calendarResult.data : [];

  return (
    <OverviewClient
      // A new account starts the client fresh, so the calendar shows the new account's month
      key={accountId ?? "all"}
      month={month}
      year={year}
      overview={overview}
      forecast={forecast}
      categoryBreakdown={breakdown}
      normalizedExpenses={normalizedExpenses}
      subscriptions={subscriptions}
      initialCalendarDays={calendarDays}
      accounts={accounts}
      accountId={accountId ?? null}
    />
  );
}
