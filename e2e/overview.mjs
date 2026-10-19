// Overview account filter: every section follows the chosen account, the choice is in the URL
import { ERIKA } from "./auth.mjs";
import {
  bodyText,
  callAction,
  check,
  cookieHeader,
  demoUserId,
  goto,
  login,
  newPage,
  psql,
  selectOption,
  sleep,
} from "./lib.mjs";

const SAVINGS = "a0000000-0000-0000-0000-000000000002"; // "Notgroschen"
const MAIN = "a0000000-0000-0000-0000-000000000001"; // "Hauptkonto"
const HEALTH = "c0000000-0000-0000-0000-000000000005"; // "Gesundheit"
// Renamed from "Projizierte Bilanz:" in the terminology change
const FORECAST_LABEL = /Projizierte Bilanz:|Bilanz der 3 Monate:/;

const euro = (text, label) => {
  const m = (text.split(label)[1] ?? "").match(/(-?[\d.]+,\d{2})\s?€/);
  return m ? Number(m[1].replace(/\./g, "").replace(",", ".")) : NaN;
};
const de = (n) => n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Currency amounts use a no-break space before the symbol
const mainText = async (page) =>
  (await page.$eval("main", (m) => m.innerText)).replace(/[  ]/g, " ");
const near = (a, b) => Math.abs(a - b) < 0.006;

export async function overview() {
  const userId = demoUserId();
  // A daily expense on the savings account, so that account has its own expense and category
  psql(`insert into daily_expenses (user_id, account_id, category_id, description, amount, date)
        values ('${userId}', '${SAVINGS}', '${HEALTH}', 'Schlüsseldienst', 123.45, date_trunc('day', now()))`);

  const { page, context } = await newPage();
  await login(page);
  const cookie = await cookieHeader(page);
  const now = new Date();
  const [month, year] = [now.getMonth() + 1, now.getFullYear()];

  // 1. All accounts
  await goto(page, "/overview");
  let text = await mainText(page);
  const allForecast = euro(text, FORECAST_LABEL);
  check(
    "unfiltered overview shows the main account's entries",
    text.includes("Miete") && text.includes("Lebensmittel")
  );

  // 2. Choose the savings account in the filter
  check(
    "filter offers the savings account",
    await selectOption(page, "main", "Alle Konten", "Notgroschen")
  );
  await page
    .waitForFunction((id) => location.search === `?account=${id}`, { timeout: 15000 }, SAVINGS)
    .catch(() => {});
  await page.waitForNetworkIdle({ idleTime: 500 }).catch(() => {});
  await sleep(500);
  check(
    "the chosen account is in the URL",
    page.url().endsWith(`/overview?account=${SAVINGS}`),
    page.url()
  );
  text = await mainText(page);

  const monthly = await callAction(
    cookie,
    "getMonthlyOverview",
    [month, year, SAVINGS],
    "/overview"
  );
  check(
    "income card shows only the savings account",
    monthly.success && text.includes(`${de(monthly.data.totalIncome)} €`),
    `${monthly.data?.totalIncome}`
  );
  check(
    "expenses card shows only the savings account",
    monthly.success && near(monthly.data.totalExpenses, 123.45) && text.includes("123,45 €"),
    `${monthly.data?.totalExpenses}`
  );
  check(
    "category breakdown shows only the savings account's category",
    text.includes("Gesundheit") && !text.includes("Lebensmittel")
  );
  check(
    "calendar shows only the savings account's payments",
    text.includes("Schlüsse") && !text.includes("Miete") && !/\bGehalt\b/.test(text),
    text.match(/.{0,30}(Miete|Gehalt).{0,30}/)?.[0]
  );
  const forecast = await callAction(cookie, "getForecast", [3, SAVINGS], "/overview");
  const shownForecast = euro(text, FORECAST_LABEL);
  check(
    "3-month forecast covers only the savings account",
    forecast.success &&
      near(shownForecast, forecast.data.projectedBalance) &&
      !near(shownForecast, allForecast),
    `${shownForecast} / ${forecast.data?.projectedBalance} / all ${allForecast}`
  );
  check(
    "fixed costs and subscriptions follow the filter",
    !text.includes("Netflix") && text.includes("Keine monatlichen Fixkosten erfasst")
  );

  // 3. Another calendar month keeps the filter
  await page.evaluate(() =>
    document.querySelector("main svg.lucide-chevron-left")?.closest("button")?.click()
  );
  await page.waitForNetworkIdle({ idleTime: 500 }).catch(() => {});
  await sleep(500);
  text = await mainText(page);
  check(
    "previous calendar month also shows only the savings account",
    !text.includes("Miete") && !text.includes("Rewe")
  );

  // 4. Reloading keeps the filter
  await goto(page, `/overview?account=${SAVINGS}`);
  text = await mainText(page);
  const trigger = await page.$eval('main [role="combobox"]', (e) => e.innerText);
  check(
    "a reload keeps the chosen account",
    trigger.includes("Notgroschen") && text.includes("123,45 €") && !text.includes("Miete")
  );

  // 5. Back to all accounts
  check(
    "filter can go back to all accounts",
    await selectOption(page, "main", "Notgroschen", "Alle Konten")
  );
  await page.waitForFunction(() => location.search === "", { timeout: 15000 }).catch(() => {});
  await page.waitForNetworkIdle({ idleTime: 500 }).catch(() => {});
  await sleep(500);
  text = await mainText(page);
  check(
    "all accounts again without a URL parameter",
    page.url().endsWith("/overview") &&
      text.includes("Miete") &&
      near(euro(text, FORECAST_LABEL), allForecast),
    page.url()
  );

  // 6. Unknown or malformed account ids show all accounts and never fail
  for (const id of ["kein-konto", "00000000-0000-4000-8000-000000000000"]) {
    await goto(page, `/overview?account=${id}`);
    text = await bodyText(page);
    check(`unknown account "${id}" shows all accounts`, text.includes("Miete"));
  }
  const malformed = await callAction(cookie, "getForecast", [3, "kein-konto"], "/overview");
  check(
    "actions reject a malformed account id",
    malformed.success === false,
    JSON.stringify(malformed).slice(0, 120)
  );

  // 7. Another user's account id yields nothing of the demo user
  const erika = await newPage();
  await login(erika.page, ERIKA);
  const erikaCookie = await cookieHeader(erika.page);
  const foreign = await callAction(erikaCookie, "getForecast", [3, MAIN], "/overview");
  const foreignCalendar = await callAction(
    erikaCookie,
    "getMonthlyPaymentsCalendar",
    [year, month, MAIN],
    "/overview"
  );
  check(
    "a foreign account id shows none of its entries",
    foreign.success &&
      foreign.data.projectedIncome === 0 &&
      foreign.data.projectedExpenses === 0 &&
      foreignCalendar.success &&
      foreignCalendar.data.every((d) => d.payments.length === 0),
    JSON.stringify(foreign).slice(0, 160)
  );
  await goto(erika.page, `/overview?account=${MAIN}`);
  check(
    "a foreign account id in the URL shows none of its entries",
    !/Miete|Rewe|\bGehalt\b/.test(await bodyText(erika.page))
  );

  psql(`delete from daily_expenses where description = 'Schlüsseldienst'`);
  await erika.context.close();
  await context.close();
}
