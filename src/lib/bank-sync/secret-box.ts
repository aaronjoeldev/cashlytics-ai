import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Encryption of bank-sync secrets (SimpleFIN access URLs) at rest, with AES-256-GCM.
 *
 * The key comes from BANK_SYNC_ENCRYPTION_KEY (32 random bytes, base64) and never reaches the
 * database. A sealed value names the key it was sealed with, so the key can be rotated: put the
 * old key into BANK_SYNC_ENCRYPTION_KEYS_PREVIOUS (comma-separated), re-seal all values, then
 * remove it. The additional data binds a value to its owner and purpose, so a sealed value copied
 * into another user's row does not decrypt.
 *
 * Format: v1.<key id>.<iv>.<auth tag>.<ciphertext>, all base64url.
 */

const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

export class SecretBoxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretBoxError";
  }
}

type Key = { id: string; bytes: Buffer };

function parseKey(value: string, name: string): Key {
  const bytes = Buffer.from(value.trim(), "base64");
  if (bytes.length !== 32) {
    throw new SecretBoxError(`${name} must be 32 bytes, base64-encoded`);
  }
  // Public identifier of the key; reveals nothing about it
  const id = createHash("sha256").update(bytes).digest("base64url").slice(0, 8);
  return { id, bytes };
}

/** Reads BANK_SYNC_ENCRYPTION_KEY and BANK_SYNC_ENCRYPTION_KEYS_PREVIOUS. */
export type SecretBoxEnv = Record<string, string | undefined>;

function loadKeys(env: SecretBoxEnv): { current: Key; all: Key[] } {
  const raw = env.BANK_SYNC_ENCRYPTION_KEY;
  if (!raw || raw.trim() === "") {
    throw new SecretBoxError("BANK_SYNC_ENCRYPTION_KEY is not set");
  }
  const current = parseKey(raw, "BANK_SYNC_ENCRYPTION_KEY");
  const previous = (env.BANK_SYNC_ENCRYPTION_KEYS_PREVIOUS ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => parseKey(v, "BANK_SYNC_ENCRYPTION_KEYS_PREVIOUS"));
  return { current, all: [current, ...previous] };
}

/** True when a valid encryption key is configured; bank sync stays off otherwise. */
export function isSecretBoxConfigured(env: SecretBoxEnv = process.env): boolean {
  try {
    loadKeys(env);
    return true;
  } catch {
    return false;
  }
}

/** Encrypts `plaintext`; `context` (e.g. "simplefin:<userId>:<connectionId>") must match on open. */
export function seal(plaintext: string, context: string, env: SecretBoxEnv = process.env): string {
  const { current } = loadKeys(env);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", current.bytes, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(context, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [
    VERSION,
    current.id,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/** Decrypts a value from `seal`. Throws when the key is unknown, the context differs or the value was changed. */
export function open(sealed: string, context: string, env: SecretBoxEnv = process.env): string {
  const parts = sealed.split(".");
  if (parts.length !== 5 || parts[0] !== VERSION) {
    throw new SecretBoxError("Unknown secret format");
  }
  const [, keyId, iv, tag, ciphertext] = parts;
  const key = loadKeys(env).all.find((k) => k.id === keyId);
  if (!key) throw new SecretBoxError("Secret was sealed with an unknown key");
  try {
    // A fixed tag length refuses shortened tags, which would weaken the integrity check
    const decipher = createDecipheriv("aes-256-gcm", key.bytes, Buffer.from(iv, "base64url"), {
      authTagLength: TAG_BYTES,
    });
    decipher.setAAD(Buffer.from(context, "utf8"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // Never pass the cipher's message on: it is the same for every failure anyway
    throw new SecretBoxError("Secret could not be decrypted");
  }
}

/** True when `sealed` was sealed with an older key and should be re-sealed. */
export function needsReseal(sealed: string, env: SecretBoxEnv = process.env): boolean {
  return sealed.split(".")[1] !== loadKeys(env).current.id;
}
