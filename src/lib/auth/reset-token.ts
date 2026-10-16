import { randomBytes, createHash } from "node:crypto";
import { eq, and, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { passwordResetTokens } from "@/lib/db/schema";

/**
 * Token expiry time in milliseconds (1 hour)
 */
const TOKEN_EXPIRY_MS = 60 * 60 * 1000;

/**
 * Generates a cryptographically secure password reset token.
 *
 * @returns An object containing:
 *   - raw: The 64-character hex token (sent via email, never stored)
 *   - hash: The SHA-256 hash of the token (stored in database)
 */
function generateResetToken(): { raw: string; hash: string } {
  // Generate 256-bit (32 bytes) cryptographically random token
  const rawBytes = randomBytes(32);
  const raw = rawBytes.toString("hex"); // 64-character hex string

  // Hash the raw token for database storage
  const hash = hashToken(raw);

  return { raw, hash };
}

/**
 * Hashes a raw token using SHA-256.
 * Used when validating tokens from reset links.
 *
 * @param raw - The raw token string to hash
 * @returns The SHA-256 hash as a 64-character hex string
 */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Creates a new password reset token for a user.
 * Stores only the SHA-256 hash in the database.
 *
 * @param userId - The UUID of the user requesting the reset
 * @returns The raw token (for email link) - NOT the hash
 */
export async function createResetToken(userId: string): Promise<string> {
  const { raw, hash } = generateResetToken();
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

  await db.insert(passwordResetTokens).values({
    tokenHash: hash,
    userId,
    expiresAt,
  });

  return raw;
}

/**
 * Validates a password reset token.
 * Uses a single query with combined conditions to prevent timing attacks.
 *
 * @param rawToken - The raw token from the reset link
 * @returns Validation result with userId and tokenId if valid, or invalid status
 */
export async function validateResetToken(
  rawToken: string
): Promise<{ valid: true; userId: string; tokenId: string } | { valid: false }> {
  const tokenHash = hashToken(rawToken);

  const result = await db
    .select({
      userId: passwordResetTokens.userId,
      tokenId: passwordResetTokens.id,
    })
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        gt(passwordResetTokens.expiresAt, new Date()),
        isNull(passwordResetTokens.usedAt)
      )
    )
    .limit(1);

  if (result.length === 0) {
    return { valid: false };
  }

  return {
    valid: true,
    userId: result[0].userId,
    tokenId: result[0].tokenId,
  };
}

/**
 * Marks a token as used by setting the usedAt timestamp.
 *
 * @param tokenId - The UUID of the token to consume
 * @returns false when the token was already used, so concurrent submissions of the same link
 *   cannot both succeed
 */
export async function consumeResetToken(tokenId: string): Promise<boolean> {
  const consumed = await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(passwordResetTokens.id, tokenId), isNull(passwordResetTokens.usedAt)))
    .returning({ id: passwordResetTokens.id });
  return consumed.length > 0;
}

/**
 * Invalidates all unused reset tokens for a user.
 * Called after successful password reset to prevent reuse of pending links.
 *
 * @param userId - The UUID of the user whose tokens should be invalidated
 */
export async function invalidateUserTokens(userId: string): Promise<void> {
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));
}
