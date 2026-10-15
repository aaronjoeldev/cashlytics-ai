import { NextResponse } from "next/server";

/** Public VAPID key for the browser; `null` (503) when push is not configured on this server. */
export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY;
  const configured = Boolean(key && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
  return NextResponse.json({ key: configured ? key : null }, { status: configured ? 200 : 503 });
}
