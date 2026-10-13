import { signOut } from "@/auth";

/**
 * Target for sessions that were invalidated on the server (password reset, deleted user).
 * The proxy only sees a decodable cookie and would keep sending the browser back to the app,
 * so the cookie is cleared here, where cookies can be written.
 */
export async function GET() {
  await signOut({ redirectTo: "/login" });
}
