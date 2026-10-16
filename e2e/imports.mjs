// CSV import end to end with the fake AI (PR 3, 10, 11)
import { writeFileSync } from "node:fs";
import {
  B,
  TMP,
  bodyText,
  callAction,
  check,
  clickText,
  cookieHeader,
  demoUserId,
  fakeLog,
  fakeState,
  login,
  newPage,
  psql,
  sleep,
} from "./lib.mjs";

const deDate = (daysAgo) => {
  const day = new Date(Date.now() - daysAgo * 86400000);
  return `${String(day.getDate()).padStart(2, "0")}.${String(day.getMonth() + 1).padStart(2, "0")}.${day.getFullYear()}`;
};

// Bank export in Windows-1252 with CRLF: two identical rows, a quoted multi-line description and
// umlauts (latin1 and Windows-1252 agree on ä and ü)
const CP1252 = `${TMP}/bank-export-cp1252.csv`;
writeFileSync(
  CP1252,
  Buffer.from(
    [
      "Buchungsdatum;Betrag;Währung;Verwendungszweck",
      `${deDate(2)};-67,45;EUR;Rewe Wocheneinkauf`,
      `${deDate(2)};-67,45;EUR;Rewe Wocheneinkauf`,
      `${deDate(1)};-9,99;EUR;"Bäckerei\r\nMüller"`,
      `${deDate(1)};-5,00;EUR;Kiosk`,
      "",
    ].join("\r\n"),
    "latin1"
  )
);

export async function imports() {
  const userId = demoUserId();
  const { page, context } = await newPage();
  await login(page);
  const cookie = await cookieHeader(page);
  const text = () => bodyText(page);

  async function upload(file) {
    await page.goto(`${B}/import`, { waitUntil: "networkidle0" });
    // The page preselects the first account; other suites may have created accounts before
    const accountSelect = await page.$('main [role="combobox"]');
    if (!(await accountSelect.evaluate((e) => e.innerText)).includes("Hauptkonto")) {
      await accountSelect.click();
      await sleep(300);
      await clickText(page, '[role="option"]', "Hauptkonto");
      await sleep(300);
    }
    const input = await page.$('input[type="file"]');
    await input.uploadFile(file);
    await clickText(page, "button", "CSV hochladen");
    await page.waitForFunction(
      () => /Verarbeitung abgeschlossen|Verarbeitung unterbrochen/.test(document.body.innerText),
      { timeout: 60000 }
    );
    await sleep(600);
  }

  const expensesBefore = Number(psql("select count(*) from daily_expenses"));
  const rewe = psql(
    `select id from daily_expenses where user_id='${userId}' and description='Rewe Wocheneinkauf' and amount=67.45 order by date desc limit 1`
  );
  const reweBefore = psql(`select amount||'|'||description from daily_expenses where id='${rewe}'`);

  // 1. Windows-1252 file: decoded, staged, one exact conflict for two identical rows, AI ran
  await upload(CP1252);
  let t = await text();
  check(
    "Windows-1252 file is staged with all 4 rows",
    /Vorgemerkte Zeilen:\s*4/.test(t),
    t.match(/Vorgemerkte Zeilen:.*$/m)?.[0]
  );
  check("umlauts are decoded", t.includes("Bäckerei") && t.includes("Müller"));
  check(
    "two identical rows give one conflict",
    /Zeilen mit Konflikten:\s*1/.test(t),
    t.match(/Zeilen mit Konflikten:.*$/m)?.[0]
  );
  check(
    "AI check ran without errors",
    !/konnte \d+ Zeilen nicht prüfen/.test(t) && !t.includes("ist nicht gelaufen")
  );
  const aiCalls = (await fakeLog()).filter((l) =>
    JSON.stringify(l.body).includes("reconciliation engine")
  );
  check("reconciliation called the AI in a batch", aiCalls.length >= 1, aiCalls.length);

  await page.$$eval("div.justify-between.rounded-xl", (els) =>
    els
      .find((e) => e.innerText.includes("Kiosk"))
      ?.querySelector("button")
      ?.click()
  );
  await page
    .waitForFunction(() => /Vorgemerkte Zeilen:\s*3/.test(document.body.innerText), {
      timeout: 10000,
    })
    .catch(() => {});
  check("removed row disappears", /Vorgemerkte Zeilen:\s*3/.test(await text()));

  const combos = await page.$$('[role="combobox"]');
  await combos.at(-1).click();
  await sleep(300);
  await clickText(page, '[role="option"]', "Importierte Zeile ueberspringen");
  await sleep(300);
  await clickText(page, "button", "Bestaetigen und importieren");
  await page
    .waitForFunction(
      () => document.body.innerText.includes("Import wurde erfolgreich abgeschlossen"),
      { timeout: 20000 }
    )
    .catch(() => {});
  const added = Number(psql("select count(*) from daily_expenses")) - expensesBefore;
  check("confirm imports 2 rows (duplicate skipped, Kiosk removed)", added === 2, `added=${added}`);
  check(
    "multi-line description is stored",
    psql("select count(*) from daily_expenses where description like 'Bäckerei%Müller'") === "1"
  );
  check(
    "existing Rewe entry is untouched",
    psql(`select amount||'|'||description from daily_expenses where id='${rewe}'`) === reweBefore
  );

  // 2. Same file again: earlier import reported, all rows have counterparts
  await upload(CP1252);
  t = await text();
  check("re-upload shows the earlier import", /schon in dieses Konto importiert/.test(t));
  check(
    "re-upload finds 3 duplicates",
    /Zeilen mit Konflikten:\s*3/.test(t),
    t.match(/Zeilen mit Konflikten:.*$/m)?.[0]
  );

  // 3. AI near match: similar description, same amount, other day
  const iso = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  const de = deDate(2);
  psql(
    `insert into daily_expenses (user_id, account_id, description, amount, date, currency) values ('${userId}', 'a0000000-0000-0000-0000-000000000001', 'Edeka Center Süd', 23.10, '${iso}', 'EUR')`
  );
  const near = `${TMP}/near.csv`;
  writeFileSync(
    near,
    `Buchungsdatum;Betrag;Verwendungszweck\n${de};-23,10;EDEKA MARKT 4711 KARTE\n${de};-3,20;Bäcker Brot\n`
  );
  await upload(near);
  t = await text();
  check(
    "file without currency column takes the account currency",
    /Vorgemerkte Zeilen:\s*2/.test(t),
    t.match(/Vorgemerkte Zeilen:.*$/m)?.[0]
  );
  check(
    "AI finds the similar existing entry as a conflict",
    /Zeilen mit Konflikten:\s*1/.test(t) && t.includes("Edeka Center Süd"),
    t.match(/Zeilen mit Konflikten:.*$/m)?.[0]
  );

  // 4. AI failure is reported, not shown as success
  await fakeState({ reconcileFail: true });
  await upload(near);
  t = await text();
  check(
    "failed AI check is reported with the row count",
    /KI-Abgleich konnte \d+ Zeilen nicht prüfen/.test(t),
    t.match(/KI-Abgleich.*$/m)?.[0]
  );
  await fakeState({ reconcileFail: false });

  // 5. Failed reconciliation blocks confirmation until it ran
  psql(
    "create or replace function fail_conflicts() returns trigger as $$ begin raise exception 'boom'; end $$ language plpgsql"
  );
  psql(
    "create trigger fail_conflicts before insert on import_conflicts for each row execute function fail_conflicts()"
  );
  await upload(CP1252);
  t = await text();
  check(
    "failed reconciliation shows the interrupted state",
    /Verarbeitung unterbrochen/.test(t) &&
      t.includes("Abgleich mit deinen bestehenden Einträgen ist nicht gelaufen")
  );
  const disabled = await page.$$eval(
    "button",
    (els) => els.find((e) => e.innerText.includes("Bestaetigen und importieren"))?.disabled
  );
  check("confirm button is disabled", disabled === true);
  const session = psql("select id from import_sessions order by created_at desc limit 1");
  const direct = await callAction(cookie, "confirmImportSession", [session, []], "/import");
  check(
    "server refuses to confirm an unchecked session",
    direct.success === false,
    JSON.stringify(direct).slice(0, 160)
  );
  psql("drop trigger fail_conflicts on import_conflicts");
  await clickText(page, "button", "Moegliche Duplikate finden");
  await page
    .waitForFunction(() => /Verarbeitung abgeschlossen/.test(document.body.innerText), {
      timeout: 60000,
    })
    .catch(() => {});
  await sleep(600);
  check(
    "retry runs the check",
    !(await text()).includes("ist nicht gelaufen") &&
      /Zeilen mit Konflikten:\s*3/.test(await text())
  );

  await context.close();
}
