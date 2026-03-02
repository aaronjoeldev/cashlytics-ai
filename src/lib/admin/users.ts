import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  billingSubscriptions,
  categories,
  dailyExpenses,
  documents,
  entitlements,
  expenses,
  incomes,
  transfers,
  usageEvents,
  users,
} from "@/lib/db/schema";

const billingStatusValues = ["trial", "active", "past_due", "canceled", "none"] as const;
const planCodeValues = ["free", "pro", "enterprise"] as const;

const listUsersSortValues = ["recent_activity", "cost_desc", "name_asc"] as const;

const baseListUsersQuerySchema = z.object({
  query: z.string().trim().min(1).max(200).optional(),
  plan: z
    .enum([...planCodeValues, "all"])
    .optional()
    .default("all"),
  status: z
    .enum([...billingStatusValues, "all"])
    .optional()
    .default("all"),
  sort: z.enum(listUsersSortValues).optional().default("recent_activity"),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  cursor: z.string().trim().min(1).optional(),
});

const usageQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const rawCursorSchema = z.object({
  offset: z.number().int().nonnegative(),
  sort: z.enum(listUsersSortValues),
});

export const userIdParamSchema = z.object({
  id: z.uuid(),
});

export function parseAdminUsersListQuery(searchParams: URLSearchParams) {
  return baseListUsersQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
}

export function parseAdminUsageQuery(searchParams: URLSearchParams) {
  return usageQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
}

function decodeCursor(
  cursor: string
): { offset: number; sort: (typeof listUsersSortValues)[number] } | null {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    const parsed = rawCursorSchema.safeParse(decoded);
    if (!parsed.success) {
      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
}

function encodeCursor(offset: number, sort: (typeof listUsersSortValues)[number]) {
  return Buffer.from(JSON.stringify({ offset, sort }), "utf8").toString("base64url");
}

const billingStatusSql = sql<string>`
  case
    when ${entitlements.status} in ('trial', 'active', 'past_due', 'canceled', 'none') then ${entitlements.status}
    when ${billingSubscriptions.status} = 'trialing' then 'trial'
    when ${billingSubscriptions.status} = 'active' then 'active'
    when ${billingSubscriptions.status} = 'past_due' then 'past_due'
    when ${billingSubscriptions.status} in ('canceled', 'unpaid', 'incomplete_expired') then 'canceled'
    else 'none'
  end
`;

const lastActiveAtSql = sql<Date>`
  coalesce(
    (
      select max(${usageEvents.occurredAt})
      from ${usageEvents}
      where ${usageEvents.userId} = ${users.id}
    ),
    ${users.createdAt}
  )
`;

function buildUserListFilters(input: z.infer<typeof baseListUsersQuerySchema>): SQL[] {
  const filters: SQL[] = [];

  if (input.query) {
    const pattern = `%${input.query}%`;
    filters.push(or(ilike(users.email, pattern), ilike(users.name, pattern)) as SQL);
  }

  if (input.plan !== "all") {
    filters.push(sql`coalesce(${entitlements.planCode}, 'free') = ${input.plan}`);
  }

  if (input.status !== "all") {
    filters.push(sql`${billingStatusSql} = ${input.status}`);
  }

  return filters;
}

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") {
    return value;
  }

  if (!value) {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toIsoDate(value: Date | string | null | undefined): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date(0).toISOString();
}

function toIsoDateNullable(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return toIsoDate(value);
}

function toBillingStatus(value: string | null | undefined): (typeof billingStatusValues)[number] {
  if (value && (billingStatusValues as readonly string[]).includes(value)) {
    return value as (typeof billingStatusValues)[number];
  }

  return "none";
}

function normalizeStripeSubscriptionStatus(
  value: string | null | undefined
): (typeof billingStatusValues)[number] {
  if (!value) {
    return "none";
  }

  if (value === "trialing") {
    return "trial";
  }

  if (value === "active") {
    return "active";
  }

  if (value === "past_due") {
    return "past_due";
  }

  if (value === "canceled" || value === "unpaid" || value === "incomplete_expired") {
    return "canceled";
  }

  return "none";
}

function resolveBillingStatus(
  entitlementStatus: string | null | undefined,
  subscriptionStatus: string | null | undefined
): (typeof billingStatusValues)[number] {
  if (entitlementStatus && (billingStatusValues as readonly string[]).includes(entitlementStatus)) {
    return entitlementStatus as (typeof billingStatusValues)[number];
  }

  return normalizeStripeSubscriptionStatus(subscriptionStatus);
}

function toPlanCode(value: string | null | undefined): (typeof planCodeValues)[number] {
  if (value && (planCodeValues as readonly string[]).includes(value)) {
    return value as (typeof planCodeValues)[number];
  }

  return "free";
}

export async function listAdminUsers(input: z.infer<typeof baseListUsersQuerySchema>) {
  let offset = 0;
  if (input.cursor) {
    const decodedCursor = decodeCursor(input.cursor);
    if (!decodedCursor || decodedCursor.sort !== input.sort) {
      return { ok: false as const, status: 400, error: "Invalid cursor" };
    }

    offset = decodedCursor.offset;
  }

  const filters = buildUserListFilters(input);
  const whereClause = filters.length > 0 ? and(...filters) : undefined;

  const orderByClause =
    input.sort === "name_asc"
      ? [asc(sql`coalesce(lower(${users.name}), lower(${users.email}))`), asc(users.id)]
      : input.sort === "cost_desc"
        ? [desc(sql`coalesce(${entitlements.aiSpendToDateEur}, '0')::numeric`), asc(users.id)]
        : [desc(lastActiveAtSql), desc(users.id)];

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        planCode: entitlements.planCode,
        trialEndsAt: entitlements.trialEndsAt,
        aiCostUsedEur: entitlements.aiSpendToDateEur,
        aiCostLimitEur: entitlements.aiHardCapEur,
        status: billingStatusSql,
        lastActiveAt: lastActiveAtSql,
      })
      .from(users)
      .leftJoin(entitlements, eq(entitlements.userId, users.id))
      .leftJoin(
        billingSubscriptions,
        eq(entitlements.billingSubscriptionId, billingSubscriptions.id)
      )
      .where(whereClause)
      .orderBy(...orderByClause)
      .limit(input.limit + 1)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .leftJoin(entitlements, eq(entitlements.userId, users.id))
      .leftJoin(
        billingSubscriptions,
        eq(entitlements.billingSubscriptionId, billingSubscriptions.id)
      )
      .where(whereClause),
  ]);

  const hasNextPage = rows.length > input.limit;
  const items = rows.slice(0, input.limit).map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name?.trim() || row.email,
    planCode: toPlanCode(row.planCode),
    status: toBillingStatus(row.status),
    trialEndsAt: toIsoDateNullable(row.trialEndsAt),
    aiCostUsedEur: toNumber(row.aiCostUsedEur),
    aiCostLimitEur: toNumber(row.aiCostLimitEur),
    lastActiveAt: toIsoDate(row.lastActiveAt),
  }));

  return {
    ok: true as const,
    data: {
      items,
      total: totalRows[0]?.count ?? 0,
      nextCursor: hasNextPage ? encodeCursor(offset + input.limit, input.sort) : null,
    },
  };
}

export async function getAdminUserDetail(userId: string) {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      createdAt: users.createdAt,
      planCode: entitlements.planCode,
      entitlementStatus: entitlements.status,
      aiEnabled: entitlements.aiEnabled,
      aiHardCapEur: entitlements.aiHardCapEur,
      aiSpendToDateEur: entitlements.aiSpendToDateEur,
      trialEndsAt: entitlements.trialEndsAt,
      aiBlockedReason: entitlements.aiBlockedReason,
      subscriptionStatus: billingSubscriptions.status,
      planInterval: billingSubscriptions.planInterval,
    })
    .from(users)
    .leftJoin(entitlements, eq(entitlements.userId, users.id))
    .leftJoin(billingSubscriptions, eq(entitlements.billingSubscriptionId, billingSubscriptions.id))
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return null;
  }

  const [transactionsCount, categoriesCount, attachmentsSummary] = await Promise.all([
    db
      .select({
        count: sql<number>`(
          (select count(*)::int from ${expenses} where ${expenses.userId} = ${userId}) +
          (select count(*)::int from ${dailyExpenses} where ${dailyExpenses.userId} = ${userId}) +
          (select count(*)::int from ${incomes} where ${incomes.userId} = ${userId}) +
          (select count(*)::int from ${transfers} where ${transfers.userId} = ${userId})
        )`,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(categories)
      .where(eq(categories.userId, userId)),
    db
      .select({
        count: sql<number>`count(*)::int`,
        totalBytes: sql<number>`coalesce(sum(${documents.size}), 0)::int`,
      })
      .from(documents)
      .where(eq(documents.userId, userId)),
  ]);

  return {
    id: user.id,
    email: user.email,
    name: user.name?.trim() || user.email,
    createdAt: toIsoDate(user.createdAt),
    billing: {
      planCode: toPlanCode(user.planCode),
      interval: user.planInterval ?? "none",
      status: resolveBillingStatus(user.entitlementStatus, user.subscriptionStatus),
      trialEndsAt: toIsoDateNullable(user.trialEndsAt),
    },
    entitlement: {
      aiEnabled: user.aiEnabled ?? false,
      aiCostUsedEur: toNumber(user.aiSpendToDateEur),
      aiCostLimitEur: toNumber(user.aiHardCapEur),
      reason: user.aiBlockedReason ?? "none",
    },
    dbFootprint: {
      transactionsCount: transactionsCount[0]?.count ?? 0,
      categoriesCount: categoriesCount[0]?.count ?? 0,
      budgetsCount: 0,
      attachmentsCount: attachmentsSummary[0]?.count ?? 0,
      estimatedStorageMb: Number(
        ((attachmentsSummary[0]?.totalBytes ?? 0) / (1024 * 1024)).toFixed(2)
      ),
    },
  };
}

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date: Date) {
  const result = new Date(date);
  result.setUTCHours(23, 59, 59, 999);
  return result;
}

function buildDateRange(from?: string, to?: string) {
  const today = new Date();
  const resolvedTo = to ? new Date(to) : today;
  const resolvedFrom = from
    ? new Date(from)
    : new Date(
        Date.UTC(
          resolvedTo.getUTCFullYear(),
          resolvedTo.getUTCMonth(),
          resolvedTo.getUTCDate() - 29
        )
      );

  return {
    from: startOfDay(resolvedFrom),
    to: endOfDay(resolvedTo),
  };
}

export async function getAdminUserUsage(userId: string, query: z.infer<typeof usageQuerySchema>) {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    return { ok: false as const, status: 404, error: "User not found" };
  }

  const range = buildDateRange(query.from, query.to);
  if (range.from.getTime() > range.to.getTime()) {
    return { ok: false as const, status: 400, error: "Invalid date range" };
  }

  const daySql = sql<string>`to_char(date_trunc('day', ${usageEvents.createdAt}), 'YYYY-MM-DD')`;

  const rows = await db
    .select({
      day: daySql,
      prompts: sql<number>`count(*)::int`,
      aiCostEur: sql<string>`coalesce(sum(${usageEvents.totalCostEur}), 0)::text`,
    })
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.userId, userId),
        sql`${usageEvents.createdAt} >= ${range.from}`,
        sql`${usageEvents.createdAt} <= ${range.to}`
      )
    )
    .groupBy(daySql)
    .orderBy(asc(daySql));

  const rowMap = new Map(rows.map((row) => [row.day, row]));
  const timeline: Array<{ day: string; prompts: number; aiCostEur: number }> = [];

  for (
    let cursor = startOfDay(range.from);
    cursor.getTime() <= range.to.getTime();
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  ) {
    const day = cursor.toISOString().slice(0, 10);
    const row = rowMap.get(day);
    timeline.push({
      day,
      prompts: row?.prompts ?? 0,
      aiCostEur: toNumber(row?.aiCostEur),
    });
  }

  const totals = timeline.reduce(
    (acc, point) => {
      acc.prompts += point.prompts;
      acc.aiCostEur += point.aiCostEur;
      return acc;
    },
    { prompts: 0, aiCostEur: 0 }
  );

  return {
    ok: true as const,
    data: {
      userId,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      totals: {
        prompts: totals.prompts,
        aiCostEur: Number(totals.aiCostEur.toFixed(6)),
      },
      timeline,
    },
  };
}
