import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { rateLimit } from "@/lib/rate-limiter";
import { logger } from "@/lib/logger";
import { isAiEnabled } from "@/lib/import/feature-gating";
import { scanReceipt } from "@/lib/ai/receipt-scanner";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png"] as const;
type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const rl = rateLimit(`receipt-scan:${userId}`, 5, 60_000);
  if (!rl.allowed) {
    const retryAfterSecs = Math.ceil((rl.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { success: false, error: "Zu viele Anfragen. Bitte warte einen Moment." },
      { status: 429, headers: { "Retry-After": String(retryAfterSecs) } }
    );
  }

  if (!isAiEnabled()) {
    return NextResponse.json(
      { success: false, error: "KI nicht konfiguriert. OPENAI_API_KEY erforderlich." },
      { status: 400 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Keine Datei hochgeladen." },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type as AllowedMimeType)) {
      return NextResponse.json(
        { success: false, error: "Ungültiges Format. Erlaubt: JPG, PNG." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: "Datei zu groß. Maximum: 5 MB." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    const userCategories = await db
      .select({ name: categories.name })
      .from(categories)
      .where(eq(categories.userId, userId));

    const categoryNames = userCategories.map((c) => c.name);

    const result = await scanReceipt(base64, file.type as AllowedMimeType, categoryNames);

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error) {
    logger.error("Receipt scan failed", "POST /api/receipt-scan", error);
    return NextResponse.json(
      { success: false, error: "Beleg konnte nicht analysiert werden." },
      { status: 500 }
    );
  }
}
