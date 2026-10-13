import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

/**
 * JWT sessions cannot be revoked individually, so every session carries the time it was signed
 * in and is rejected when the user's password changed afterwards or the user no longer exists.
 *
 * The lookup runs on every `auth()` call and is cached briefly per process. Another replica can
 * therefore accept an outdated session for up to CACHE_TTL_MS after a reset.
 */
const CACHE_TTL_MS = 30_000;

interface CachedUserState {
  exists: boolean;
  passwordChangedAt: number | null;
  fetchedAt: number;
}

const cache = new Map<string, CachedUserState>();

async function getUserState(userId: string): Promise<CachedUserState> {
  const now = Date.now();
  const cached = cache.get(userId);
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) return cached;

  const [row] = await db
    .select({ passwordChangedAt: users.passwordChangedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const state: CachedUserState = {
    exists: !!row,
    passwordChangedAt: row?.passwordChangedAt?.getTime() ?? null,
    fetchedAt: now,
  };
  cache.set(userId, state);
  return state;
}

/**
 * @param signedInAt - `signedInAt` claim of the session token in milliseconds. Tokens issued
 *   before this claim existed have none; they stay valid until the password changes.
 */
export async function isSessionStillValid(
  userId: string,
  signedInAt: number | undefined
): Promise<boolean> {
  const state = await getUserState(userId);
  if (!state.exists) return false;
  if (state.passwordChangedAt === null) return true;
  return signedInAt !== undefined && signedInAt >= state.passwordChangedAt;
}

/** Makes a password change effective immediately in this process. */
export function markPasswordChanged(userId: string, changedAt: Date): void {
  cache.set(userId, {
    exists: true,
    passwordChangedAt: changedAt.getTime(),
    fetchedAt: Date.now(),
  });
}
