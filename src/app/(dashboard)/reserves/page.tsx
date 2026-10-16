import { getReservePlan } from "@/actions/reserve-actions";
import { getAccounts } from "@/actions/account-actions";
import { getCategories } from "@/actions/category-actions";
import { ReservesClient } from "./client";

export default async function ReservesPage() {
  const [planResult, accountsResult, categoriesResult] = await Promise.all([
    getReservePlan(),
    getAccounts(),
    getCategories(),
  ]);

  const plan = planResult.success
    ? planResult.data
    : { items: [], monthlyTotal: 0, targetTotal: 0, pot: null };

  return (
    <ReservesClient
      plan={plan}
      accounts={accountsResult.success ? accountsResult.data : []}
      categories={categoriesResult.success ? categoriesResult.data : []}
      loadFailed={!planResult.success}
    />
  );
}
