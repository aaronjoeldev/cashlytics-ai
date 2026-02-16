import { getAccounts } from '@/actions/account-actions';
import { AccountsClient } from './client';

export default async function AccountsPage() {
  const result = await getAccounts();
  const accounts = result.success ? result.data : [];

  return <AccountsClient initialAccounts={accounts} />;
}