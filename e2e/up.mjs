// Builds the image from this checkout and starts the e2e stack.  node e2e/up.mjs
// The secrets are generated once and kept in e2e/.env (ignored by git).
import { execFileSync } from "node:child_process";
import { createECDH, randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(dir, ".env");

if (!existsSync(envFile)) {
  // A VAPID key pair is a P-256 key pair in base64url, the same as `web-push generate-vapid-keys`
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  writeFileSync(
    envFile,
    [
      `AUTH_SECRET=${randomBytes(32).toString("base64")}`,
      `CRON_SECRET=${randomBytes(32).toString("hex")}`,
      `VAPID_PUBLIC_KEY=${ecdh.getPublicKey("base64url")}`,
      `VAPID_PRIVATE_KEY=${ecdh.getPrivateKey("base64url")}`,
      "VAPID_SUBJECT=mailto:e2e@cashlytics.test",
      "",
    ].join("\n")
  );
}

execFileSync(
  "docker",
  ["compose", "-f", path.join(dir, "docker-compose.yml"), "up", "-d", "--build", "--wait"],
  {
    stdio: "inherit",
  }
);
