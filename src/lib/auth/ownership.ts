import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts, categories } from "@/lib/db/schema";

/**
 * Copies only the listed fields that are present in `data`.
 * Server action payloads are not type-checked at runtime, so update actions use this to make
 * sure a client cannot set `userId`, `id` or `createdAt`.
 */
export function pickFields<T extends object, K extends keyof T>(
  data: T,
  fields: readonly K[]
): Pick<T, K> {
  const picked = {} as Pick<T, K>;
  for (const field of fields) {
    if (data[field] !== undefined) picked[field] = data[field];
  }
  return picked;
}

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
