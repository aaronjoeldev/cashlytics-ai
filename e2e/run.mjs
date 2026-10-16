// Runs the e2e suites against the Docker stack.  node run.mjs [suite ...]
import { execFileSync } from "node:child_process";
import {
  REPO,
  browser,
  clearMails,
  consoleErrors,
  check,
  fakeReset,
  psql,
  psqlFile,
  run,
  sleep,
  summary,
} from "./lib.mjs";

const all = [
  "infra",
  "auth",
  "isolation",
  "forms",
  "currency",
  "rates",
  "insights",
  "imports",
  "assistant",
  "scan",
  "ui",
  "offline",
];
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : all;

// Fresh state: demo data and known exchange rates (1 EUR = 1.25 USD, marked fresh), then a
// restart so the app's in-memory rate copy and rate limits start empty
psqlFile(`${REPO}/scripts/seed-demo.sql`);
psql(`insert into exchange_rates (base_currency, target_currency, rate, fetched_at)
      select 'EUR', c, case c when 'USD' then 1.25 when 'GBP' then 0.8 else r end, now()
      from (values ('USD',1.08),('JPY',163.5),('GBP',0.86),('CNY',7.82),('CHF',0.94),('AUD',1.65),('CAD',1.47),('HKD',8.42),('SGD',1.46),('KRW',1460),('MXN',18.4),('INR',90.1),('NZD',1.79),('SEK',11.5),('NOK',11.7),('PLN',4.31),('TRY',35.2),('ZAR',20.6),('BRL',6.18),('DKK',7.46)) v(c, r)
      on conflict (base_currency, target_currency) do update set rate = excluded.rate, fetched_at = excluded.fetched_at`);
execFileSync("docker", ["restart", "cashlytics-e2e-app-1"], { stdio: "ignore" });
for (let i = 0; i < 90; i++) {
  try {
    const health = execFileSync("docker", [
      "inspect",
      "-f",
      "{{.State.Health.Status}}",
      "cashlytics-e2e-app-1",
    ])
      .toString()
      .trim();
    if (health === "healthy") break;
  } catch {}
  await sleep(1000);
}
await clearMails();
await fakeReset();

for (const name of wanted) {
  const mod = await import(`./${name}.mjs`);
  await run(name, mod[name]);
}

if (wanted.length === all.length) {
  const unexpected = consoleErrors.filter(
    (e) =>
      !/Failed to load resource|favicon|status of 4\d\d|ERR_INTERNET_DISCONNECTED|net::ERR|errors\.authjs\.dev#autherror|Push API in incognito/i.test(
        e.text
      )
  );
  const { writeFileSync } = await import("node:fs");
  writeFileSync(
    new URL("./console-errors.json", import.meta.url),
    JSON.stringify(consoleErrors, null, 1)
  );
  check(
    "no unexpected console errors in the whole run",
    unexpected.length === 0,
    unexpected
      .slice(0, 4)
      .map((e) => `${e.url}: ${e.text}`)
      .join(" || ")
  );
}
await browser.close();
process.exit(summary() ? 1 : 0);
