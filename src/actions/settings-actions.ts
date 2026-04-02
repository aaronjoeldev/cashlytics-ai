"use server";

import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/require-auth";
import { logger } from "@/lib/logger";
import { currencies, defaultCurrency } from "@/lib/currency";
import { locales, defaultLocale } from "@/i18n/config";
import type { ApiResponse } from "@/types/database";

export interface UserSettingsData {
  baseCurrency: string;
  locale: string;
}

const DEFAULT_SETTINGS: UserSettingsData = {
  baseCurrency: defaultCurrency,
  locale: defaultLocale,
};

export async function getUserSettings(): Promise<UserSettingsData> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return DEFAULT_SETTINGS;

    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, authResult.userId))
      .limit(1);

    if (!settings) return DEFAULT_SETTINGS;

    return {
      baseCurrency: settings.baseCurrency,
      locale: settings.locale,
    };
  } catch (error) {
    logger.error("Failed to fetch user settings", "getUserSettings", error);
    return DEFAULT_SETTINGS;
  }
}

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
        locale: defaultLocale,
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
        baseCurrency: defaultCurrency,
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
