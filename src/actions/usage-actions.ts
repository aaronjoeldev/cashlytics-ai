"use server";

import type { ApiResponse } from "@/types/database";
import { requireAuth } from "@/lib/auth/require-auth";
import { getUserCurrentMonthSpend } from "@/lib/ai/metering";
import { logger } from "@/lib/logger";

export type CurrentAiSpend = {
  totalCostEur: string;
  totalTokens: number;
};

export async function getCurrentAiSpend(): Promise<ApiResponse<CurrentAiSpend>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false, error: "Unauthorized" };
    }

    const spend = await getUserCurrentMonthSpend(authResult.userId);

    return { success: true, data: spend };
  } catch (error) {
    logger.error("Failed to read AI usage spend", "getCurrentAiSpend", error);
    return { success: false, error: "Failed to load AI spend" };
  }
}
