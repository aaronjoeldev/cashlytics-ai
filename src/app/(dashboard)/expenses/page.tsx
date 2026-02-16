import { getAccounts } from '@/actions/account-actions';
import { getCategories } from '@/actions/category-actions';
import { getExpenses, getDailyExpenses } from '@/actions/expense-actions';
import { ExpensesClient } from './client';

export default async function ExpensesPage() {
  const [accountsResult, categoriesResult, expensesResult, dailyExpensesResult] = await Promise.all([
    getAccounts(),
    getCategories(),
    getExpenses(),
    getDailyExpenses(),
  ]);

  const accounts = accountsResult.success ? accountsResult.data : [];
  const categories = categoriesResult.success ? categoriesResult.data : [];
  const expenses = expensesResult.success ? expensesResult.data : [];
  const dailyExpenses = dailyExpensesResult.success ? dailyExpensesResult.data : [];

  return (
    <ExpensesClient
      accounts={accounts}
      categories={categories}
      initialExpenses={expenses}
      initialDailyExpenses={dailyExpenses}
    />
  );
}