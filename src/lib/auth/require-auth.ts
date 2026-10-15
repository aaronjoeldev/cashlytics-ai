import { auth } from "@/auth";

export type AuthSuccess = { userId: string; error?: never };
export type AuthFailure = { userId?: never; error: "Unauthorized" };
export type AuthResult = AuthSuccess | AuthFailure;

/**
 * Call at the top of every server action before any DB query.
 * Returns { userId } on success, { error: "Unauthorized" } if no session.
 * Unauthenticated requests are always unauthorized.
 */
export async function requireAuth(): Promise<AuthResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }
  return { userId: session.user.id };
}
