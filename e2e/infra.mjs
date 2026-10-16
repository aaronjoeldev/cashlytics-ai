// Docker setup, migrations, cron and unauthenticated API behaviour (PR 1, 3, 4, 5, 9, 12, 14)
import { readdirSync } from "node:fs";
import { B, REPO, check, docker, psql } from "./lib.mjs";

export async function infra() {
  const ps = docker(
    "compose",
    "-p",
    "cashlytics-e2e",
    "ps",
    "--format",
    "{{.Service}} {{.State}} {{.Health}}"
  );
  for (const service of ["app", "postgres", "mailpit", "fake-openai", "cashlytics-cron"]) {
    check(`container ${service} is running`, new RegExp(`^${service} running`, "m").test(ps), ps);
  }
  check("app container is healthy", /^app running healthy/m.test(ps), ps);

  const appLog = docker("logs", "cashlytics-e2e-app-1");
  check(
    "entrypoint ran the migrations before starting",
    appLog.includes("Migrations completed successfully."),
    appLog.slice(0, 300)
  );
  const files = readdirSync(`${REPO}/drizzle`).filter((f) => f.endsWith(".sql")).length;
  const applied = Number(psql("select count(*) from drizzle.__drizzle_migrations"));
  check(`all ${files} migrations are applied`, applied === files, `${applied} applied`);

  const indexes = psql(
    "select string_agg(indexname, ',') from pg_indexes where schemaname='public'"
  );
  check(
    "unique case-insensitive e-mail index exists (0020)",
    indexes.includes("users_email_lower_unique")
  );
  check(
    "user/date index on daily expenses exists (0016)",
    indexes.includes("daily_expenses_user_id_date_idx")
  );
  check(
    "insights dedup constraint exists (0017)",
    psql("select count(*) from pg_constraint where conname='insights_user_id_dedup_key_unique'") ===
      "1"
  );
  check(
    "import_sessions.reconciled_at exists (0019)",
    psql(
      "select count(*) from information_schema.columns where table_name='import_sessions' and column_name='reconciled_at'"
    ) === "1"
  );
  check(
    "category foreign keys are ON DELETE SET NULL (0016)",
    psql(
      "select count(*) from pg_constraint where conname like '%category_id%' and confdeltype='n' and conrelid::regclass::text in ('expenses','daily_expenses')"
    ) === "2"
  );

  const crontab = docker("exec", "cashlytics-e2e-cashlytics-cron-1", "crontab", "-l");
  check(
    "cron container schedules reminders and insights",
    crontab.includes("/api/cron/upcoming-payments") && crontab.includes("/api/cron/insights"),
    crontab
  );
  const cronReach = docker(
    "exec",
    "cashlytics-e2e-cashlytics-cron-1",
    "sh",
    "-c",
    "curl -s -o /dev/null -w '%{http_code}' http://app:3000/api/cron/insights"
  );
  check("cron container reaches the app (401 without token)", cronReach === "401", cronReach);

  const status = async (path, init) =>
    (await fetch(`${B}${path}`, { redirect: "manual", ...init })).status;
  check(
    "cron insights rejects a wrong token",
    (await status("/api/cron/insights", { headers: { Authorization: "Bearer wrong" } })) === 401
  );
  check(
    "cron reminders rejects a missing token",
    (await status("/api/cron/upcoming-payments")) === 401
  );
  const docStatus = await status("/api/documents/00000000-0000-0000-0000-000000000000");
  check("document download requires a session", [401, 307, 302].includes(docStatus), docStatus);
  const assetLike = await status("/api/documents/foo.png");
  check("API path with an asset extension does not bypass the proxy", assetLike !== 200, assetLike);
  const chat = await status("/api/chat", {
    method: "POST",
    body: "{}",
    headers: { "content-type": "application/json" },
  });
  check("chat route requires a session", [401, 307, 302].includes(chat), chat);
  const dashboard = await status("/dashboard");
  check("dashboard redirects signed-out visitors", [307, 302].includes(dashboard), dashboard);
  check("service worker is reachable signed out", (await status("/sw.js")) === 200);
  check("offline page is reachable signed out", [200].includes(await status("/~offline")));
}
