const ADMIN_SERVICE_KEY_HEADER = "x-admin-service-key";

export function validateAdminServiceKey(
  request: Request
): { valid: true } | { valid: false; status: number; error: string } {
  const configuredKey = process.env.ADMIN_SERVICE_KEY;
  if (!configuredKey) {
    return { valid: false, status: 500, error: "ADMIN_SERVICE_KEY not configured" };
  }

  const providedKey = request.headers.get(ADMIN_SERVICE_KEY_HEADER);
  if (!providedKey || providedKey !== configuredKey) {
    return { valid: false, status: 401, error: "Unauthorized" };
  }

  return { valid: true };
}

export function resolveAdminActor(request: Request): string {
  const actor = request.headers.get("x-admin-actor")?.trim();
  if (actor && actor.length > 0) {
    return actor.slice(0, 128);
  }

  return "admin-service";
}
