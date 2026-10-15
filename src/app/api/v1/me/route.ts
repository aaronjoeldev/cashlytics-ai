import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { loadStoredPreferences } from "@/lib/user-preferences";
import { defaultLocale } from "@/i18n/config";
import { APP_VERSION } from "@/lib/version";
import { API_VERSION, apiError, apiJson, withApiToken } from "@/lib/api/v1";

/** The token owner; integrations use `userId` as their stable identifier. */
export const GET = withApiToken("me", async (_request, { userId, baseCurrency }) => {
  const [[user], stored] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    loadStoredPreferences(userId),
  ]);
  if (!user) return apiError(404, "not_found", "User not found");

  return apiJson({
    userId: user.id,
    name: user.name,
    email: user.email,
    baseCurrency,
    locale: stored?.locale ?? defaultLocale,
    version: APP_VERSION,
    apiVersion: API_VERSION,
  });
});
