import { getReservePlan } from "@/actions/reserve-actions";
import { getAccounts } from "@/actions/account-actions";
import { ReservesClient } from "./client";

export default async function ReservesPage() {
  const [planResult, accountsResult] = await Promise.all([getReservePlan(), getAccounts()]);

  const plan = planResult.success
    ? planResult.data
    : { items: [], monthlyTotal: 0, targetTotal: 0, pot: null };
  const accounts = accountsResult.success ? accountsResult.data : [];

  return (
    <ReservesClient
      plan={plan}
      accounts={accounts.map(({ id, name }) => ({ id, name }))}
      loadFailed={!planResult.success}
    />
  );
}
