// Insight generation through the cron route and the header bell (PR 9, 14)
import { B, bodyText, check, demoUserId, env, goto, login, newPage, psql, sleep } from "./lib.mjs";

const cronSecret = env("CRON_SECRET");
const cron = async (path) => {
  const res = await fetch(`${B}${path}`, { headers: { Authorization: `Bearer ${cronSecret}` } });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

export async function insights() {
  const userId = demoUserId();
  const main = "a0000000-0000-0000-0000-000000000001";
  // A large uncategorised spend this month against a normal history in the three months before
  for (const months of [1, 2, 3]) {
    psql(`insert into daily_expenses (user_id, account_id, description, amount, date, currency, category_id)
          values ('${userId}', '${main}', 'E2E Kleinkram', 40, date_trunc('month', now()) - interval '${months} months' + interval '9 days', 'EUR', null)`);
  }
  psql(`insert into daily_expenses (user_id, account_id, description, amount, date, currency, category_id)
        values ('${userId}', '${main}', 'E2E Großeinkauf', 2500, date_trunc('day', now()), 'EUR', null)`);

  const first = await cron("/api/cron/insights");
  check(
    "insights cron runs with the secret",
    first.status === 200 && first.body.failed === 0,
    JSON.stringify(first)
  );
  const count1 = psql(`select count(*) from insights where user_id='${userId}'`);
  check("insights are generated for the demo user", Number(count1) > 0, count1);
  check(
    "no insight title starts with null",
    psql("select count(*) from insights where title like 'null%'") === "0"
  );
  check(
    "uncategorised spending is named 'Ohne Kategorie'",
    psql(
      `select count(*) from insights where user_id='${userId}' and title like 'Ohne Kategorie%'`
    ) === "1",
    psql("select string_agg(title, ' | ') from insights")
  );
  check(
    "every dedup key exists once",
    psql(
      "select count(*) from (select dedup_key from insights group by user_id, dedup_key having count(*) > 1) d"
    ) === "0"
  );

  const second = await cron("/api/cron/insights");
  check(
    "a second run adds nothing",
    second.status === 200 &&
      psql(`select count(*) from insights where user_id='${userId}'`) === count1,
    JSON.stringify(second.body)
  );

  // The bell lists them; marking one read keeps it read across runs
  const { page, context } = await newPage();
  await login(page);
  await goto(page, "/dashboard");
  const hasDot = () =>
    page.$$eval("header button", (els) => els.some((b) => b.querySelector(".animate-ping")));
  check("bell shows a dot for unread insights", await hasDot());
  await page.$$eval("header button", (els) =>
    els.find((b) => b.innerText.includes("Benachrichtigungen"))?.click()
  );
  await sleep(600);
  check(
    "bell lists the 'Ohne Kategorie' insight",
    (await bodyText(page)).includes("Ohne Kategorie")
  );
  const target = psql(
    `select id from insights where user_id='${userId}' and title like 'Ohne Kategorie%'`
  );
  await page.$$eval("li", (els) =>
    els
      .find((li) => li.innerText.includes("Ohne Kategorie"))
      ?.querySelector('button[aria-label="Als gelesen markieren"]')
      ?.click()
  );
  await sleep(1000);
  check(
    "marking read is stored",
    psql(`select is_read from insights where id='${target}'`) === "t"
  );
  await cron("/api/cron/insights");
  check(
    "a read insight stays read after the next run",
    psql(`select is_read from insights where id='${target}'`) === "t"
  );

  for (let i = 0; i < 10; i++) {
    const clicked = await page.$$eval(
      'button[aria-label="Als gelesen markieren"]',
      (els) => (els[0]?.click(), els.length)
    );
    if (!clicked) break;
    await sleep(700);
  }
  check(
    "empty state when everything is read",
    (await bodyText(page)).includes("Keine neuen Hinweise.")
  );
  await page.keyboard.press("Escape");
  await sleep(300);
  check("dot disappears when nothing is unread", !(await hasDot()));
  await context.close();

  // An unread insight that no longer applies is removed
  psql(`update insights set is_read=false where id='${target}'`);
  psql("delete from daily_expenses where description='E2E Großeinkauf'");
  await cron("/api/cron/insights");
  check(
    "an unread insight that no longer applies is removed",
    psql(`select count(*) from insights where id='${target}'`) === "0"
  );

  const reminders = await cron("/api/cron/upcoming-payments");
  check(
    "payment reminder cron runs with the secret",
    reminders.status === 200,
    JSON.stringify(reminders)
  );
}
