"use server";

import { revalidatePath } from "next/cache";
import { getTimeZone } from "next-intl/server";
import { db } from "@/lib/db";
import { planSettings } from "@/lib/db/schema";
import type { ApiResponse } from "@/types/database";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/lib/auth/require-auth";
import { getBaseCurrency } from "@/lib/user-preferences";
import { getRates } from "@/lib/exchange-rates";
import { getCalendarDayInTimeZone } from "@/lib/recurrence";
import { computeSalaryPlan, type SalaryPlan } from "@/lib/services/salary-plan";
import { parseInput, setEverydayBudgetInput } from "@/lib/validations/action-input";

export async function getSalaryPlan(): Promise<ApiResponse<SalaryPlan>> {
  const auth = await requireAuth();
  if (auth.error) return { success: false, error: "Unauthorized" };
  const { userId } = auth;

  try {
    const [baseCurrency, rates, timeZone] = await Promise.all([
      getBaseCurrency(),
      getRates(),
      getTimeZone(),
    ]);
    const today = getCalendarDayInTimeZone(timeZone);
    return { success: true, data: await computeSalaryPlan({ userId, baseCurrency, rates }, today) };
  } catch (error) {
    logger.error("Failed to compute salary plan", "getSalaryPlan", error);
    return { success: false, error: "Gehaltsplan konnte nicht geladen werden." };
  }
}

/** Sets a fixed everyday budget in the base currency; null goes back to the 3-month average. */
export async function setEverydayBudget(data: {
  amount: string | number | null;
}): Promise<ApiResponse<{ ok: true }>> {
  const auth = await requireAuth();
  if (auth.error) return { success: false, error: "Unauthorized" };
  const { userId } = auth;

  const input = parseInput(setEverydayBudgetInput, data);
  if (!input.success) return { success: false, error: input.error };

  try {
    const values = {
      everydayBudget: input.data.amount,
      currency: input.data.amount === null ? null : await getBaseCurrency(),
      updatedAt: new Date(),
    };
    await db
      .insert(planSettings)
      .values({ userId, ...values })
      .onConflictDoUpdate({ target: planSettings.userId, set: values });

    revalidatePath("/salary-plan");
    return { success: true, data: { ok: true } };
  } catch (error) {
    logger.error("Failed to set everyday budget", "setEverydayBudget", error);
    return { success: false, error: "Alltagsbudget konnte nicht gespeichert werden." };
  }
}
