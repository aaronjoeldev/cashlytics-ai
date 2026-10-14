import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { users, authAccounts, authSessions, authVerificationTokens } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { verifyPassword } from "@/lib/auth/password";
import { rateLimit } from "@/lib/rate-limiter";
import { isSessionStillValid } from "@/lib/auth/session-validity";
import { signInSchema } from "@/lib/validations/auth";
import { ZodError } from "zod";
import { authConfig } from "./auth.config";

// Extend Session type to include user.id
declare module "next-auth" {
  interface Session {
    user: {
      /** The user's unique identifier */
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    /** When the user signed in, in milliseconds. Not refreshed when the token is re-issued. */
    signedInAt?: number;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    jwt: async ({ token, user }) => {
      if (user) {
        token.sub = user.id;
        token.signedInAt = Date.now();
        return token;
      }
      // Returning null ends the session: password changed since sign-in, or user deleted
      if (!token.sub || !(await isSessionStillValid(token.sub, token.signedInAt))) {
        return null;
      }
      return token;
    },
  },
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: authAccounts,
    sessionsTable: authSessions,
    verificationTokensTable: authVerificationTokens,
  }),
  providers: [
    Credentials({
      credentials: {
        email: { type: "email" },
        password: { type: "password" },
      },
      authorize: async (credentials) => {
        try {
          const { email, password } = await signInSchema.parseAsync(credentials);

          // 10 attempts per 15 minutes per account
          if (!rateLimit(`login:${email}`, 10, 15 * 60_000).allowed) {
            return null;
          }

          // Accounts created before e-mails were normalised may be stored in mixed case
          const [user] = await db
            .select()
            .from(users)
            .where(sql`lower(${users.email}) = ${email}`)
            .limit(1);

          if (!user?.password) {
            return null;
          }

          const isValid = await verifyPassword(password, user.password);
          if (!isValid) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
          };
        } catch (error) {
          if (error instanceof ZodError) {
            return null;
          }
          throw error;
        }
      },
    }),
  ],
});
