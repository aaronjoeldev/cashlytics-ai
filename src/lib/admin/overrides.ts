import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { adminOverrideAudit, entitlements, users } from "@/lib/db/schema";

const overrideBaseSchema = z.object({
  reason: z.string().trim().min(10).max(500),
});

const extendTrialSchema = overrideBaseSchema.extend({
  action: z.literal("extend_trial_end"),
  trialEndsAt: z.coerce.date(),
});

const adjustAiCapSchema = overrideBaseSchema.extend({
  action: z.literal("adjust_ai_cap"),
  aiHardCapEur: z.number().nonnegative().max(100000),
});

const setAiEnabledSchema = overrideBaseSchema.extend({
  action: z.literal("set_ai_enabled"),
  aiEnabled: z.boolean(),
});

const overridePlanStatusSchema = overrideBaseSchema.extend({
  action: z.literal("override_plan_status"),
  planCode: z.string().trim().min(1).max(64),
  status: z.enum(["trial", "active", "past_due", "canceled", "none", "inactive"]),
});

export const adminOverrideSchema = z.discriminatedUnion("action", [
  extendTrialSchema,
  adjustAiCapSchema,
  setAiEnabledSchema,
  overridePlanStatusSchema,
]);

type EntitlementRow = typeof entitlements.$inferSelect;
type AdminOverridePayload = z.infer<typeof adminOverrideSchema>;

type EntitlementAuditSnapshot = {
  planCode: string;
  status: string;
  aiEnabled: boolean;
  aiHardCapEur: string;
  trialEndsAt: string | null;
  aiBlockedReason: string | null;
  updatedAt: string;
};

function toAuditSnapshot(entitlement: EntitlementRow): EntitlementAuditSnapshot {
  return {
    planCode: entitlement.planCode,
    status: entitlement.status,
    aiEnabled: entitlement.aiEnabled,
    aiHardCapEur: entitlement.aiHardCapEur,
    trialEndsAt: entitlement.trialEndsAt?.toISOString() ?? null,
    aiBlockedReason: entitlement.aiBlockedReason,
    updatedAt: entitlement.updatedAt.toISOString(),
  };
}

export async function applyAdminOverride(params: {
  userId: string;
  actor: string;
  payload: AdminOverridePayload;
}) {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, params.userId))
      .limit(1);

    if (!user) {
      return { ok: false as const, status: 404, error: "User not found" };
    }

    await tx
      .insert(entitlements)
      .values({ userId: params.userId })
      .onConflictDoNothing({ target: entitlements.userId });

    const [current] = await tx
      .select()
      .from(entitlements)
      .where(eq(entitlements.userId, params.userId))
      .limit(1);

    if (!current) {
      return { ok: false as const, status: 500, error: "Failed to load entitlement" };
    }

    if (
      params.payload.action === "extend_trial_end" &&
      current.trialEndsAt &&
      params.payload.trialEndsAt.getTime() <= current.trialEndsAt.getTime()
    ) {
      return {
        ok: false as const,
        status: 400,
        error: "trialEndsAt must be after current trial end",
      };
    }

    const nextValues: Partial<typeof entitlements.$inferInsert> = {
      updatedAt: new Date(),
    };

    switch (params.payload.action) {
      case "extend_trial_end":
        nextValues.trialEndsAt = params.payload.trialEndsAt;
        break;
      case "adjust_ai_cap":
        nextValues.aiHardCapEur = params.payload.aiHardCapEur.toFixed(2);
        break;
      case "set_ai_enabled":
        nextValues.aiEnabled = params.payload.aiEnabled;
        nextValues.aiBlockedReason = params.payload.aiEnabled ? null : "admin_override_disabled";
        break;
      case "override_plan_status":
        nextValues.planCode = params.payload.planCode;
        nextValues.status = params.payload.status;
        break;
    }

    const [updated] = await tx
      .update(entitlements)
      .set(nextValues)
      .where(eq(entitlements.userId, params.userId))
      .returning();

    if (!updated) {
      return { ok: false as const, status: 500, error: "Failed to apply override" };
    }

    const beforeSnapshot = {
      entitlement: toAuditSnapshot(current),
    };
    const afterSnapshot = {
      entitlement: toAuditSnapshot(updated),
      override: params.payload,
    };

    await tx.insert(adminOverrideAudit).values({
      userId: params.userId,
      actor: params.actor,
      reason: params.payload.reason,
      actionType: params.payload.action,
      beforeSnapshot,
      afterSnapshot,
    });

    return {
      ok: true as const,
      data: {
        userId: params.userId,
        action: params.payload.action,
        entitlement: toAuditSnapshot(updated),
      },
    };
  });
}

export async function getAdminOverrideTimeline(userId: string) {
  const rows = await db
    .select({
      id: adminOverrideAudit.id,
      actor: adminOverrideAudit.actor,
      reason: adminOverrideAudit.reason,
      actionType: adminOverrideAudit.actionType,
      beforeSnapshot: adminOverrideAudit.beforeSnapshot,
      afterSnapshot: adminOverrideAudit.afterSnapshot,
      createdAt: adminOverrideAudit.createdAt,
    })
    .from(adminOverrideAudit)
    .where(eq(adminOverrideAudit.userId, userId))
    .orderBy(desc(adminOverrideAudit.createdAt));

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function ensureUserExists(userId: string) {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  return !!user;
}

export const userIdParamSchema = z.object({
  id: z.uuid(),
});
