import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts, categories } from "@/lib/db/schema";

export async function ownsAccount(userId: string, accountId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
    .limit(1);
  return !!row;
}

export async function ownsCategory(userId: string, categoryId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
    .limit(1);
  return !!row;
}
