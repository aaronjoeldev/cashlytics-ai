import { db } from "@/lib/db";
import { insights, type Insight } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

/** Unread, unexpired insights of a user, newest first. */
export async function listActiveInsights(userId: string, limit = 10): Promise<Insight[]> {
  const now = new Date();
  return db
    .select()
    .from(insights)
    .where(
      and(
        eq(insights.userId, userId),
        eq(insights.isRead, false),
        sql`(${insights.expiresAt} IS NULL OR ${insights.expiresAt} > ${now.toISOString()})`
      )
    )
    .orderBy(desc(insights.createdAt))
    .limit(limit);
}
