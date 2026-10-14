import { NextResponse } from "next/server";
import { checkUpcomingPayments } from "@/lib/cron/upcoming-payments";
import { logger } from "@/lib/logger";
import { isValidCronRequest } from "@/lib/auth/cron-secret";

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!isValidCronRequest(authHeader, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await checkUpcomingPayments();
    return NextResponse.json({ success: true, notified: result.notified, total: result.total });
  } catch (error) {
    logger.error("Upcoming payments cron error", "GET /api/cron/upcoming-payments", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
