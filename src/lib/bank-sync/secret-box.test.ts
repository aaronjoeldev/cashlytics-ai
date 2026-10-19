import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { isSecretBoxConfigured, needsReseal, open, seal, SecretBoxError } from "./secret-box";

const key = () => randomBytes(32).toString("base64");
const ACCESS = "https://user:secret-password@bridge.example/simplefin";

test("a sealed secret opens with the same key and context", () => {
  const env = { BANK_SYNC_ENCRYPTION_KEY: key() };
  const sealed = seal(ACCESS, "simplefin:u1:c1", env);
  assert.ok(!sealed.includes("secret-password"));
  assert.equal(open(sealed, "simplefin:u1:c1", env), ACCESS);
});

test("sealing twice gives different values", () => {
  const env = { BANK_SYNC_ENCRYPTION_KEY: key() };
  assert.notEqual(seal(ACCESS, "c", env), seal(ACCESS, "c", env));
});

test("another context, key or a changed value does not open", () => {
  const env = { BANK_SYNC_ENCRYPTION_KEY: key() };
  const sealed = seal(ACCESS, "simplefin:u1:c1", env);
  // copied into another user's row
  assert.throws(() => open(sealed, "simplefin:u2:c1", env), SecretBoxError);
  assert.throws(
    () => open(sealed, "simplefin:u1:c1", { BANK_SYNC_ENCRYPTION_KEY: key() }),
    /unknown key/
  );
  const parts = sealed.split(".");
  const flipped = Buffer.from(parts[4], "base64url");
  flipped[0] ^= 1;
  parts[4] = flipped.toString("base64url");
  assert.throws(() => open(parts.join("."), "simplefin:u1:c1", env), /could not be decrypted/);
  // a shortened authentication tag is refused
  const short = sealed.split(".");
  short[3] = Buffer.from(short[3], "base64url").subarray(0, 4).toString("base64url");
  assert.throws(() => open(short.join("."), "simplefin:u1:c1", env), SecretBoxError);
  assert.throws(() => open("plain text", "c", env), /Unknown secret format/);
});

test("rotation: values of the previous key still open and are marked for re-sealing", () => {
  const oldKey = key();
  const sealed = seal(ACCESS, "c", { BANK_SYNC_ENCRYPTION_KEY: oldKey });
  const rotated = { BANK_SYNC_ENCRYPTION_KEY: key(), BANK_SYNC_ENCRYPTION_KEYS_PREVIOUS: oldKey };
  assert.equal(open(sealed, "c", rotated), ACCESS);
  assert.equal(needsReseal(sealed, rotated), true);
  assert.equal(needsReseal(seal(ACCESS, "c", rotated), rotated), false);
});

test("a missing or malformed key turns bank sync off", () => {
  assert.equal(isSecretBoxConfigured({}), false);
  assert.equal(isSecretBoxConfigured({ BANK_SYNC_ENCRYPTION_KEY: "too-short" }), false);
  assert.equal(isSecretBoxConfigured({ BANK_SYNC_ENCRYPTION_KEY: key() }), true);
  assert.throws(() => seal(ACCESS, "c", {}), /not set/);
});
