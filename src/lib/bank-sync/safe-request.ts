import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { request } from "node:https";
import { BlockList, isIP } from "node:net";

/**
 * HTTPS requests to bank-sync providers only.
 *
 * A SimpleFIN setup token is a URL the user pastes in, so without checks the server could be made
 * to call any address, including internal services (SSRF). Every request therefore:
 * - goes over HTTPS with certificate verification, on port 443
 * - goes only to an allowlisted host name (BANK_SYNC_ALLOWED_HOSTS), never to an IP literal
 * - refuses hosts that resolve to private, loopback, link-local or reserved addresses; the check
 *   runs in the socket's own DNS lookup, so a second resolution cannot swap the address
 * - follows no redirects, times out and caps the response size
 */

export const DEFAULT_ALLOWED_HOSTS = ["beta-bridge.simplefin.org"];
const TIMEOUT_MS = 20_000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

export class SafeRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SafeRequestError";
  }
}

/**
 * Reads BANK_SYNC_ALLOWED_HOSTS and, in test stacks only, BANK_SYNC_ALLOW_PRIVATE_HOSTS (hosts that
 * may resolve to private addresses, such as a fake provider in Docker).
 */
export type BankSyncEnv = Record<string, string | undefined>;

const hostList = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);

export function allowedHosts(env: BankSyncEnv = process.env): string[] {
  const configured = hostList(env.BANK_SYNC_ALLOWED_HOSTS);
  return configured.length > 0 ? configured : DEFAULT_ALLOWED_HOSTS;
}

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

/** True for addresses a provider must never resolve to. */
export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return blocked.check(address, "ipv4");
  if (family === 6) {
    // IPv4-mapped (::ffff:a.b.c.d) is checked as the IPv4 address it stands for
    const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return blocked.check(mapped[1], "ipv4");
    return blocked.check(address, "ipv6");
  }
  return true;
}

/** Checks a provider URL and returns it parsed; throws a SafeRequestError otherwise. */
export function checkProviderUrl(raw: string, env: BankSyncEnv = process.env): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SafeRequestError("Invalid URL");
  }
  if (url.protocol !== "https:") throw new SafeRequestError("Only HTTPS is allowed");
  if (url.port !== "" && url.port !== "443") throw new SafeRequestError("Only port 443 is allowed");
  const host = url.hostname.toLowerCase();
  if (isIP(host.replace(/^\[|\]$/g, ""))) {
    throw new SafeRequestError("IP addresses are not allowed");
  }
  if (!allowedHosts(env).includes(host)) {
    throw new SafeRequestError(`Host ${host} is not an allowed bank-sync provider`);
  }
  return url;
}

export type SafeRequest = {
  method: "GET" | "POST";
  url: string;
  /** Sent as HTTP Basic auth; credentials inside the URL itself are refused. */
  auth?: { username: string; password: string };
};
export type SafeResponse = { status: number; contentType: string; body: string };
export type Transport = (req: SafeRequest) => Promise<SafeResponse>;

/** Performs one request under the rules above; every refusal is a rejected promise. */
export const safeRequest: Transport = async (req) => {
  const env = process.env;
  const url = checkProviderUrl(req.url, env);
  if (url.username || url.password) {
    throw new SafeRequestError("Credentials must not be part of the URL");
  }
  const privateAllowed = hostList(env.BANK_SYNC_ALLOW_PRIVATE_HOSTS).includes(url.hostname);

  return new Promise<SafeResponse>((resolve, reject) => {
    const fail = (message: string) => reject(new SafeRequestError(message));
    const httpsRequest = request(
      {
        method: req.method,
        hostname: url.hostname,
        port: 443,
        path: `${url.pathname}${url.search}`,
        headers: {
          accept: "application/json",
          "user-agent": "Cashlytics bank sync",
          ...(req.method === "POST" ? { "content-length": "0" } : {}),
          ...(req.auth
            ? {
                authorization: `Basic ${Buffer.from(`${req.auth.username}:${req.auth.password}`).toString("base64")}`,
              }
            : {}),
        },
        rejectUnauthorized: true,
        timeout: TIMEOUT_MS,
        lookup: (hostname, options, callback) => {
          dnsLookup(hostname, { all: true }, (error, addresses: LookupAddress[]) => {
            if (error) return callback(error, "", 4);
            const list = addresses ?? [];
            // Any blocked address refuses the host, so no address family can slip through
            if (
              list.length === 0 ||
              (!privateAllowed && list.some((a) => isBlockedAddress(a.address)))
            ) {
              return callback(
                new SafeRequestError(`Host ${hostname} resolves to a blocked address`),
                "",
                4
              );
            }
            if ((options as { all?: boolean }).all) {
              return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, list);
            }
            callback(null, list[0].address, list[0].family);
          });
        },
      },
      (res) => {
        let size = 0;
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_RESPONSE_BYTES) {
            res.destroy();
            fail("Response too large");
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            contentType: String(res.headers["content-type"] ?? ""),
            body: Buffer.concat(chunks).toString("utf8"),
          })
        );
        res.on("error", () => fail("Response failed"));
      }
    );
    const timer = setTimeout(() => {
      httpsRequest.destroy();
      fail("Request timed out");
    }, TIMEOUT_MS);
    httpsRequest.on("timeout", () =>
      httpsRequest.destroy(new SafeRequestError("Request timed out"))
    );
    httpsRequest.on("error", (error) =>
      // Only our own messages are passed on; system errors may contain the full URL
      fail(error instanceof SafeRequestError ? error.message : "Provider not reachable")
    );
    httpsRequest.on("close", () => clearTimeout(timer));
    httpsRequest.end();
  });
};
