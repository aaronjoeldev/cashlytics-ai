import assert from "node:assert/strict";
import test from "node:test";
import type { SafeRequest, SafeResponse, Transport } from "./safe-request";
import {
  claimSetupToken,
  cleanText,
  decodeSetupToken,
  fetchAccounts,
  parseAccessUrl,
  SimpleFinError,
} from "./simplefin";

const env = { BANK_SYNC_ALLOWED_HOSTS: "bridge.example" };
const token = (url: string) => Buffer.from(url).toString("base64");
const ACCESS = { baseUrl: "https://bridge.example/simplefin", username: "u", password: "p" };
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Transport that records requests and answers with fixed responses. */
function fake(...responses: Array<Partial<SafeResponse>>): Transport & { calls: SafeRequest[] } {
  const calls: SafeRequest[] = [];
  const transport = (async (req: SafeRequest) => {
    calls.push(req);
    const res = responses.shift() ?? {};
    return { status: 200, contentType: "application/json", body: "", ...res };
  }) as Transport & { calls: SafeRequest[] };
  transport.calls = calls;
  return transport;
}

test("a setup token decodes to its claim URL at an allowed provider", () => {
  const url = decodeSetupToken(token("https://bridge.example/simplefin/claim/abc"), env);
  assert.equal(url.pathname, "/simplefin/claim/abc");
});

test("tokens for other hosts, internal addresses or plain HTTP are refused", () => {
  for (const url of [
    "https://evil.example/claim/abc",
    "https://169.254.169.254/latest/meta-data",
    "http://bridge.example/claim/abc",
  ]) {
    assert.throws(() => decodeSetupToken(token(url), env), SimpleFinError, url);
  }
  assert.throws(() => decodeSetupToken("not a token!", env), /not a SimpleFIN setup token/);
  assert.throws(() => decodeSetupToken("", env), SimpleFinError);
  assert.throws(
    () => decodeSetupToken(token("https://evil.example/claim"), env),
    /not allowed on this server/
  );
});

test("claiming posts to the claim URL and splits the access URL", async () => {
  const transport = fake({ body: "https://user%40x:pa%3Ass@bridge.example/simplefin\n" });
  const access = await claimSetupToken(token("https://bridge.example/simplefin/claim/abc"), {
    transport,
    env,
  });
  assert.deepEqual(access, {
    baseUrl: "https://bridge.example/simplefin",
    username: "user@x",
    password: "pa:ss",
  });
  assert.equal(transport.calls[0].method, "POST");
  assert.equal(transport.calls[0].url, "https://bridge.example/simplefin/claim/abc");
});

test("a used token warns that it may be compromised", async () => {
  await assert.rejects(
    claimSetupToken(token("https://bridge.example/claim/abc"), {
      transport: fake({ status: 403 }),
      env,
    }),
    (e: SimpleFinError) => e.code === "token_used" && /disable it/.test(e.message)
  );
});

test("an access URL for another host or without credentials is refused", () => {
  assert.throws(() => parseAccessUrl("https://u:p@evil.example/simplefin", env), SimpleFinError);
  assert.throws(() => parseAccessUrl("https://bridge.example/simplefin", env), SimpleFinError);
  assert.throws(() => parseAccessUrl("http://u:p@bridge.example/simplefin", env), SimpleFinError);
  assert.throws(() => parseAccessUrl("https://u:%E0%A4%A@bridge.example/x", env), SimpleFinError);
});

const accountSet = {
  errlist: [{ code: "con.auth", msg: "Please re-authenticate‮ at your bank\u0007" }],
  accounts: [
    {
      id: "acc-1",
      name: "Girokonto\n",
      currency: "EUR",
      balance: "1234.56",
      "available-balance": "1200.00",
      "balance-date": 1760000000,
      org: { name: "Sparkasse" },
      transactions: [
        { id: "t1", posted: 1759900000, amount: "-42.10", description: "REWE  SAGT DANKE" },
        { id: "t2", posted: 0, amount: "-5.00", description: "Pending", pending: true },
      ],
      extra: { iban: "DE00 not stored" },
    },
    {
      id: "points",
      name: "Rewards",
      currency: "https://bank.example/points",
      balance: "10",
      "balance-date": 1,
    },
  ],
};

test("accounts are fetched with credentials as Basic auth and normalized", async () => {
  const transport = fake({ body: JSON.stringify(accountSet) });
  const result = await fetchAccounts(
    ACCESS,
    { start: d("2026-09-01"), end: d("2026-10-01"), accountIds: ["acc-1"] },
    { transport }
  );
  const req = transport.calls[0];
  assert.deepEqual(req.auth, { username: "u", password: "p" });
  assert.ok(!req.url.includes("@"));
  const url = new URL(req.url);
  assert.equal(url.pathname, "/simplefin/accounts");
  assert.equal(url.searchParams.get("start-date"), String(Date.UTC(2026, 8, 1) / 1000));
  assert.deepEqual(url.searchParams.getAll("account"), ["acc-1"]);

  assert.deepEqual(result.messages, ["Please re-authenticate at your bank"]);
  assert.equal(result.accounts.length, 1, "custom currencies are skipped");
  const [account] = result.accounts;
  assert.equal(account.name, "Girokonto");
  assert.equal(account.institution, "Sparkasse");
  assert.equal(account.balance, "1234.56");
  assert.equal(account.balanceDate.getTime(), 1760000000 * 1000);
  assert.ok(!("extra" in account), "provider extras are not kept");
  assert.deepEqual(account.transactions[0], {
    externalId: "t1",
    postedAt: new Date(1759900000 * 1000),
    amount: "-42.10",
    description: "REWE SAGT DANKE",
    pending: false,
  });
  assert.equal(account.transactions[1].pending, true);
  assert.equal(account.transactions[1].postedAt, null);
});

test("ranges longer than 90 days or reversed are refused before any request", async () => {
  const transport = fake();
  await assert.rejects(
    fetchAccounts(ACCESS, { start: d("2026-01-01"), end: d("2026-05-01") }, { transport }),
    RangeError
  );
  await assert.rejects(
    fetchAccounts(ACCESS, { start: d("2026-05-01"), end: d("2026-01-01") }, { transport }),
    RangeError
  );
  assert.equal(transport.calls.length, 0);
});

test("revoked access, payment required and malformed answers have their own codes", async () => {
  const range = { start: d("2026-09-01"), end: d("2026-10-01") };
  const code = async (res: Partial<SafeResponse>) => {
    try {
      await fetchAccounts(ACCESS, range, { transport: fake(res) });
      return "none";
    } catch (e) {
      return (e as SimpleFinError).code;
    }
  };
  assert.equal(await code({ status: 403 }), "access_revoked");
  assert.equal(await code({ status: 402 }), "payment_required");
  assert.equal(await code({ status: 500 }), "provider_error");
  assert.equal(await code({ body: "<html>" }), "invalid_response");
  assert.equal(
    await code({ body: JSON.stringify({ accounts: [{ id: "x" }] }) }),
    "invalid_response"
  );
  assert.equal(
    await code({
      body: JSON.stringify({
        accounts: [{ ...accountSet.accounts[0], balance: "1e9" }],
      }),
    }),
    "invalid_response"
  );
});

test("provider text loses control characters and direction overrides", () => {
  assert.equal(cleanText("a\u0000b‮c⁦d\n\te", 100), "a b c d e");
  assert.equal(cleanText("x".repeat(50), 10), "x".repeat(10));
});
