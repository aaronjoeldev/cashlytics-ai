import { getSalaryPlan } from "@/actions/salary-plan-actions";
import { SalaryPlanClient } from "./client";

export default async function SalaryPlanPage() {
  const result = await getSalaryPlan();
  return <SalaryPlanClient plan={result.success ? result.data : null} />;
}
