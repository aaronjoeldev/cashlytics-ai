import { getAccounts } from '@/actions/account-actions';
import { getIncomes } from '@/actions/income-actions';
import { IncomeClient } from './client';

export default async function IncomePage() {
  const [accountsResult, incomesResult] = await Promise.all([
    getAccounts(),
    getIncomes(),
  ]);

  const accounts = accountsResult.success ? accountsResult.data : [];
  const incomes = incomesResult.success ? incomesResult.data : [];

  return (
    <IncomeClient
      accounts={accounts}
      initialIncomes={incomes}
    />
  );
}