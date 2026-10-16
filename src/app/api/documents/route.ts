import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const userDocuments = await db
      .select()
      .from(documents)
      .where(eq(documents.userId, session.user.id));
    return NextResponse.json(
      userDocuments.map((d) => ({
        id: d.id,
        fileName: d.fileName,
        mimeType: d.mimeType,
        size: d.size,
      }))
    );
  } catch (error) {
    logger.error("Document fetch error", "GET /api/documents", error);
    return NextResponse.json({ error: "Fehler beim Laden" }, { status: 500 });
  }
}
