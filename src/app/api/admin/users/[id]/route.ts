import { NextResponse } from "next/server";
import { validateAdminServiceKey } from "@/lib/admin/auth";
import { getAdminUserDetail, userIdParamSchema } from "@/lib/admin/users";
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

  try {
    const detail = await getAdminUserDetail(parsedParams.data.id);
    if (!detail) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(detail, { status: 200 });
  } catch (error) {
    logger.error("Failed to load admin user detail", "GET /api/admin/users/:id", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
