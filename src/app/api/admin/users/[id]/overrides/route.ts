import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { resolveAdminActor, validateAdminServiceKey } from "@/lib/admin/auth";
import {
  adminOverrideSchema,
  applyAdminOverride,
  ensureUserExists,
  getAdminOverrideTimeline,
  userIdParamSchema,
} from "@/lib/admin/overrides";

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

  const exists = await ensureUserExists(parsedParams.data.id);
  if (!exists) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    const entries = await getAdminOverrideTimeline(parsedParams.data.id);
    return NextResponse.json({ userId: parsedParams.data.id, entries });
  } catch (error) {
    logger.error(
      "Failed to load override audit timeline",
      "GET /api/admin/users/:id/overrides",
      error
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const auth = validateAdminServiceKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const params = await context.params;
  const parsedParams = userIdParamSchema.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsedBody = adminOverrideSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Invalid override payload", details: parsedBody.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const actor = resolveAdminActor(request);

  try {
    const result = await applyAdminOverride({
      userId: parsedParams.data.id,
      actor,
      payload: parsedBody.data,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.data, { status: 200 });
  } catch (error) {
    logger.error("Failed to apply admin override", "POST /api/admin/users/:id/overrides", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
