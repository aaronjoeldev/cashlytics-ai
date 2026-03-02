import { NextResponse } from "next/server";
import { validateAdminServiceKey } from "@/lib/admin/auth";
import { listAdminUsers, parseAdminUsersListQuery } from "@/lib/admin/users";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = validateAdminServiceKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const parsedQuery = parseAdminUsersListQuery(new URL(request.url).searchParams);
  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: "Invalid query params", details: parsedQuery.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const result = await listAdminUsers(parsedQuery.data);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.data, { status: 200 });
  } catch (error) {
    logger.error("Failed to list admin users", "GET /api/admin/users", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
