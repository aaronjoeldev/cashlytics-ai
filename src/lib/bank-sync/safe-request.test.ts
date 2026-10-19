import assert from "node:assert/strict";
import test from "node:test";
import { allowedHosts, checkProviderUrl, isBlockedAddress, safeRequest } from "./safe-request";
import { redactSecrets } from "@/lib/logger";

const env = { BANK_SYNC_ALLOWED_HOSTS: "bridge.example, Beta-Bridge.SimpleFIN.org" };

test("only HTTPS URLs on port 443 of allowed host names pass", () => {
  assert.equal(
    checkProviderUrl("https://bridge.example/simplefin/claim/abc", env).hostname,
    "bridge.example"
  );
  assert.equal(
    checkProviderUrl("https://beta-bridge.simplefin.org/x", env).hostname,
    "beta-bridge.simplefin.org"
  );
  for (const url of [
    "http://bridge.example/claim",
    "https://bridge.example:8443/claim",
    "https://evil.example/claim",
    "https://bridge.example.evil.example/claim",
    "https://bridge.example./claim",
    "https://127.0.0.1/claim",
    "https://[::1]/claim",
    "file:///etc/passwd",
    "not a url",
  ]) {
    assert.throws(() => checkProviderUrl(url, env), Error, url);
  }
});

test("without configuration only the SimpleFIN Bridge is allowed", () => {
  assert.deepEqual(allowedHosts({}), ["beta-bridge.simplefin.org"]);
});

test("private, loopback, link-local and reserved addresses are blocked", () => {
  for (const address of [
    "127.0.0.1",
    "10.1.2.3",
    "172.20.0.5",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "::",
    "fe80::1",
    "fd00::1",
    "::ffff:127.0.0.1",
    "::ffff:169.254.169.254",
    "not-an-ip",
  ]) {
    assert.equal(isBlockedAddress(address), true, address);
  }
  for (const address of [
    "93.184.216.34",
    "2606:2800:220:1:248:1893:25c8:1946",
    "::ffff:93.184.216.34",
  ]) {
    assert.equal(isBlockedAddress(address), false, address);
  }
});

test("requests refuse credentials in the URL and hosts outside the allowlist", async () => {
  const before = process.env.BANK_SYNC_ALLOWED_HOSTS;
  process.env.BANK_SYNC_ALLOWED_HOSTS = "bridge.example";
  try {
    await assert.rejects(
      safeRequest({ method: "GET", url: "https://user:pw@bridge.example/accounts" }),
      /Credentials must not be part of the URL/
    );
    await assert.rejects(
      safeRequest({ method: "GET", url: "https://169.254.169.254/latest/meta-data" }),
      /IP addresses are not allowed/
    );
  } finally {
    if (before === undefined) delete process.env.BANK_SYNC_ALLOWED_HOSTS;
    else process.env.BANK_SYNC_ALLOWED_HOSTS = before;
  }
});

test("a host resolving to a loopback address is refused before connecting", async () => {
  const before = process.env.BANK_SYNC_ALLOWED_HOSTS;
  process.env.BANK_SYNC_ALLOWED_HOSTS = "localhost";
  try {
    await assert.rejects(
      safeRequest({ method: "GET", url: "https://localhost/accounts" }),
      /resolves to a blocked address/
    );
  } finally {
    if (before === undefined) delete process.env.BANK_SYNC_ALLOWED_HOSTS;
    else process.env.BANK_SYNC_ALLOWED_HOSTS = before;
  }
});

test("log lines never show credentials inside URLs", () => {
  assert.equal(
    redactSecrets("claim failed for https://user:s3cr3t@bridge.example/simplefin | cause=x"),
    "claim failed for https://***@bridge.example/simplefin | cause=x"
  );
  assert.equal(
    redactSecrets("https://bridge.example/simplefin"),
    "https://bridge.example/simplefin"
  );
});
