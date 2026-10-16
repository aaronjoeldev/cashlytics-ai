// Salary plan: income split into fixed costs, reserves, everyday budget, savings and the rest
import { ERIKA } from "./auth.mjs";
import {
  B,
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
// The sidebar also says "Rücklagen", so only the page content is read; no-break spaces normalised
const mainText = async (page) =>
  (await page.$eval("main", (e) => e.innerText)).replace(/[  ]/g, " ");
const cents = (n) => Math.round(n * 100) / 100;

async function setNumber(page, selector, value) {
  await page.$eval(selector, (e) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(e, "");
    e.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.type(selector, value);
}

export async function salary() {
  const userId = demoUserId();
  const { page, context } = await newPage();
  await login(page);

  // 1. Every part matches the data, and the remainder is income minus all parts
  await goto(page, "/salary-plan");
  let text = await mainText(page);
  const income = euro(text, "Monatliches Einkommen");
  const fixed = euro(text, "Fixkosten");
  const reserves = euro(text, "Rücklagen");
  const everyday = euro(text, "Alltagsbudget");
  const savings = euro(text, "Sparen");
  const free = euro(text, "Frei verfügbar");

  const expectedIncome = Number(
    psql(`select round(coalesce(sum(case recurrence_type when 'monthly' then amount else amount / 12 end), 0), 2)
          from incomes where user_id = '${userId}' and recurrence_type <> 'once'
            and start_date < date_trunc('month', now()) + interval '1 month'
            and (end_date is null or end_date >= date_trunc('month', now()))`)
  );
  check(
    "income is the sum of the recurring incomes per month",
    income === expectedIncome,
    `${income} vs ${expectedIncome}`
  );
  check(
    "incomes are listed by name",
    text.includes("Gehalt 3.500,00 €") && text.includes("Freelance Projekte 650,00 €")
  );

  const expectedEveryday = Number(
    psql(`select coalesce(round(avg(total), 2), 0) from (
            select sum(d.amount / coalesce(r.rate, 1)) as total from daily_expenses d
            left join exchange_rates r on r.base_currency = 'EUR' and r.target_currency = d.currency
            where d.user_id = '${userId}'
              and d.date >= date_trunc('month', now()) - interval '3 months' and d.date < date_trunc('month', now())
            group by date_trunc('month', d.date)) m`)
  );
  check(
    "everyday budget is the average of the last three full months",
    everyday === expectedEveryday,
    `${everyday} vs ${expectedEveryday}`
  );
  check(
    "everyday budget says where it comes from",
    text.includes("Durchschnitt deiner täglichen Ausgaben der letzten 3 Monate")
  );

  await goto(page, "/reserves");
  const reservePlanTotal = euro(await mainText(page), "Monatlich zurücklegen");
  check(
    "reserves equal the monthly total of the reserve plan",
    reserves === reservePlanTotal,
    `${reserves} vs ${reservePlanTotal}`
  );

  check(
    "savings include Notgroschen and the ETF, not the reserve pot",
    text.includes("Notgroschen 300,00 €") &&
      text.includes("Weltportfolio ETF 200,00 €") &&
      savings >= 500
  );
  check(
    "remainder is income minus fixed costs, reserves, everyday budget and savings",
    free === cents(income - fixed - reserves - everyday - savings),
    `${free} vs ${cents(income - fixed - reserves - everyday - savings)}`
  );
  check(
    "payday shows the reserve transfer and what the standing order lacks",
    text.includes(
      `Geplant sind 75,00 €, es fehlen ${cents(reserves - 75).toLocaleString("de-DE", { minimumFractionDigits: 2 })} € pro Monat`
    )
  );
  check(
    "what stays on the checking account is fixed costs, everyday budget and the rest",
    euro(text, "Bleibt auf dem Girokonto") === cents(fixed + everyday + free)
  );

  // 2. A fixed everyday budget replaces the average, and the average can be restored
  await goto(page, "/salary-plan");
  await page.click('button[aria-label="Alltagsbudget anpassen"]');
  await page.waitForSelector("#everyday-budget");
  await setNumber(page, "#everyday-budget", "600");
  await clickText(page, '[role="dialog"] button', "Speichern");
  check(
    "saving the everyday budget is confirmed",
    await waitText(page, "Alltagsbudget gespeichert")
  );
  await sleep(800);
  text = await mainText(page);
  check(
    "fixed everyday budget is used",
    euro(text, "Alltagsbudget") === 600 && text.includes("Selbst festgelegt")
  );
  check(
    "remainder follows the fixed budget",
    euro(text, "Frei verfügbar") === cents(free + everyday - 600)
  );
  check(
    "fixed budget is stored",
    psql(
      `select everyday_budget || '|' || currency from plan_settings where user_id = '${userId}'`
    ) === "600.00|EUR"
  );

  await page.click('button[aria-label="Alltagsbudget anpassen"]');
  await page.waitForSelector("#everyday-budget");
  await clickText(page, '[role="dialog"] button', "Durchschnitt verwenden");
  await sleep(1500);
  text = await mainText(page);
  check(
    "average is used again",
    euro(text, "Alltagsbudget") === everyday && !text.includes("Selbst festgelegt")
  );
  check(
    "going back to the average clears the stored amount",
    psql(
      `select coalesce(everyday_budget::text, 'NULL') from plan_settings where user_id = '${userId}'`
    ) === "NULL"
  );

  // 3. A plan above the income is reported
  psql(
    `update plan_settings set everyday_budget = 99999, currency = 'EUR' where user_id = '${userId}'`
  );
  await goto(page, "/salary-plan");
  text = await mainText(page);
  check(
    "a plan above the income is reported",
    text.includes("Dein Plan geht um") && text.includes("Der Plan übersteigt dein Einkommen")
  );
  psql(
    `update plan_settings set everyday_budget = null, currency = null where user_id = '${userId}'`
  );

  // 4. Server checks and user isolation
  const cookie = await cookieHeader(page);
  const negative = await callAction(cookie, "setEverydayBudget", [{ amount: -5 }], "/salary-plan");
  check(
    "a negative everyday budget is refused",
    negative.success === false,
    JSON.stringify(negative).slice(0, 160)
  );
  const invalid = await callAction(
    cookie,
    "setEverydayBudget",
    [{ amount: "abc" }],
    "/salary-plan"
  );
  check("an invalid everyday budget is refused", invalid.success === false);

  const erika = await newPage();
  await login(erika.page, ERIKA);
  await erika.page.goto(`${B}/salary-plan`, { waitUntil: "networkidle0" });
  const erikaText = await mainText(erika.page);
  check(
    "another user sees only their own plan",
    !erikaText.includes("Gehalt 3.500,00 €") && !erikaText.includes("Notgroschen"),
    erikaText.slice(0, 200)
  );
  await erika.context.close();

  await context.close();
}
