import { getDashboardStats, getCategoryBreakdown, getRecentTransactions, getUpcomingPayments } from '@/actions/dashboard-actions';
import { DashboardClient } from './client';

export default async function DashboardPage() {
  const [statsResult, breakdownResult, transactionsResult, upcomingResult] = await Promise.all([
    getDashboardStats(),
    getCategoryBreakdown(),
    getRecentTransactions(5),
    getUpcomingPayments(14),
  ]);

  const stats = statsResult.success ? statsResult.data : {
    totalAssets: 0,
    monthlyIncome: 0,
    monthlyExpenses: 0,
    savingsRate: 0,
    incomeTrend: 0,
    expenseTrend: 0,
  };

  const breakdown = breakdownResult.success ? breakdownResult.data : [];
  const transactions = transactionsResult.success ? transactionsResult.data : [];
  const upcomingPayments = upcomingResult.success ? upcomingResult.data : [];

  return (
    <DashboardClient
      stats={stats}
      categoryBreakdown={breakdown}
      recentTransactions={transactions}
      upcomingPayments={upcomingPayments}
    />
  );
}