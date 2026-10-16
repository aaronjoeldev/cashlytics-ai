"use server";

import { revalidatePath } from "next/cache";
import { getTimeZone } from "next-intl/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts, reservePots } from "@/lib/db/schema";
import type { ApiResponse } from "@/types/database";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/lib/auth/require-auth";
import { getBaseCurrency } from "@/lib/user-preferences";
import { getRates } from "@/lib/exchange-rates";
import { getCalendarDayInTimeZone } from "@/lib/recurrence";
import { computeReservePlan, type ReservePlan } from "@/lib/services/reserves";
import { parseInput, setReservePotInput } from "@/lib/validations/action-input";

const today = async () => getCalendarDayInTimeZone(await getTimeZone());

export async function getReservePlan(): Promise<ApiResponse<ReservePlan>> {
  const auth = await requireAuth();
  if (auth.error) return { success: false, error: "Unauthorized" };
  const { userId } = auth;

  try {
    const [baseCurrency, rates, day] = await Promise.all([getBaseCurrency(), getRates(), today()]);
    return { success: true, data: await computeReservePlan({ userId, baseCurrency, rates }, day) };
  } catch (error) {
    logger.error("Failed to compute reserve plan", "getReservePlan", error);
    return { success: false, error: "Rücklagen-Plan konnte nicht geladen werden." };
  }
}

/**
 * Sets the pot account and its balance as of today. Planned transfers into the account and due
 * reserve bills after today change the balance from here on.
 */
export async function setReservePot(data: {
  accountId: string;
  balance: string | number;
}): Promise<ApiResponse<{ ok: true }>> {
  const auth = await requireAuth();
  if (auth.error) return { success: false, error: "Unauthorized" };
  const { userId } = auth;

  const input = parseInput(setReservePotInput, data);
  if (!input.success) return { success: false, error: input.error };

  try {
    const [account] = await db
      .select({ id: accounts.id, currency: accounts.currency })
      .from(accounts)
      .where(and(eq(accounts.id, input.data.accountId), eq(accounts.userId, userId)))
      .limit(1);
    if (!account) return { success: false, error: "Konto nicht gefunden." };

    const values = {
      accountId: account.id,
      balance: input.data.balance,
      // The form shows amounts in the base currency
      currency: await getBaseCurrency(),
      balanceDate: await today(),
      updatedAt: new Date(),
    };
    await db
      .insert(reservePots)
      .values({ userId, ...values })
      .onConflictDoUpdate({ target: reservePots.userId, set: values });

    revalidatePath("/reserves");
    revalidatePath("/dashboard");
    return { success: true, data: { ok: true } };
  } catch (error) {
    logger.error("Failed to set reserve pot", "setReservePot", error);
    return { success: false, error: "Rücklagentopf konnte nicht gespeichert werden." };
  }
}
