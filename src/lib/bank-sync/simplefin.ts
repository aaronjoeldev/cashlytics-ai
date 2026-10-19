import { z } from "zod";
import { checkProviderUrl, safeRequest, type BankSyncEnv, type Transport } from "./safe-request";
import type { BankAccountSnapshot, BankFetchResult } from "./types";

/**
 * Client for the SimpleFIN protocol (https://www.simplefin.org/protocol.html).
 *
 * Flow: the user creates a setup token at the provider and pastes it in. The token is a base64
 * claim URL; claiming it once returns the access URL, which carries Basic-auth credentials and
 * unlocks the user's bank data. The access URL is a secret: store it only sealed (secret-box)
 * and never return, log or show it.
 */

/** Longest span the providers serve per request */
export const MAX_RANGE_DAYS = 90;

export type SimpleFinErrorCode =
  | "invalid_token"
  | "token_used"
  | "access_revoked"
  | "payment_required"
  | "invalid_response"
  | "provider_error";

export class SimpleFinError extends Error {
  constructor(
    public readonly code: SimpleFinErrorCode,
    message: string
  ) {
    super(message);
    this.name = "SimpleFinError";
  }
}

/** Access to one SimpleFIN connection; `password` is the secret part. */
export type SimpleFinAccess = { baseUrl: string; username: string; password: string };

// --- Sanitizing ----------------------------------------------------------------

// Control characters and bidirectional overrides, which can disguise text in the UI
const UNSAFE_CHARS = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/g;

/** Provider text made safe to store and show: no control characters, single spaces, capped length. */
export function cleanText(value: string, max: number): string {
  return value.replace(UNSAFE_CHARS, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

// --- Setup token and claim -----------------------------------------------------

/** Decodes a setup token to its claim URL and checks that it points to an allowed provider. */
export function decodeSetupToken(token: string, env: BankSyncEnv = process.env): URL {
  const trimmed = token.trim();
  if (trimmed === "" || trimmed.length > 2048 || !/^[A-Za-z0-9+/=_-]+$/.test(trimmed)) {
    throw new SimpleFinError("invalid_token", "This is not a SimpleFIN setup token.");
  }
  const decoded = Buffer.from(trimmed, "base64").toString("utf8");
  try {
    return checkProviderUrl(decoded, env);
  } catch (error) {
    throw new SimpleFinError(
      "invalid_token",
      error instanceof Error && /not an allowed/.test(error.message)
        ? "The token belongs to a provider that is not allowed on this server."
        : "This is not a SimpleFIN setup token."
    );
  }
}

/** Splits an access URL into base URL and credentials, checking the provider again. */
export function parseAccessUrl(raw: string, env: BankSyncEnv = process.env): SimpleFinAccess {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new SimpleFinError("invalid_response", "The provider returned no valid access.");
  }
  let username = "";
  let password = "";
  try {
    username = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
  } catch {
    // malformed percent-encoding: handled as missing credentials below
  }
  if (!username || !password) {
    throw new SimpleFinError("invalid_response", "The provider returned no valid access.");
  }
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  try {
    checkProviderUrl(url.toString(), env);
  } catch {
    throw new SimpleFinError("invalid_response", "The provider returned no valid access.");
  }
  return { baseUrl: url.toString().replace(/\/$/, ""), username, password };
}

/** Claims a setup token once and returns the access. */
export async function claimSetupToken(
  token: string,
  { transport = safeRequest, env = process.env }: { transport?: Transport; env?: BankSyncEnv } = {}
): Promise<SimpleFinAccess> {
  const claimUrl = decodeSetupToken(token, env);
  const res = await transport({ method: "POST", url: claimUrl.toString() });
  if (res.status === 403) {
    // The protocol asks apps to warn: someone else may have claimed the token
    throw new SimpleFinError(
      "token_used",
      "The token was already used or does not exist. If you did not use it yourself, disable it at your provider."
    );
  }
  if (res.status !== 200) {
    throw new SimpleFinError("provider_error", `The provider answered with status ${res.status}.`);
  }
  return parseAccessUrl(res.body, env);
}

// --- Accounts ------------------------------------------------------------------

const decimalString = z.string().regex(/^-?\d+(\.\d+)?$/);
const timestamp = z.number().int().nonnegative();

const transactionSchema = z.object({
  id: z.string().min(1).max(256),
  posted: timestamp,
  amount: decimalString,
  description: z.string().max(4096).default(""),
  pending: z.boolean().optional(),
});

const accountSchema = z.object({
  id: z.string().min(1).max(256),
  name: z.string().max(1024),
  // ISO code, or a URL for custom currencies such as reward points
  currency: z.string().max(2048),
  balance: decimalString,
  "available-balance": decimalString.optional(),
  "balance-date": timestamp,
  org: z.object({ name: z.string().max(1024).optional() }).optional(),
  transactions: z.array(transactionSchema).max(50_000).optional(),
});

const accountSetSchema = z.object({
  errors: z.array(z.string().max(4096)).max(100).optional(),
  errlist: z
    .array(z.object({ code: z.string().max(64).optional(), msg: z.string().max(4096).optional() }))
    .max(100)
    .optional(),
  accounts: z.array(accountSchema).max(500),
});

const fromUnix = (seconds: number) => new Date(seconds * 1000);
const toUnix = (date: Date) => Math.floor(date.getTime() / 1000);

export type FetchAccountsOptions = {
  start: Date;
  end: Date;
  /** Only these accounts (the provider's ids) */
  accountIds?: string[];
  balancesOnly?: boolean;
};

/** Fetches accounts and booked transactions of one connection within at most 90 days. */
export async function fetchAccounts(
  access: SimpleFinAccess,
  options: FetchAccountsOptions,
  { transport = safeRequest }: { transport?: Transport } = {}
): Promise<BankFetchResult> {
  const span = options.end.getTime() - options.start.getTime();
  if (!(span > 0) || span > MAX_RANGE_DAYS * 24 * 60 * 60 * 1000) {
    throw new RangeError(`The range must be positive and at most ${MAX_RANGE_DAYS} days`);
  }
  const url = new URL(`${access.baseUrl}/accounts`);
  url.searchParams.set("start-date", String(toUnix(options.start)));
  url.searchParams.set("end-date", String(toUnix(options.end)));
  if (options.balancesOnly) url.searchParams.set("balances-only", "1");
  for (const id of options.accountIds ?? []) url.searchParams.append("account", id);

  const res = await transport({
    method: "GET",
    url: url.toString(),
    auth: { username: access.username, password: access.password },
  });
  if (res.status === 403) {
    throw new SimpleFinError(
      "access_revoked",
      "The provider refused access. The connection was revoked or has expired."
    );
  }
  if (res.status === 402) {
    throw new SimpleFinError(
      "payment_required",
      "The provider requires payment for this connection."
    );
  }
  if (res.status !== 200) {
    throw new SimpleFinError("provider_error", `The provider answered with status ${res.status}.`);
  }

  let json: unknown;
  try {
    json = JSON.parse(res.body);
  } catch {
    throw new SimpleFinError("invalid_response", "The provider returned an unreadable answer.");
  }
  const parsed = accountSetSchema.safeParse(json);
  if (!parsed.success) {
    throw new SimpleFinError("invalid_response", "The provider returned an unexpected answer.");
  }

  const messages = [
    ...(parsed.data.errlist ?? []).map((e) => e.msg ?? e.code ?? ""),
    ...(parsed.data.errors ?? []),
  ]
    .map((m) => cleanText(m, 300))
    .filter(Boolean);

  const accounts: BankAccountSnapshot[] = parsed.data.accounts
    // Custom currencies would need a request to a URL chosen by the provider; they are skipped
    .filter((a) => /^[A-Z]{3}$/.test(a.currency))
    .map((a) => ({
      externalId: a.id,
      name: cleanText(a.name, 200) || a.id.slice(0, 40),
      institution: a.org?.name ? cleanText(a.org.name, 200) : null,
      currency: a.currency,
      balance: a.balance,
      availableBalance: a["available-balance"] ?? null,
      balanceDate: fromUnix(a["balance-date"]),
      transactions: (a.transactions ?? []).map((t) => ({
        externalId: t.id,
        postedAt: t.posted > 0 ? fromUnix(t.posted) : null,
        amount: t.amount,
        description: cleanText(t.description, 500),
        pending: t.pending === true || t.posted === 0,
      })),
    }));

  return { accounts, messages };
}
