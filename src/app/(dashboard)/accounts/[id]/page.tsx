import { notFound } from 'next/navigation';
import { getAccountById } from '@/actions/accounts-actions';
import { getExpenses } from '@/actions/expenses-actions';
import { getIncomes } from '@/actions/incomes-actions';
import { getTransfers } from '@/actions/transfer-actions';
import { AccountDetailClient } from './client';

interface AccountDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AccountDetailPage({ params }: AccountDetailPageProps) {
  const { id } = await params;
  
  const [accountResult, expensesResult, incomesResult, transfersResult] = await Promise.all([
    getAccountById(id),
    getExpenses({ accountId: id }),
    getIncomes({ accountId: id }),
    getTransfers(),
  ]);

  if (!accountResult.success) {
    notFound();
  }

  const allTransfers = transfersResult.success ? transfersResult.data : [];
  const accountTransfers = allTransfers.filter(
    t => t.sourceAccountId === id || t.targetAccountId === id
  );

  return (
    <AccountDetailClient
      account={accountResult.data}
      initialExpenses={expensesResult.success ? expensesResult.data : []}
      initialIncomes={incomesResult.success ? incomesResult.data : []}
      initialTransfers={accountTransfers}
    />
  );
}
