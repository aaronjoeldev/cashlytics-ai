import { getDashboardStats, getCategoryBreakdown, getRecentTransactions } from '@/actions/dashboard-actions';
import { DashboardClient } from './client';

export default async function DashboardPage() {
  const [statsResult, breakdownResult, transactionsResult] = await Promise.all([
    getDashboardStats(),
    getCategoryBreakdown(),
    getRecentTransactions(5),
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

  return (
    <DashboardClient
      stats={stats}
      categoryBreakdown={breakdown}
      recentTransactions={transactions}
    />
  );
}