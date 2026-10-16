// All create/edit dialogs through the UI (PR 2, 5, 8, 14)
import {
  bodyText,
  check,
  clickRowIcon,
  clickText,
  dialogDates,
  goto,
  login,
  newPage,
  psql,
  selectOption,
  setDate,
  sleep,
  todayLocal,
} from "./lib.mjs";

const toasts = (page) =>
  page.$$eval("[data-sonner-toast]", (els) => els.map((e) => e.textContent.trim()));
const submit = async (page, scope = '[role="dialog"]') => {
  const buttons = await page.$$(`${scope} button[type="submit"]`);
  await buttons.at(-1).click();
  await sleep(1800);
};
const dialogOpen = async (page) => (await page.$('[role="dialog"]')) !== null;
const euro = (s) => s.match(/[\d.]+,\d{2}\s?€/)?.[0];

export async function forms() {
  const { page, context } = await newPage();
  await login(page);
  const today = todayLocal();

  // ── Account ────────────────────────────────────────────────────────────────
  await goto(page, "/accounts");
  await clickText(page, "main button", "Konto hinzufügen");
  await sleep(600);
  await page.type('[role="dialog"] #name', "E2E Tagesgeld");
  await page.type('[role="dialog"] #balance', "1500");
  await selectOption(page, '[role="dialog"]', "Girokonto", "Sparkonto");
  await submit(page);
  const account = psql(
    "select type || '|' || balance || '|' || currency from accounts where name='E2E Tagesgeld'"
  );
  check("account is created through the dialog", account === "savings|1500.00|EUR", account);
  check("account dialog closes after saving", !(await dialogOpen(page)));
  check("new account is listed", (await bodyText(page)).includes("E2E Tagesgeld"));

  // ── Periodic expense with category and subscription flag ──────────────────
  await goto(page, "/expenses");
  await clickText(page, "main button", "Ausgabe hinzufügen");
  await sleep(700);
  await page.type('[role="dialog"] input[name="name"]', "E2E Streaming");
  await page.type('[role="dialog"] input[name="amount"]', "12.99");
  await selectOption(page, '[role="dialog"]', "Konto wählen", "Hauptkonto");
  await selectOption(page, '[role="dialog"]', "Ohne Kategorie", "Unterhaltung");
  await clickText(page, '[role="dialog"] button', "Ist ein Abo");
  await submit(page);
  const expense = psql(
    "select e.amount || '|' || e.recurrence_type || '|' || e.is_subscription || '|' || coalesce(c.name,'-') || '|' || to_char(e.start_date,'YYYY-MM-DD HH24:MI') from expenses e left join categories c on c.id=e.category_id where e.name='E2E Streaming'"
  );
  check(
    "periodic expense is stored with category, subscription flag and midnight start",
    expense === `12.99|monthly|true|Unterhaltung|${today} 00:00`,
    expense
  );

  // Edit shows the stored date; removing the category stores null; the date is kept
  await goto(page, "/expenses");
  await clickRowIcon(page, "E2E Streaming", "lucide-pencil");
  await sleep(800);
  check(
    "edit dialog shows the stored start date",
    (await dialogDates(page))[0] === today,
    (await dialogDates(page)).join(",")
  );
  await selectOption(page, '[role="dialog"]', "Unterhaltung", "Ohne Kategorie");
  await submit(page);
  const edited = psql(
    "select coalesce(category_id::text,'NULL') || '|' || to_char(start_date,'YYYY-MM-DD') from expenses where name='E2E Streaming'"
  );
  check("removing the category stores null and keeps the date", edited === `NULL|${today}`, edited);

  // Server error as toast: end date before start date
  await clickRowIcon(page, "E2E Streaming", "lucide-pencil");
  await sleep(800);
  await setDate(page, 1, "2000-01-01");
  await submit(page);
  const t1 = await toasts(page);
  check(
    "end date before start date is shown as a toast",
    t1.some((t) => t.includes("Enddatum")),
    JSON.stringify(t1)
  );
  check(
    "invalid end date is not stored",
    psql("select coalesce(end_date::text,'NULL') from expenses where name='E2E Streaming'") ===
      "NULL"
  );
  await page.keyboard.press("Escape");
  await sleep(300);

  // Subscription appears in the overview's subscription list
  await goto(page, "/overview");
  check(
    "new subscription is listed in the overview",
    (await bodyText(page)).includes("E2E Streaming")
  );

  // ── Custom recurrence with interval ───────────────────────────────────────
  await goto(page, "/expenses");
  await clickText(page, "main button", "Ausgabe hinzufügen");
  await sleep(700);
  await page.type('[role="dialog"] input[name="name"]', "E2E Wartung");
  await page.type('[role="dialog"] input[name="amount"]', "240");
  await selectOption(page, '[role="dialog"]', "Monatlich", "Benutzerdefiniert");
  check(
    "custom recurrence shows the interval input",
    (await page.$("#expense-recurrence-interval")) !== null
  );
  await page.type("#expense-recurrence-interval", "4");
  await selectOption(page, '[role="dialog"]', "Konto wählen", "Hauptkonto");
  await submit(page);
  check(
    "custom recurrence is stored with its interval",
    psql(
      "select recurrence_type || ':' || recurrence_interval from expenses where name='E2E Wartung'"
    ) === "custom:4"
  );
  await goto(page, "/expenses");
  await clickText(page, "main button", "Rücklagen (");
  await sleep(500);
  check(
    "custom interval is labelled 'Alle 4 Monate'",
    (await bodyText(page)).includes("Alle 4 Monate"),
    (await bodyText(page)).match(/E2E Wartung[\s\S]{0,120}/)?.[0]
  );

  // ── Income: validation toast, then a valid one ────────────────────────────
  await goto(page, "/income");
  await clickText(page, "main button", "Einnahme hinzufügen");
  await sleep(700);
  await page.type('[role="dialog"] input[name="source"]', "E2E Nebenjob");
  await page.type('[role="dialog"] input[name="amount"]', "450");
  await submit(page);
  const t2 = await toasts(page);
  check(
    "missing account is reported as a toast",
    t2.some((t) => t.includes("Konto")),
    JSON.stringify(t2)
  );
  await selectOption(page, '[role="dialog"]', "Konto wählen", "Hauptkonto");
  await submit(page);
  check(
    "income is stored",
    psql("select amount || '|' || recurrence_type from incomes where source='E2E Nebenjob'") ===
      "450.00|monthly"
  );
  await clickRowIcon(page, "E2E Nebenjob", "lucide-pencil");
  await sleep(800);
  check(
    "income edit shows its start date",
    (await dialogDates(page))[0] === today,
    (await dialogDates(page)).join(",")
  );
  await page.keyboard.press("Escape");
  await sleep(300);

  // ── Transfer ──────────────────────────────────────────────────────────────
  await goto(page, "/transfers");
  await clickText(page, "main button", "Transfer hinzufügen");
  await sleep(700);
  check(
    "new transfer defaults to today",
    (await dialogDates(page))[0] === today,
    (await dialogDates(page)).join(",")
  );
  await selectOption(page, '[role="dialog"]', "Quellkonto", "Hauptkonto");
  await selectOption(page, '[role="dialog"]', "Zielkonto", "E2E Tagesgeld");
  await page.type('[role="dialog"] input[name="amount"]', "300");
  await page.type('[role="dialog"] input[name="description"]', "E2E Sparrate");
  await selectOption(page, '[role="dialog"]', "Einmalig", "Monatlich");
  await submit(page);
  check(
    "transfer is stored",
    psql(
      "select amount || '|' || recurrence_type || '|' || source_currency from transfers where description='E2E Sparrate'"
    ) === "300.00|monthly|EUR"
  );
  check(
    "account balances are not changed by entries",
    psql("select balance from accounts where name='E2E Tagesgeld'") === "1500.00"
  );

  // ── Floating dialog: categories, today's date, daily expense ──────────────
  await goto(page, "/dashboard");
  await page.click('button[aria-label="Aktionen"]');
  await sleep(400);
  await page.click('button[aria-label="Ausgabe"]');
  await sleep(1000);
  await clickText(page, '[role="dialog"] [role="tab"]', "Täglich");
  await sleep(400);
  check(
    "floating dialog defaults the date to today",
    (await dialogDates(page)).pop() === today,
    (await dialogDates(page)).join(",")
  );
  const panel = '[role="dialog"] [role="tabpanel"][data-state="active"]';
  await selectOption(page, panel, "Ohne Kategorie", "Lebensmittel");
  const options = psql(
    "select count(*) from categories where user_id=(select id from users where email='demo@cashlytics.online')"
  );
  check("floating dialog offers the categories", Number(options) > 5);
  await selectOption(page, panel, "Konto wählen", "Hauptkonto");
  await page.type(`${panel} input[name="description"]`, "E2E Einkauf");
  await page.type(`${panel} input[name="amount"]`, "23.45");
  await submit(page, panel);
  const daily = psql(
    "select d.amount || '|' || to_char(d.date,'YYYY-MM-DD HH24:MI') || '|' || c.name from daily_expenses d left join categories c on c.id=d.category_id where description='E2E Einkauf'"
  );
  check(
    "daily expense from the floating dialog is stored with category and midnight date",
    daily === `23.45|${today} 00:00|Lebensmittel`,
    daily
  );

  // ── Deleting a category in use keeps the entries without category ─────────
  const wohnenEntries = psql(
    "select string_agg(e.name, ',' order by e.name) from expenses e join categories c on c.id=e.category_id where c.name='Wohnen'"
  );
  await goto(page, "/categories");
  await clickRowIcon(page, "Wohnen", "lucide-trash");
  await sleep(500);
  await page.$$eval('[role="alertdialog"] button, [role="dialog"] button', (els) =>
    els.find((b) => /Löschen/.test(b.innerText))?.click()
  );
  await sleep(1500);
  check(
    "category in use is deleted",
    psql("select count(*) from categories where name='Wohnen'") === "0"
  );
  check(
    "its entries keep their data without category",
    psql(
      `select count(*) from expenses where category_id is null and name in ('${wohnenEntries.split(",").join("','")}')`
    ) === String(wohnenEntries.split(",").length),
    wohnenEntries
  );

  // ── Dashboard and overview agree ──────────────────────────────────────────
  await goto(page, "/dashboard");
  const dash = await bodyText(page);
  const dashIncome = euro(dash.split("MONATLICHE EINNAHMEN")[1] ?? "");
  const dashExpenses = euro(dash.split("MONATLICHE AUSGABEN")[1] ?? "");
  await goto(page, "/overview");
  const overview = await bodyText(page);
  check(
    "dashboard and overview show the same monthly income",
    dashIncome && overview.includes(dashIncome),
    `${dashIncome} | ${overview.slice(0, 600)}`
  );
  check(
    "dashboard and overview show the same monthly expenses",
    dashExpenses && overview.includes(dashExpenses),
    `${dashExpenses}`
  );

  await context.close();
}
