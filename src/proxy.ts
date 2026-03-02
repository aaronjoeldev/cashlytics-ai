import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isBillingRequired } from "@/lib/billing/config";

type BillingAccessResponse = {
  appAccess?: "full" | "settings_only";
};

function isSettingsRoute(pathname: string): boolean {
  return pathname === "/settings" || pathname.startsWith("/settings/");
}

function isAllowedWhenLocked(pathname: string): boolean {
  return (
    isSettingsRoute(pathname) ||
    pathname === "/api/billing/me" ||
    pathname === "/api/stripe/checkout" ||
    pathname === "/api/stripe/portal"
  );
}

async function getAppAccessFromBilling(
  request: NextRequest
): Promise<"full" | "settings_only" | null> {
  try {
    const cookie = request.headers.get("cookie");
    const response = await fetch(new URL("/api/billing/me", request.url), {
      method: "GET",
      headers: cookie ? { cookie } : undefined,
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as BillingAccessResponse;
    return payload.appAccess ?? null;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const secureCookie =
    request.headers.get("x-forwarded-proto") === "https" || request.nextUrl.protocol === "https:";
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie,
  });
  const isLoggedIn = !!token;
  const { pathname } = request.nextUrl;

  // Allow auth API routes
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Allow cron API routes (secured via CRON_SECRET Bearer token, not session)
  if (pathname.startsWith("/api/cron/")) {
    return NextResponse.next();
  }

  // Allow Stripe webhook route (secured via signature verification)
  if (pathname === "/api/stripe/webhook") {
    return NextResponse.next();
  }

  // Allow admin API routes (secured via X-Admin-Service-Key, not session)
  if (pathname.startsWith("/api/admin/")) {
    return NextResponse.next();
  }

  // Allow static assets
  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/_static")
  ) {
    return NextResponse.next();
  }

  // Allow public pages (login, register, forgot-password, reset-password)
  if (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname.startsWith("/reset-password")
  ) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // Protect all other routes
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isBillingRequired() && !isAllowedWhenLocked(pathname)) {
    const appAccess = await getAppAccessFromBilling(request);
    if (appAccess === "settings_only") {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          {
            error: {
              code: "APP_ACCESS_LOCKED",
              reason: "trial_expired_unpaid",
              message:
                "Deine Testphase ist abgelaufen. Bitte schließe ein Abo in den Einstellungen ab.",
            },
          },
          { status: 402 }
        );
      }

      return NextResponse.redirect(new URL("/settings", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.svg$|.*\\.png$|.*\\.ico$|.*\\.webmanifest$|public/).*)",
  ],
};
