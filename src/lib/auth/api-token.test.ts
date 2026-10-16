import { test } from "node:test";
import assert from "node:assert/strict";
import { generateApiToken, parseBearerToken } from "./api-token";
import { hashToken } from "./reset-token";

test("generateApiToken returns a prefixed 256-bit token with its hash", () => {
  const token = generateApiToken();
  assert.match(token.raw, /^csk_[0-9a-f]{64}$/);
  assert.equal(token.hash, hashToken(token.raw));
  assert.equal(token.prefix, token.raw.slice(0, 12));
  assert.notEqual(generateApiToken().raw, token.raw);
});

test("parseBearerToken accepts a well-formed bearer header", () => {
  const { raw } = generateApiToken();
  assert.equal(parseBearerToken(`Bearer ${raw}`), raw);
  assert.equal(parseBearerToken(`bearer ${raw}`), raw);
});

test("parseBearerToken rejects missing and malformed tokens", () => {
  assert.equal(parseBearerToken(null), null);
  assert.equal(parseBearerToken(""), null);
  assert.equal(parseBearerToken("Bearer"), null);
  assert.equal(parseBearerToken(`Basic csk_${"a".repeat(64)}`), null);
  assert.equal(parseBearerToken(`Bearer csk_${"a".repeat(63)}`), null);
  assert.equal(parseBearerToken(`Bearer csk_${"A".repeat(64)}`), null);
  assert.equal(parseBearerToken(`Bearer ${"a".repeat(64)}`), null);
});
