import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { conversations, usageEvents, usagePeriods } from "@/lib/db/schema";
import { calculateUsageCostEur } from "@/lib/ai/pricing";

type RecordUsageInput = {
  userId: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  conversationId?: string | null;
  requestId?: string | null;
  occurredAt?: Date;
};

export type UsagePeriodType = "daily" | "monthly";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfNextUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function startOfNextUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function normalizeRequestId(requestId?: string | null): string | null {
  if (!requestId) {
    return null;
  }

  const trimmed = requestId.trim();

  return trimmed.length > 0 ? trimmed : null;
}

async function resolveConversationId(
  userId: string,
  conversationId?: string | null
): Promise<string | null> {
  if (!conversationId) {
    return null;
  }

  if (!UUID_PATTERN.test(conversationId)) {
    return null;
  }

  const [ownedConversation] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .limit(1);

  return ownedConversation?.id ?? null;
}

export async function recordAssistantUsageEvent(input: RecordUsageInput): Promise<void> {
  const occurredAt = input.occurredAt ?? new Date();
  const requestId = normalizeRequestId(input.requestId);
  const conversationId = await resolveConversationId(input.userId, input.conversationId);

  const costs = calculateUsageCostEur({
    model: input.model,
    promptTokens: input.promptTokens,
    completionTokens: input.completionTokens,
  });

  await db.transaction(async (tx) => {
    const upsertUsagePeriod = async (params: {
      userId: string;
      periodType: UsagePeriodType;
      periodStart: Date;
      periodEnd: Date;
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      totalCostEur: string;
    }) => {
      await tx
        .insert(usagePeriods)
        .values({
          userId: params.userId,
          periodType: params.periodType,
          periodStart: params.periodStart,
          periodEnd: params.periodEnd,
          totalPromptTokens: params.promptTokens,
          totalCompletionTokens: params.completionTokens,
          totalTokens: params.totalTokens,
          totalCostEur: params.totalCostEur,
          lastAggregatedAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [usagePeriods.userId, usagePeriods.periodType, usagePeriods.periodStart],
          set: {
            periodEnd: params.periodEnd,
            totalPromptTokens: sql`${usagePeriods.totalPromptTokens} + ${params.promptTokens}`,
            totalCompletionTokens: sql`${usagePeriods.totalCompletionTokens} + ${params.completionTokens}`,
            totalTokens: sql`${usagePeriods.totalTokens} + ${params.totalTokens}`,
            totalCostEur: sql`${usagePeriods.totalCostEur} + ${params.totalCostEur}`,
            lastAggregatedAt: new Date(),
            updatedAt: new Date(),
          },
        });
    };

    const inserted = await tx
      .insert(usageEvents)
      .values({
        userId: input.userId,
        conversationId,
        requestId,
        model: input.model,
        promptTokens: input.promptTokens,
        completionTokens: input.completionTokens,
        totalTokens: input.totalTokens,
        inputCostEur: costs.inputCostEur,
        outputCostEur: costs.outputCostEur,
        totalCostEur: costs.totalCostEur,
        pricingVersion: costs.pricingVersion,
        occurredAt,
      })
      .onConflictDoNothing({ target: [usageEvents.userId, usageEvents.requestId] })
      .returning({ id: usageEvents.id });

    if (inserted.length === 0) {
      return;
    }

    await upsertUsagePeriod({
      userId: input.userId,
      periodType: "daily",
      periodStart: startOfUtcDay(occurredAt),
      periodEnd: startOfNextUtcDay(occurredAt),
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      totalTokens: input.totalTokens,
      totalCostEur: costs.totalCostEur,
    });

    await upsertUsagePeriod({
      userId: input.userId,
      periodType: "monthly",
      periodStart: startOfUtcMonth(occurredAt),
      periodEnd: startOfNextUtcMonth(occurredAt),
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      totalTokens: input.totalTokens,
      totalCostEur: costs.totalCostEur,
    });
  });
}

export async function getUserCurrentMonthSpend(userId: string): Promise<{
  totalCostEur: string;
  totalTokens: number;
}> {
  const now = new Date();
  const monthStart = startOfUtcMonth(now);

  const [period] = await db
    .select({
      totalCostEur: usagePeriods.totalCostEur,
      totalTokens: usagePeriods.totalTokens,
    })
    .from(usagePeriods)
    .where(
      and(
        eq(usagePeriods.userId, userId),
        eq(usagePeriods.periodType, "monthly"),
        eq(usagePeriods.periodStart, monthStart)
      )
    )
    .limit(1);

  return {
    totalCostEur: period?.totalCostEur ?? "0.000000",
    totalTokens: period?.totalTokens ?? 0,
  };
}
