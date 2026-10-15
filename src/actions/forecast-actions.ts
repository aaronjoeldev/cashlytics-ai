"use server";

import type { ApiResponse } from "@/types/database";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/lib/auth/require-auth";
import { getBaseCurrency } from "@/lib/user-preferences";
import { getRates } from "@/lib/exchange-rates";
import { computeAccountForecast, type AccountForecast } from "@/lib/services/forecast";

export type { AccountForecast };

export async function getAccountForecast(
  accountId: string,
  months: number
): Promise<ApiResponse<AccountForecast>> {
  const auth = await requireAuth();
  if (auth.error) return { success: false, error: "Unauthorized" };
  const { userId } = auth;

  try {
    const [baseCurrency, rates] = await Promise.all([getBaseCurrency(), getRates()]);
    const forecast = await computeAccountForecast(
      { userId, baseCurrency, rates },
      accountId,
      months
    );

    if (!forecast) {
      return { success: false, error: "Konto nicht gefunden." };
    }

    return { success: true, data: forecast };
  } catch (error) {
    logger.error("Failed to generate forecast", "getAccountForecast", error);
    return { success: false, error: "Prognose konnte nicht erstellt werden." };
  }
}
