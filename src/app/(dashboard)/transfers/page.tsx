import { getAccounts } from '@/actions/account-actions';
import { getTransfers } from '@/actions/transfer-actions';
import { TransfersClient } from './client';

export default async function TransfersPage() {
  const [accountsResult, transfersResult] = await Promise.all([
    getAccounts(),
    getTransfers(),
  ]);

  const accounts = accountsResult.success ? accountsResult.data : [];
  const transfers = transfersResult.success ? transfersResult.data : [];

  return (
    <TransfersClient
      accounts={accounts}
      initialTransfers={transfers}
    />
  );
}
