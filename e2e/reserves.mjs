// Reserve plan: fixed monthly rates, target today, the pot kept by the app, dashboard card
import { ERIKA } from "./auth.mjs";
import {
  bodyText,
  callAction,
  check,
  clickText,
  cookieHeader,
  demoUserId,
  goto,
  login,
  newPage,
  psql,
  sleep,
  waitText,
} from "./lib.mjs";

const euro = (text, label) => {
  const m = (text.split(label)[1] ?? "").match(/(-?[\d.]+,\d{2})\s?€/);
  return m ? Number(m[1].replace(/\./g, "").replace(",", ".")) : NaN;
};
const de = (n) => n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Currency amounts use a no-break space before the symbol
const pageText = async (page) => (await bodyText(page)).replace(/[\u00a0\u202f]/g, " ");
const POT_ACCOUNT = "a0000000-0000-0000-0000-000000000004";

export async function reserves() {
  const userId = demoUserId();
  const { page, context } = await newPage();
  await login(page);

  // 1. Seeded plan: five infrequent bills, fixed rates, pot with the seeded balance
  await goto(page, "/reserves");
  let text = await pageText(page);
  for (const name of [
    "Kfz-Steuer",
    "Rundfunkbeitrag",
    "Hausratversicherung",
    "Zahnzusatzversicherung",
    "BahnCard 50",
  ]) {
    check(`reserve plan lists ${name}`, text.includes(name));
  }
  check(
    "monthly bills are not in the reserve plan",
    !text.includes("Netflix") && !text.includes("Miete")
  );
  // Earlier suites may have added reserve bills of their own (e.g. "every 4 months"), so the
  // expected total comes from the database: amount ÷ interval, converted with the stored rates
  const expected = Number(
    psql(`select round(coalesce(sum(e.amount / coalesce(r.rate, 1) / case e.recurrence_type
            when 'quarterly' then 3 when 'semiannual' then 6 when 'yearly' then 12 else e.recurrence_interval end), 0), 2)
          from expenses e
          left join exchange_rates r on r.base_currency = 'EUR' and r.target_currency = e.currency
          where e.user_id = '${userId}' and (e.end_date is null or e.end_date >= date_trunc('day', now()))
            and (e.recurrence_type in ('quarterly', 'semiannual', 'yearly')
                 or (e.recurrence_type = 'custom' and e.recurrence_interval > 1))`)
  );
  const monthly = euro(text, "Monatlich zurücklegen");
  check(
    `monthly total is the sum of the fixed rates (${de(expected)} €)`,
    monthly === expected,
    monthly
  );
  check("BahnCard rate is amount ÷ 12", text.includes("20,33 €/Mo"));
  check(
    "pot shows the seeded balance and account",
    euro(text, "Im Topf") === 250 && text.includes("Rücklagenkonto: Rücklagen")
  );
  const target = euro(text, "Soll-Stand heute");
  check(
    "target today is above zero and below the sum of the bills",
    target > 0 && target < 694.98,
    target
  );
  check(
    "shortfall is shown as a one-time amount",
    text.includes(`Einmalig fehlen ${de(target - 250)} €`),
    text.match(/Einmalig fehlen[^\n]*/)?.[0]
  );
  check(
    "monthly rate stays the same despite the shortfall",
    text.includes(`Die Monatsrate bleibt bei ${de(expected)} €`)
  );
  check(
    "standing order of 75 € is reported as too low by the rest of the monthly rate",
    text.includes(`Dauerauftrag zu niedrig: ${de(expected - 75)} € pro Monat fehlen`)
  );

  // 2. A bill due next month: rate stays amount ÷ 12, target is the amount minus one rate
  psql(`insert into expenses (id, user_id, account_id, name, amount, recurrence_type, start_date)
        values ('e0000000-0000-0000-0000-0000000000e2', '${userId}', 'a0000000-0000-0000-0000-000000000001', 'E2E Jahresbeitrag', 1200, 'yearly',
                date_trunc('month', now()) + interval '1 month 14 days' - interval '1 year')`);
  await goto(page, "/reserves");
  text = await pageText(page);
  const row = text.match(/E2E Jahresbeitrag[\s\S]*?Soll heute [\d.,]+ €/)?.[0] ?? "";
  check("bill due next month keeps the fixed rate of 100 €", row.includes("100,00 €/Mo"), row);
  check("its target today is 1.100 €", row.includes("Soll heute 1.100,00 €"), row);
  check(
    "it is listed first (next due)",
    text.indexOf("E2E Jahresbeitrag") < text.indexOf("BahnCard 50")
  );
  psql("delete from expenses where id = 'e0000000-0000-0000-0000-0000000000e2'");

  // 3. Correct the balance in the dialog
  await goto(page, "/reserves");
  await clickText(page, "button", "Stand korrigieren");
  await page.waitForSelector("#reserve-balance");
  // A number input cannot be selected; clear it through React's value setter, then type
  await page.$eval("#reserve-balance", (e) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(e, "");
    e.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.type("#reserve-balance", "2000");
  await clickText(page, '[role="dialog"] button', "Speichern");
  check("saved balance shows up", await waitText(page, "Rücklagentopf gespeichert"));
  await sleep(800);
  text = await pageText(page);
  check("pot shows the corrected balance", euro(text, "Im Topf") === 2000, euro(text, "Im Topf"));
  check(
    "with enough in the pot the plan is on track",
    text.includes("Im Plan") && !text.includes("Einmalig fehlen")
  );
  const stored = psql(
    `select balance || '|' || to_char(balance_date, 'HH24:MI') || '|' || (balance_date::date = (now() at time zone 'Europe/Berlin')::date) from reserve_pots where user_id = '${userId}'`
  );
  check("balance is stored with today as a calendar day", stored === "2000.00|00:00|true", stored);

  // 4. Dashboard card
  await goto(page, "/dashboard");
  text = await pageText(page);
  check(
    "dashboard shows the reserve card with the monthly amount",
    text.includes("Diesen Monat zurücklegen") && text.includes(`${de(expected)} €`)
  );
  check(
    "dashboard card names the next infrequent bill",
    /Nächste seltene Rechnung\s*\S/.test(text)
  );

  // 5. Server checks: invalid input and another user's account are refused
  const cookie = await cookieHeader(page);
  const bad = await callAction(
    cookie,
    "setReservePot",
    [{ accountId: POT_ACCOUNT, balance: "abc" }],
    "/reserves"
  );
  check("invalid balance is refused", bad.success === false, JSON.stringify(bad).slice(0, 160));
  const erika = await newPage();
  await login(erika.page, ERIKA);
  const foreign = await callAction(
    await cookieHeader(erika.page),
    "setReservePot",
    [{ accountId: POT_ACCOUNT, balance: 1 }],
    "/reserves"
  );
  check(
    "another user's account cannot become the pot",
    foreign.success === false && foreign.error === "Konto nicht gefunden.",
    JSON.stringify(foreign).slice(0, 160)
  );
  check(
    "the refused call stored nothing for the other user",
    psql(
      `select count(*) from reserve_pots p join users u on u.id = p.user_id where u.email = '${ERIKA.email}'`
    ) === "0"
  );
  await erika.context.close();

  // 6. Deleting the pot account asks for a new one
  psql(`update reserve_pots set account_id = null where user_id = '${userId}'`);
  await goto(page, "/reserves");
  check(
    "without a pot account the page offers to choose one",
    (await pageText(page)).includes("Rücklagenkonto festlegen")
  );
  psql(
    `update reserve_pots set account_id = '${POT_ACCOUNT}', balance = 250 where user_id = '${userId}'`
  );

  await context.close();
}
