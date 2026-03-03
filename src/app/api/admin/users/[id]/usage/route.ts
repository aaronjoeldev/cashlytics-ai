import { NextResponse } from "next/server";
import { validateAdminServiceKey } from "@/lib/admin/auth";
import { getAdminUserUsage, parseAdminUsageQuery, userIdParamSchema } from "@/lib/admin/users";
import { logger } from "@/lib/logger";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const runtime = "nodejs";

export async function GET(request: Request, context: RouteContext) {
  const auth = validateAdminServiceKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const params = await context.params;
  const parsedParams = userIdParamSchema.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const parsedQuery = parseAdminUsageQuery(new URL(request.url).searchParams);
  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: "Invalid query params", details: parsedQuery.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const result = await getAdminUserUsage(parsedParams.data.id, parsedQuery.data);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.data, { status: 200 });
  } catch (error) {
    logger.error("Failed to load admin user usage", "GET /api/admin/users/:id/usage", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
