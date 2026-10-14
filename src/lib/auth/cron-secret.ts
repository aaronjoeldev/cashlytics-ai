import { timingSafeEqual } from "node:crypto";

/** Checks the `Authorization: Bearer <CRON_SECRET>` header in constant time. */
export function isValidCronRequest(authHeader: string | null, cronSecret: string): boolean {
  if (!authHeader) return false;
  const provided = Buffer.from(authHeader);
  const expected = Buffer.from(`Bearer ${cronSecret}`);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
