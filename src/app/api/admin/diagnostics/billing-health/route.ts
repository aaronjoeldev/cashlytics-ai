import { NextResponse } from "next/server";
import { validateAdminServiceKey } from "@/lib/admin/auth";
import { getBillingPipelineHealthSummary } from "@/lib/admin/diagnostics";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = validateAdminServiceKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const summary = await getBillingPipelineHealthSummary();
    return NextResponse.json(summary);
  } catch (error) {
    logger.error(
      "Failed to load billing pipeline diagnostics",
      "GET /api/admin/diagnostics/billing-health",
      error
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
