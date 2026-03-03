"use server";

import { requireAuth } from "@/lib/auth/require-auth";
import { getEntitlementSnapshotByUserId } from "@/lib/billing/repository";
import { logger } from "@/lib/logger";

export async function getMyEntitlementSnapshot() {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return { success: false as const, error: "Unauthorized" };
    }

    const snapshot = await getEntitlementSnapshotByUserId(authResult.userId);
    return { success: true as const, data: snapshot };
  } catch (error) {
    logger.error("Failed to load entitlement snapshot", "getMyEntitlementSnapshot", error);
    return { success: false as const, error: "Failed to load entitlement snapshot" };
  }
}
