/**
 * @deprecated Use requireAuth() from "@/lib/auth/require-auth" instead.
 *
 * This temporary helper falls back to SINGLE_USER_EMAIL which bypasses auth.
 * Phase 3 replaces all callers with requireAuth() which enforces strict session checking.
 * This file will be deleted once all callers are updated.
 *
 * @see src/lib/auth/require-auth.ts
 */
export async function getCurrentUserId(): Promise<string> {
  const { auth } = await import("@/auth");
  const { db } = await import("@/lib/db");
  const { users } = await import("@/lib/db/schema");
  const { sql } = await import("drizzle-orm");

  // Try to get user from session first
  const session = await auth();
  if (session?.user?.id) {
    return session.user.id;
  }

  // Fall back to SINGLE_USER_EMAIL for single-user mode
  const singleUserEmail = process.env.SINGLE_USER_EMAIL;
  if (singleUserEmail) {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${singleUserEmail.trim().toLowerCase()}`)
      .orderBy(users.createdAt)
      .limit(1);

    if (user) {
      return user.id;
    }
  }

  throw new Error(
    "Unable to determine user ID. Ensure SINGLE_USER_EMAIL is set or user is authenticated."
  );
}
