import { NextResponse } from "next/server";
import type { z } from "zod";
import { authenticateApiToken, type ApiTokenAuth } from "@/lib/auth/api-token";
import { rateLimit } from "@/lib/rate-limiter";
import { logger } from "@/lib/logger";
import { loadFinanceContext, type FinanceContext } from "@/lib/services/context";
import { searchParamsToObject } from "@/lib/validations/api";

/**
 * Helpers for the read-only REST API under /api/v1, used by integrations such as Home Assistant.
 * Requests authenticate with a personal API token (`Authorization: Bearer csk_…`); the proxy lets
 * these routes through without a session.
 */

/** Bumped on breaking changes to the /api/v1 response shapes. */
export const API_VERSION = 1;

const REQUESTS_PER_MINUTE = 120;

export type ApiErrorCode =
  "unauthorized" | "not_found" | "invalid_request" | "rate_limited" | "internal_error";

export function apiJson(data: unknown, init: ResponseInit = {}): NextResponse {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  return NextResponse.json(data, { ...init, headers });
}

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  headers?: HeadersInit
): NextResponse {
  return apiJson({ error: { code, message } }, { status, headers });
}

/** Parses the query string, or returns a 400 response describing the first invalid parameter. */
export function parseQuery<S extends z.ZodType>(
  request: Request,
  schema: S
): { data: z.infer<S>; response?: never } | { data?: never; response: NextResponse } {
  const result = schema.safeParse(searchParamsToObject(new URL(request.url).searchParams));
  if (result.success) return { data: result.data };
  const issue = result.error.issues[0];
  const field = issue?.path.join(".") || "query";
  return {
    response: apiError(400, "invalid_request", `${field}: ${issue?.message ?? "invalid"}`),
  };
}

type ApiHandler = (
  request: Request,
  context: FinanceContext,
  auth: ApiTokenAuth
) => Promise<Response>;

/**
 * Wraps a route handler with token authentication, a per-token rate limit and a JSON 500 for
 * unexpected errors. The handler receives the user's finance context.
 */
export function withApiToken(name: string, handler: ApiHandler) {
  return async (request: Request): Promise<Response> => {
    try {
      const auth = await authenticateApiToken(request.headers.get("authorization"));
      if (!auth) {
        return apiError(401, "unauthorized", "Missing, invalid or expired API token", {
          "WWW-Authenticate": 'Bearer realm="cashlytics"',
        });
      }

      const limit = rateLimit(`api:${auth.tokenId}`, REQUESTS_PER_MINUTE, 60_000);
      if (!limit.allowed) {
        const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
        return apiError(429, "rate_limited", "Too many requests", {
          "Retry-After": String(retryAfter),
        });
      }

      const context = await loadFinanceContext(auth.userId);
      return await handler(request, context, auth);
    } catch (error) {
      logger.error(`API request failed: ${name}`, "api/v1", error);
      return apiError(500, "internal_error", "Internal error");
    }
  };
}

/** Money with two decimals, so floating point noise does not reach the client. */
export function money(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Percentages with one decimal. */
export function percent(value: number): number {
  return Math.round(value * 10) / 10;
}

/** A UTC-midnight date as "YYYY-MM-DD". */
export function calendarDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}
