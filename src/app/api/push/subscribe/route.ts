import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { auth } from "@/auth";
import { z } from "zod";

const subscribeSchema = z.object({
  endpoint: z.string().min(1),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const body = await req.json();
    const parsed = subscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Ungültige Anfrage", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { endpoint, p256dh, auth: authKey } = parsed.data;

    await db
      .insert(pushSubscriptions)
      .values({ userId, endpoint, p256dh, auth: authKey })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { userId, p256dh, auth: authKey },
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Push subscribe error", "POST /api/push/subscribe", error);
    return NextResponse.json({ error: "Fehler beim Speichern des Abonnements" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const body = await req.json();
    const parsed = unsubscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Ungültige Anfrage", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { endpoint } = parsed.data;

    await db
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, userId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Push unsubscribe error", "DELETE /api/push/subscribe", error);
    return NextResponse.json({ error: "Fehler beim Entfernen des Abonnements" }, { status: 500 });
  }
}
