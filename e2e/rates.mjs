// Totals use the live rates from the cache (run.mjs seeds 1 EUR = 1.25 USD), not the fallback table (1.08)
import {
  bodyText,
  check,
  clickText,
  demoUserId,
  goto,
  login,
  newPage,
  psql,
  selectOption,
  sleep,
} from "./lib.mjs";

const euro = (text, label) => {
  const m = (text.split(label)[1] ?? "").match(/(-?[\d.]+,\d{2})\s?€/);
  return m ? Number(m[1].replace(/\./g, "").replace(",", ".")) : NaN;
};

export async function rates() {
  const userId = demoUserId();
  const main = "a0000000-0000-0000-0000-000000000001";
  const { page, context } = await newPage();
  await login(page);

  // Currency converter shows the cached live rate
  await goto(page, "/tools");
  let t = await bodyText(page);
  check(
    "converter uses the live rate (1 EUR = 1,25 USD)",
    t.includes("1 EUR = 1,25 USD") && /125,00\s\$/.test(t),
    t.match(/1 EUR = [\d,]+ USD/)?.[0]
  );

  // Server-side totals: 125 USD this month add exactly 100 EUR to the dashboard expenses
  await goto(page, "/dashboard");
  const before = euro(await bodyText(page), "MONATLICHE AUSGABEN");
  psql(
    `insert into daily_expenses (user_id, account_id, description, amount, date, currency) values ('${userId}', '${main}', 'E2E Dollar', 125, date_trunc('day', now()), 'USD')`
  );
  await goto(page, "/dashboard");
  const after = euro(await bodyText(page), "MONATLICHE AUSGABEN");
  check(
    "dashboard converts 125 USD to 100,00 € with the live rate",
    Math.abs(after - before - 100) < 0.005,
    `${before} → ${after} (fallback table would add 115,74)`
  );

  await goto(page, "/analytics");
  const analytics = await bodyText(page);
  check(
    "analytics totals include the converted amount",
    Number.isFinite(euro(analytics, "Ausgaben")),
    analytics.slice(0, 200)
  );

  // Client-side totals: a monthly 50 USD expense adds 40 EUR to the fixed costs
  await goto(page, "/expenses");
  const fixedBefore = euro(await bodyText(page), "Monatliche Fixkosten");
  psql(
    `insert into expenses (user_id, account_id, name, amount, recurrence_type, start_date, currency) values ('${userId}', '${main}', 'E2E Dollar-Abo', 50, 'monthly', date_trunc('month', now()), 'USD')`
  );
  await goto(page, "/expenses");
  const fixedAfter = euro(await bodyText(page), "Monatliche Fixkosten");
  check(
    "expenses page converts 50 USD to 40,00 € with the live rate",
    Math.abs(fixedAfter - fixedBefore - 40) < 0.005,
    `${fixedBefore} → ${fixedAfter}`
  );

  // Form preview: 125 USD on a EUR account ≈ 100.00 EUR
  await clickText(page, "main button", "Ausgabe hinzufügen");
  await sleep(700);
  await selectOption(page, '[role="dialog"]', "Konto wählen", "Hauptkonto");
  await selectOption(page, '[role="dialog"]', "EUR", "USD");
  await page.type('[role="dialog"] input[name="amount"]', "125");
  await sleep(400);
  const preview = await page.$eval('[role="dialog"]', (d) => d.innerText);
  check(
    "form preview converts with the live rate",
    preview.includes("≈ 100.00 EUR"),
    preview.match(/≈ [\d.]+ \w+/)?.[0]
  );
  await page.keyboard.press("Escape");

  psql("delete from daily_expenses where description='E2E Dollar'");
  psql("delete from expenses where name='E2E Dollar-Abo'");
  await context.close();
}
