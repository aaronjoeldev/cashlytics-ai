import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { billingEvents, usageEvents, users } from "@/lib/db/schema";
import {
  AI_SPIKE_ABSOLUTE_THRESHOLD_EUR,
  AI_SPIKE_RATIO_THRESHOLD,
  WEBHOOK_FAILURE_RATE_THRESHOLD,
  WEBHOOK_FAILURE_THRESHOLD,
  WEBHOOK_WINDOW_MINUTES,
  evaluateAiSpendSpikeAlert,
  evaluateWebhookFailureAlert,
} from "@/lib/admin/diagnostics-alerts";

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function toIsoDateNullable(value: Date | string | null | undefined): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return null;
}

export async function getBillingPipelineHealthSummary(now: Date = new Date()) {
  const windowStart = new Date(now.getTime() - WEBHOOK_WINDOW_MINUTES * 60 * 1000);

  const [counts] = await db
    .select({
      total: sql<number>`count(*)`,
      failed: sql<number>`sum(case when ${billingEvents.outcome} = 'failed' then 1 else 0 end)`,
      processed: sql<number>`sum(case when ${billingEvents.outcome} = 'processed' then 1 else 0 end)`,
      ignored: sql<number>`sum(case when ${billingEvents.outcome} = 'ignored' then 1 else 0 end)`,
      duplicate: sql<number>`sum(case when ${billingEvents.outcome} = 'duplicate' then 1 else 0 end)`,
    })
    .from(billingEvents)
    .where(gte(billingEvents.processedAt, windowStart));

  const [latestEvent] = await db
    .select({ processedAt: billingEvents.processedAt })
    .from(billingEvents)
    .orderBy(desc(billingEvents.processedAt))
    .limit(1);

  const total = Number(counts?.total ?? 0);
  const failed = Number(counts?.failed ?? 0);
  const processed = Number(counts?.processed ?? 0);
  const ignored = Number(counts?.ignored ?? 0);
  const duplicate = Number(counts?.duplicate ?? 0);

  const alert = evaluateWebhookFailureAlert({ total, failed });

  return {
    checkedAt: now.toISOString(),
    window: {
      from: windowStart.toISOString(),
      to: now.toISOString(),
      minutes: WEBHOOK_WINDOW_MINUTES,
    },
    status: alert.status,
    totals: {
      total,
      failed,
      processed,
      ignored,
      duplicate,
      failureRatePct: alert.failureRatePct,
    },
    thresholds: {
      failedCount: WEBHOOK_FAILURE_THRESHOLD,
      failedRatePct: WEBHOOK_FAILURE_RATE_THRESHOLD,
    },
    alerts: {
      failedCountExceeded: alert.failedThresholdExceeded,
      failedRateExceeded: alert.failureRateThresholdExceeded,
    },
    latestEventAt: toIsoDateNullable(latestEvent?.processedAt),
  };
}

export async function getUsageAnomalySummary(now: Date = new Date()) {
  const currentWindowStart = new Date(now.getTime() - 60 * 60 * 1000);
  const baselineWindowStart = new Date(now.getTime() - 25 * 60 * 60 * 1000);

  const [current] = await db
    .select({
      spendEur: sql<number>`coalesce(sum(cast(${usageEvents.totalCostEur} as numeric)), 0)`,
      events: sql<number>`count(*)`,
    })
    .from(usageEvents)
    .where(gte(usageEvents.occurredAt, currentWindowStart));

  const [baseline] = await db
    .select({
      spendEur: sql<number>`coalesce(sum(cast(${usageEvents.totalCostEur} as numeric)), 0)`,
      events: sql<number>`count(*)`,
    })
    .from(usageEvents)
    .where(
      and(
        gte(usageEvents.occurredAt, baselineWindowStart),
        lt(usageEvents.occurredAt, currentWindowStart)
      )
    );

  const contributorSpendExpr = sql<number>`coalesce(sum(cast(${usageEvents.totalCostEur} as numeric)), 0)`;

  const contributors = await db
    .select({
      userId: usageEvents.userId,
      email: users.email,
      spendEur: contributorSpendExpr,
    })
    .from(usageEvents)
    .leftJoin(users, eq(users.id, usageEvents.userId))
    .where(gte(usageEvents.occurredAt, currentWindowStart))
    .groupBy(usageEvents.userId, users.email)
    .orderBy(desc(contributorSpendExpr))
    .limit(3);

  const currentHourSpendEur = Number(toNumber(current?.spendEur).toFixed(2));
  const baseline24hSpendEur = Number(toNumber(baseline?.spendEur).toFixed(2));
  const spikeAlert = evaluateAiSpendSpikeAlert({
    currentHourSpendEur,
    baseline24hSpendEur,
  });

  return {
    checkedAt: now.toISOString(),
    windows: {
      currentHour: {
        from: currentWindowStart.toISOString(),
        to: now.toISOString(),
      },
      baseline24Hours: {
        from: baselineWindowStart.toISOString(),
        to: currentWindowStart.toISOString(),
      },
    },
    status: spikeAlert.status,
    spend: {
      currentHourEur: currentHourSpendEur,
      baseline24hEur: baseline24hSpendEur,
      baselineHourlyAvgEur: spikeAlert.baselineHourlyAvgEur,
      ratioToBaseline: spikeAlert.ratioToBaseline,
    },
    totals: {
      currentHourEvents: Number(current?.events ?? 0),
      baseline24hEvents: Number(baseline?.events ?? 0),
    },
    threshold: {
      ratio: AI_SPIKE_RATIO_THRESHOLD,
      absoluteEur: AI_SPIKE_ABSOLUTE_THRESHOLD_EUR,
      breached: spikeAlert.thresholdBreached,
    },
    topContributors: contributors.map((row) => ({
      userId: row.userId,
      email: row.email ?? null,
      spendEur: Number(toNumber(row.spendEur).toFixed(2)),
    })),
  };
}
