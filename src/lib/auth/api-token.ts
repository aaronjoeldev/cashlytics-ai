import { randomBytes } from "node:crypto";
import { and, eq, gt, isNull, lt, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiTokens } from "@/lib/db/schema";
import { hashToken } from "@/lib/auth/reset-token";

/** Marks Cashlytics tokens, so secret scanners and users can recognise them. */
export const API_TOKEN_PREFIX = "csk_";
const TOKEN_PATTERN = /^csk_[0-9a-f]{64}$/;
// Characters kept for the token list, e.g. "csk_1a2b3c4d"
const DISPLAY_PREFIX_LENGTH = API_TOKEN_PREFIX.length + 8;
// Writing last_used_at on every request would turn each read into a write
const LAST_USED_RESOLUTION_MS = 60_000;

export type GeneratedApiToken = { raw: string; hash: string; prefix: string };

/** A new random token. Only `hash` and `prefix` are stored; `raw` is shown to the user once. */
export function generateApiToken(): GeneratedApiToken {
  const raw = `${API_TOKEN_PREFIX}${randomBytes(32).toString("hex")}`;
  return { raw, hash: hashToken(raw), prefix: raw.slice(0, DISPLAY_PREFIX_LENGTH) };
}

/** The token of an `Authorization: Bearer csk_…` header, or null when the header has none. */
export function parseBearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  if (!match || !TOKEN_PATTERN.test(match[1])) return null;
  return match[1];
}

export type ApiTokenAuth = { userId: string; tokenId: string };

/**
 * Resolves the user of a request authenticated with a personal API token. Returns null for a
 * missing, malformed, unknown or expired token. Only the hash is compared, so the lookup does
 * not leak the stored value through timing.
 */
export async function authenticateApiToken(
  authorizationHeader: string | null
): Promise<ApiTokenAuth | null> {
  const raw = parseBearerToken(authorizationHeader);
  if (!raw) return null;

  const now = new Date();
  const [row] = await db
    .select({ id: apiTokens.id, userId: apiTokens.userId })
    .from(apiTokens)
    .where(
      and(
        eq(apiTokens.tokenHash, hashToken(raw)),
        or(isNull(apiTokens.expiresAt), gt(apiTokens.expiresAt, now))
      )
    )
    .limit(1);
  if (!row) return null;

  await db
    .update(apiTokens)
    .set({ lastUsedAt: now })
    .where(
      and(
        eq(apiTokens.id, row.id),
        or(
          isNull(apiTokens.lastUsedAt),
          lt(apiTokens.lastUsedAt, new Date(now.getTime() - LAST_USED_RESOLUTION_MS))
        )
      )
    );

  return { userId: row.userId, tokenId: row.id };
}
