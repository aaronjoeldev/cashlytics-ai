import { APP_VERSION } from "@/lib/version";
import { API_VERSION, apiJson } from "@/lib/api/v1";

// Answered per request, so a monitoring check sees the running instance and not a build artefact
export const dynamic = "force-dynamic";

/** Public liveness check; integrations also read the API version from it before connecting. */
export async function GET() {
  return apiJson({ status: "ok", version: APP_VERSION, apiVersion: API_VERSION });
}
