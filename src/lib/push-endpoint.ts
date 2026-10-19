/**
 * Validates that a Web Push subscription endpoint points to a known push service.
 * Prevents blind SSRF: the server sends requests to the stored endpoint when delivering reminders.
 */

const EXACT_HOSTS = new Set([
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
]);

// Suffixes with dot boundary (the host must have at least one label before the suffix).
const SUFFIX_HOSTS = [".push.services.mozilla.com", ".push.apple.com", ".notify.windows.com"];

export function isAllowedPushEndpoint(endpoint: unknown): boolean {
  if (typeof endpoint !== "string" || endpoint.length === 0 || endpoint.length > 2048) return false;

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") return false;
  if (url.username !== "" || url.password !== "") return false;
  // The URL parser strips the default port (443); anything left is a non-default port.
  if (url.port !== "") return false;

  const host = url.hostname.toLowerCase();
  if (EXACT_HOSTS.has(host)) return true;
  return SUFFIX_HOSTS.some((suffix) => host.length > suffix.length && host.endsWith(suffix));
}
