"use server";

import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/require-auth";
import { logger } from "@/lib/logger";
import { currencies } from "@/lib/currency";
import { locales } from "@/i18n/config";
import { getUserPreferences } from "@/lib/user-preferences";
import type { ApiResponse } from "@/types/database";

export async function updateBaseCurrency(currency: string): Promise<ApiResponse<void>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return { success: false, error: "Unauthorized" };

    if (!currencies.includes(currency as (typeof currencies)[number])) {
      return { success: false, error: "Ungültige Währung." };
    }

    await db
      .insert(userSettings)
      .values({
        userId: authResult.userId,
        baseCurrency: currency,
        locale: (await getUserPreferences()).locale,
      })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          baseCurrency: currency,
          updatedAt: new Date(),
        },
      });

    return { success: true, data: undefined };
  } catch (error) {
    logger.error("Failed to update base currency", "updateBaseCurrency", error);
    return { success: false, error: "Währung konnte nicht gespeichert werden." };
  }
}

export async function updateLocale(locale: string): Promise<ApiResponse<void>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return { success: false, error: "Unauthorized" };

    if (!locales.includes(locale as (typeof locales)[number])) {
      return { success: false, error: "Ungültige Sprache." };
    }

    await db
      .insert(userSettings)
      .values({
        userId: authResult.userId,
        baseCurrency: (await getUserPreferences()).currency,
        locale: locale,
      })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          locale: locale,
          updatedAt: new Date(),
        },
      });

    return { success: true, data: undefined };
  } catch (error) {
    logger.error("Failed to update locale", "updateLocale", error);
    return { success: false, error: "Sprache konnte nicht gespeichert werden." };
  }
}
