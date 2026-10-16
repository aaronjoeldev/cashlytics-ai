"use server";

import { and, count, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { apiTokens } from "@/lib/db/schema";
import type { ApiResponse } from "@/types/database";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/lib/auth/require-auth";
import { generateApiToken } from "@/lib/auth/api-token";
import { createApiTokenInput, parseInput } from "@/lib/validations/action-input";

/** Upper bound per user, so a script cannot fill the table. */
const MAX_TOKENS_PER_USER = 25;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ApiTokenSummary = {
  id: string;
  name: string;
  tokenPrefix: string;
  scope: "read";
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
};

const summaryColumns = {
  id: apiTokens.id,
  name: apiTokens.name,
  tokenPrefix: apiTokens.tokenPrefix,
  scope: apiTokens.scope,
  lastUsedAt: apiTokens.lastUsedAt,
  expiresAt: apiTokens.expiresAt,
  createdAt: apiTokens.createdAt,
};

export async function getApiTokens(): Promise<ApiResponse<ApiTokenSummary[]>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return { success: false, error: "Unauthorized" };

    const tokens = await db
      .select(summaryColumns)
      .from(apiTokens)
      .where(eq(apiTokens.userId, authResult.userId))
      .orderBy(desc(apiTokens.createdAt));
    return { success: true, data: tokens };
  } catch (error) {
    logger.error("Failed to fetch API tokens", "getApiTokens", error);
    return { success: false, error: "API-Tokens konnten nicht geladen werden." };
  }
}

/** Creates a token and returns its raw value. It is shown once; only its hash is stored. */
export async function createApiToken(
  data: unknown
): Promise<ApiResponse<{ token: string; summary: ApiTokenSummary }>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return { success: false, error: "Unauthorized" };

    const input = parseInput(createApiTokenInput, data);
    if (!input.success) return input;

    const [{ total }] = await db
      .select({ total: count() })
      .from(apiTokens)
      .where(eq(apiTokens.userId, authResult.userId));
    if (total >= MAX_TOKENS_PER_USER) {
      return {
        success: false,
        error: `Es sind höchstens ${MAX_TOKENS_PER_USER} API-Tokens möglich.`,
      };
    }

    const { raw, hash, prefix } = generateApiToken();
    const { expiresInDays } = input.data;
    const [summary] = await db
      .insert(apiTokens)
      .values({
        userId: authResult.userId,
        name: input.data.name,
        tokenHash: hash,
        tokenPrefix: prefix,
        expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * DAY_MS) : null,
      })
      .returning(summaryColumns);

    revalidatePath("/settings");
    return { success: true, data: { token: raw, summary } };
  } catch (error) {
    logger.error("Failed to create API token", "createApiToken", error);
    return { success: false, error: "API-Token konnte nicht erstellt werden." };
  }
}

/** Revokes a token immediately; integrations using it get 401 on their next request. */
export async function deleteApiToken(id: string): Promise<ApiResponse<{ id: string }>> {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return { success: false, error: "Unauthorized" };

    const deleted = await db
      .delete(apiTokens)
      .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, authResult.userId)))
      .returning({ id: apiTokens.id });
    if (deleted.length === 0) {
      return { success: false, error: "API-Token nicht gefunden." };
    }

    revalidatePath("/settings");
    return { success: true, data: deleted[0] };
  } catch (error) {
    logger.error("Failed to delete API token", "deleteApiToken", error);
    return { success: false, error: "API-Token konnte nicht gelöscht werden." };
  }
}
