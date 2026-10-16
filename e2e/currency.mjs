// Amounts in their own currency, settings from the server, base currency switch (PR 2, 10, 14)
import {
  B,
  actionId,
  bodyText,
  callAction,
  check,
  cookieHeader,
  demoUserId,
  goto,
  login,
  loginForm,
  newPage,
  psql,
  sleep,
} from "./lib.mjs";

export async function currency() {
  const userId = demoUserId();
  const usd = psql(
    `insert into accounts (user_id, name, type, balance, currency) values ('${userId}', 'US Konto', 'checking', 1000, 'USD') returning id`
  ).split("\n")[0];
  const main = "a0000000-0000-0000-0000-000000000001";
  psql(`insert into transfers (user_id, source_account_id, target_account_id, amount, recurrence_type, start_date, source_currency, target_currency, description)
        values ('${userId}', '${usd}', '${main}', 100, 'once', now(), 'USD', 'USD', 'USD Transfer')`);
  psql(`insert into transfers (user_id, source_account_id, target_account_id, amount, recurrence_type, start_date, source_currency, target_currency, target_amount, exchange_rate, description)
        values ('${userId}', '${main}', '${usd}', 50, 'once', now(), 'EUR', 'USD', 54, 1.08, 'Mehrwährung')`);
  psql(
    `insert into daily_expenses (user_id, account_id, description, amount, date, currency) values ('${userId}', '${main}', 'E2E Zukunft', 77, now() + interval '20 days', 'EUR')`
  );

  const { page, context } = await newPage();
  await login(page);
  const cookie = await cookieHeader(page);

  await goto(page, "/transfers");
  let text = await bodyText(page);
  check(
    "transfer from a USD account is shown in dollars",
    /100,00\s?\$/.test(text),
    text.match(/USD Transfer[\s\S]{0,80}/)?.[0]
  );
  check(
    "multi-currency transfer shows both sides",
    /50,00\s*€\s*→\s*54,00\s*\$/.test(text),
    text.match(/Mehrwährung[\s\S]{0,80}/)?.[0]
  );

  const results = await callAction(cookie, "globalSearch", ["US Konto"]);
  check(
    "search returns the account currency",
    Array.isArray(results) && results.some((r) => r.currency === "USD"),
    JSON.stringify(results).slice(0, 200)
  );
  await page.keyboard.down("Control");
  await page.keyboard.press("k");
  await page.keyboard.up("Control");
  await sleep(400);
  await page.keyboard.type("US Konto");
  await sleep(1500);
  check(
    "search dialog shows the account in dollars",
    /1\.000,00\s\$/.test(await page.$eval('[role="dialog"]', (d) => d.innerText).catch(() => ""))
  );
  await page.keyboard.press("Escape");

  // updateTransfer was removed as dead code (no UI edits transfers); it is no longer an endpoint
  check("removed transfer update is no longer a server action", !actionId("updateTransfer"));

  // Planned entries are not "recent transactions"
  await goto(page, "/dashboard");
  text = await bodyText(page);
  check(
    "a daily expense 20 days ahead is not in recent transactions",
    !text.includes("E2E Zukunft")
  );

  await context.close();

  // Stored settings win from the first page after login, even with other cookies
  psql(
    `insert into user_settings (user_id, base_currency, locale) values ('${userId}', 'USD', 'en') on conflict (user_id) do update set base_currency='USD', locale='en'`
  );
  {
    const fresh = await newPage();
    await fresh.page.setCookie(
      { name: "currency", value: "EUR", url: B },
      { name: "locale", value: "de", url: B }
    );
    await fresh.page.goto(`${B}/login`, { waitUntil: "networkidle0" });
    check(
      "login page follows the cookie (German)",
      (await bodyText(fresh.page)).includes("Willkommen zurück")
    );
    await loginForm(fresh.page, "demo@cashlytics.online", "admin123456789");
    const first = await bodyText(fresh.page);
    check(
      "first page after login is English",
      first.includes("MONTHLY INCOME") || first.includes("Monthly Income"),
      first.slice(0, 300)
    );
    check(
      "first page after login shows dollars only",
      first.includes("$") && !/\d\s?€|€\s?\d/.test(first.replace(/45€/g, "")),
      first
        .match(/.{0,15}€.{0,15}/g)
        ?.slice(0, 3)
        .join(" | ")
    );
    const amounts = (first.match(/\$[\d,.]+/g) ?? []).join(" ");
    await fresh.page.reload({ waitUntil: "networkidle0" });
    await sleep(500);
    check(
      "no amount changes on reload",
      ((await bodyText(fresh.page)).match(/\$[\d,.]+/g) ?? []).join(" ") === amounts
    );
    const cookies = Object.fromEntries((await fresh.page.cookies()).map((c) => [c.name, c.value]));
    check(
      "cookies follow the stored settings",
      cookies.currency === "USD" && cookies.locale === "en",
      JSON.stringify(cookies)
    );
    await goto(fresh.page, "/categories");
    check(
      "English plural for categories",
      /\d+ categories available/.test(await bodyText(fresh.page))
    );
    await goto(fresh.page, "/accounts");
    check("English plural for accounts", /\b\d+ accounts\b/.test(await bodyText(fresh.page)));
    await fresh.context.close();
  }

  // Switching the base currency in the settings keeps the locale
  psql(`delete from user_settings where user_id='${userId}'`);
  {
    const s = await newPage();
    await login(s.page);
    await goto(s.page, "/settings");
    await s.page.click("#currency");
    await sleep(300);
    await s.page.$$eval('[role="option"]', (els) =>
      els.find((e) => e.innerText.includes("USD"))?.click()
    );
    await s.page.waitForNavigation({ waitUntil: "networkidle0", timeout: 10000 }).catch(() => {});
    await sleep(800);
    check(
      "currency change is stored with the current locale",
      psql(`select base_currency || ':' || locale from user_settings where user_id='${userId}'`) ===
        "USD:de"
    );
    await goto(s.page, "/dashboard");
    const t = await bodyText(s.page);
    check(
      "dashboard totals switch to dollars",
      /\d\s?\$/.test(t) && t.includes("MONATLICHE EINNAHMEN")
    );
    await s.context.close();
  }
  psql(`delete from user_settings where user_id='${userId}'`);
}
