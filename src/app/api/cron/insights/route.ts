import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { generateInsights } from "@/lib/insights/generate-insights";
import { logger } from "@/lib/logger";
import { isValidCronRequest } from "@/lib/auth/cron-secret";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (!isValidCronRequest(authHeader, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const allUsers = await db.select({ id: users.id }).from(users);
    let totalGenerated = 0;

    for (const user of allUsers) {
      const result = await generateInsights(user.id);
      totalGenerated += result.generated;
    }

    logger.info(
      `Insights generated: ${totalGenerated} for ${allUsers.length} users`,
      "cron/insights"
    );
    return NextResponse.json({ success: true, totalGenerated, users: allUsers.length });
  } catch (error) {
    logger.error("Cron insights failed", "cron/insights", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
