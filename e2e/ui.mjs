// Remaining UI round checks: hydration, calendar, bell, documents, search, analytics, push, chat, mobile (PR 8, 14)
import {
  B,
  bodyText,
  check,
  clickRowIcon,
  clickText,
  consoleErrors,
  demoUserId,
  login,
  newPage,
  psql,
  sleep,
  waitText,
} from "./lib.mjs";

// Development builds name hydration errors; production builds only give React's error code
const HYDRATION = /hydrat|did not match|server rendered|Minified React error #(418|423|425)/i;

export async function ui() {
  // ── 3. Signed-in German checks, browser in a far-away time zone ───────────────
  const { page, context } = await newPage({ timezone: "America/Los_Angeles" });
  await login(page);
  const text = bodyText;
  const userId = demoUserId();
  psql("delete from insights");
  psql(
    `insert into insights (user_id, type, title, message, severity) values ('${userId}', (enum_range(null::insight_type))[1], 'Lebensmittel über Schnitt', 'Du hast 30% mehr ausgegeben.', 'warning'), ('${userId}', (enum_range(null::insight_type))[1], 'Abo gefunden', 'Netflix kostet 13,99 € im Monat.', 'info')`
  );
  const PNG =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

  // Hydration: list pages render the same on server and client
  const errorsBefore = consoleErrors.length;
  for (const path of ["/expenses", "/income", "/transfers", "/documents", "/categories"]) {
    await page.goto(`${B}${path}`, { waitUntil: "networkidle0" });
    await sleep(600);
  }
  const hydration = consoleErrors
    .slice(errorsBefore)
    .map((e) => e.text)
    .filter((e) => HYDRATION.test(e));
  check(
    "no hydration errors on list pages (browser in Los Angeles)",
    hydration.length === 0,
    hydration.join(" || ")
  );

  // Calendar days are not shifted: the earliest Rewe entry's date as stored
  await page.goto(`${B}/expenses`, { waitUntil: "networkidle0" });
  await clickText(page, '[role="tab"], button', "Täglich (");
  await sleep(800);
  const stored = psql(
    "select to_char(date, 'DD.MM.YYYY') from daily_expenses where description='Rewe Wocheneinkauf' order by date desc limit 1"
  );
  check(
    "daily expense date shows the stored calendar day in Los Angeles",
    (await text(page)).includes(stored),
    stored
  );

  // ── 4. Calendar returns to the current month ─────────────────────────────────
  await page.goto(`${B}/overview`, { waitUntil: "networkidle0" });
  await sleep(800);
  const calendarCells = () =>
    page.$$eval("button, div", (els) => {
      const grid = els.find(
        (e) => e.className?.includes?.("grid-cols-7") && e.children.length >= 28
      );
      return grid ? grid.innerText.replace(/\s+/g, " ") : "";
    });
  const initialCalendar = await calendarCells();
  const headerMonth = () =>
    page.$$eval(
      "span, div",
      (els) =>
        els
          .map((e) => e.innerText)
          .find((t) =>
            /^(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember) \d{4}$/.test(
              t?.trim()
            )
          ) ?? ""
    );
  const monthBefore = await headerMonth();
  // The calendar card has its own prev/next buttons (icon-only, h-8 w-8)
  const navButtons = await page.$$("button.h-8.w-8");
  async function clickCalendar(direction) {
    const buttons = await page.$$eval("button", (els) =>
      els.map((e, i) => ({ i, html: e.innerHTML, cls: e.className }))
    );
    const icon = direction === "next" ? "chevron-right" : "chevron-left";
    const idx = buttons.filter((b) => b.html.includes(icon)).at(-1)?.i;
    const handles = await page.$$("button");
    await handles[idx].click();
  }
  await clickCalendar("next");
  await sleep(1500);
  const nextCalendar = await calendarCells();
  const monthNext = await headerMonth();
  await clickCalendar("prev");
  await sleep(1500);
  const backCalendar = await calendarCells();
  check(
    "calendar changes when moving to the next month",
    nextCalendar !== initialCalendar && monthNext !== monthBefore,
    `${monthBefore} -> ${monthNext}`
  );
  check(
    "calendar shows the current month's data again after going back",
    backCalendar === initialCalendar && (await headerMonth()) === monthBefore,
    backCalendar.slice(0, 120) + " ≠ " + initialCalendar.slice(0, 120)
  );
  void navButtons;

  // ── 5. Notification bell ─────────────────────────────────────────────────────
  await page.goto(`${B}/dashboard`, { waitUntil: "networkidle0" });
  await sleep(800);
  const bellButton = async () => (await page.$$("button")).find(async () => false);
  void bellButton;
  const hasDot = () =>
    page.$$eval("header button", (els) => els.some((b) => b.querySelector(".animate-ping")));
  check("bell shows a dot while there are unread insights", await hasDot());
  await page.$$eval("header button", (els) =>
    els.find((b) => b.innerText.includes("Benachrichtigungen"))?.click()
  );
  await sleep(600);
  let body = await text(page);
  check(
    "bell lists the insights",
    body.includes("Lebensmittel über Schnitt") && body.includes("Abo gefunden"),
    body.slice(-400)
  );
  await page.$$eval('button[aria-label="Als gelesen markieren"]', (els) => els[0]?.click());
  await sleep(1000);
  check(
    "marking one insight read updates the database",
    psql("select count(*) from insights where is_read") === "1"
  );
  await page.$$eval('button[aria-label="Als gelesen markieren"]', (els) => els[0]?.click());
  await sleep(1000);
  body = await text(page);
  check("empty state after the last insight", body.includes("Keine neuen Hinweise."));
  await page.keyboard.press("Escape");
  await sleep(300);
  check("dot disappears when nothing is unread", !(await hasDot()));

  // ── 7. Documents: preview, delete error is shown ─────────────────────────────
  const dailyId = psql(
    "select id from daily_expenses where description='Rewe Wocheneinkauf' order by date desc limit 1"
  );
  const docA = psql(
    `insert into documents (daily_expense_id, file_name, mime_type, size, data, user_id) values ('${dailyId}', 'beleg-a.png', 'image/png', 68, '${PNG}', '${userId}') returning id`
  ).split("\n")[0];
  const docB = psql(
    `insert into documents (daily_expense_id, file_name, mime_type, size, data, user_id) values ('${dailyId}', 'beleg-b.png', 'image/png', 68, '${PNG}', '${userId}') returning id`
  ).split("\n")[0];
  await page.goto(`${B}/documents`, { waitUntil: "networkidle0" });
  await sleep(800);
  await clickRowIcon(page, "beleg-a.png", "lucide-eye");
  await sleep(1500);
  const previewOk = await page
    .$eval('[role="dialog"] img', (e) => e.src.startsWith("data:image/png"))
    .catch(() => false);
  check("document preview shows the image", previewOk);
  await page.keyboard.press("Escape");
  await sleep(500);
  // Delete beleg-b in the database first, then try deleting it in the UI
  psql(`delete from documents where id='${docB}'`);
  // The row of a delete button is the closest ancestor that names exactly one file
  const rowNames = await page.$$eval('button[title="Löschen"]', (els) =>
    els.map((b) => {
      let el = b.parentElement;
      while (el && (el.innerText.match(/beleg-\w\.png/g) ?? []).length !== 1) el = el.parentElement;
      return el?.innerText.match(/beleg-\w\.png/)?.[0] ?? "";
    })
  );
  const rows = rowNames;
  const deleteButtons = await page.$$('button[title="Löschen"]');
  const bIndex = rowNames.indexOf("beleg-b.png");
  await deleteButtons[bIndex].click();
  await sleep(500);
  await page.$$eval('[role="alertdialog"] button, [role="dialog"] button', (els) =>
    els.find((b) => b.innerText.trim() === "Löschen")?.click()
  );
  check(
    "failed delete is reported",
    await waitText(page, "Dokument konnte nicht gelöscht werden"),
    rows.join(",")
  );
  psql(`delete from documents where id='${docA}'`);

  // Preview of a document that no longer exists closes with an error
  const docC = psql(
    `insert into documents (daily_expense_id, file_name, mime_type, size, data, user_id) values ('${dailyId}', 'beleg-c.png', 'image/png', 68, '${PNG}', '${userId}') returning id`
  ).split("\n")[0];
  await page.goto(`${B}/documents`, { waitUntil: "networkidle0" });
  await sleep(800);
  psql(`delete from documents where id='${docC}'`);
  await clickRowIcon(page, "beleg-c.png", "lucide-eye");
  check("failed preview is reported", await waitText(page, "Vorschau konnte nicht geladen werden"));

  // ── 9. Search starts empty on every open ─────────────────────────────────────
  await page.goto(`${B}/dashboard`, { waitUntil: "networkidle0" });
  await page.keyboard.down("Control");
  await page.keyboard.press("k");
  await page.keyboard.up("Control");
  await sleep(500);
  await page.keyboard.type("Rewe");
  await sleep(1500);
  const hadResults = (await text(page)).includes("Rewe Wocheneinkauf");
  await page.keyboard.press("Escape");
  await sleep(400);
  await page.keyboard.down("Control");
  await page.keyboard.press("k");
  await page.keyboard.up("Control");
  await sleep(500);
  const reopenedValue = await page.$eval('[role="dialog"] input', (e) => e.value).catch(() => "?");
  check(
    "search shows results and is empty when reopened",
    hadResults && reopenedValue === "",
    `results=${hadResults} value=${reopenedValue}`
  );
  await page.keyboard.press("Escape");

  // ── 10. Analytics account filter switches back to all accounts ───────────────
  await page.goto(`${B}/analytics`, { waitUntil: "networkidle0" });
  await sleep(2000);
  const mainText = () => page.$eval("main", (e) => e.innerText);
  const analyticsAll = await mainText();
  await page.$$eval('[role="combobox"]', (els) => els[0]?.click());
  await sleep(300);
  await clickText(page, '[role="option"]', "Notgroschen");
  await sleep(3000);
  const analyticsOne = await mainText();
  await page.$$eval('[role="combobox"]', (els) => els[0]?.click());
  await sleep(300);
  await sleep(400);
  // The open list is aligned on the selected item, so "Alle Konten" sits above the viewport;
  // pick it by typeahead instead of clicking
  await page.keyboard.type("Alle");
  await sleep(300);
  await page.keyboard.press("Enter");
  await sleep(2500);
  await sleep(2500);
  const analyticsBack = await mainText();
  check(
    "analytics changes per account and returns to all accounts",
    analyticsOne !== analyticsAll && analyticsBack === analyticsAll,
    `one!=all ${analyticsOne !== analyticsAll}, back==all ${analyticsBack === analyticsAll}`
  );

  // Push toggle with VAPID keys configured
  await page.goto(`${B}/settings`, { waitUntil: "networkidle0" });
  await sleep(1500);
  let settings = await text(page);
  const enabled = await page.$eval(
    "#push-toggle",
    (e) => !e.disabled && e.getAttribute("data-disabled") === null
  );
  check(
    "push toggle is usable when the server has VAPID keys",
    enabled && !settings.includes("Nicht eingerichtet"),
    settings.match(/Benachrichtigungen empfangen\n.*/)?.[0]
  );
  await context.overridePermissions(B, ["notifications"]);
  await page.click("#push-toggle");
  let pushToast = [];
  for (let i = 0; i < 20 && !pushToast.length; i++) {
    await sleep(300);
    pushToast = await page.$$eval("[data-sonner-toast]", (els) => els.map((e) => e.innerText));
  }
  // Headless Chrome has no push service, so the browser refuses the subscription; the app must say so
  const subscribed = psql(`select count(*) from push_subscriptions where user_id='${userId}'`);
  check(
    "enabling push either subscribes or shows the browser's error",
    subscribed === "1" || pushToast.some((t) => t.startsWith("Fehler:")),
    `rows=${subscribed} toast=${pushToast.join(" | ")}`
  );
  check(
    "toggle stays off when the browser refuses",
    subscribed === "1" || (await text(page)).includes("Deaktiviert")
  );

  // German chat texts and the mobile layout
  await page.goto(`${B}/assistant`, { waitUntil: "networkidle0" });
  await sleep(800);
  // Earlier suites leave conversations behind; a new chat shows the empty state
  await page.$$eval('button[aria-label="Neuer Chat"]', (els) =>
    els.find((e) => e.offsetParent !== null)?.click()
  );
  await sleep(1200);
  const chat = await text(page);
  check(
    "chat shows the German empty state or welcome",
    chat.includes("Starte eine Konversation") ||
      chat.includes("Hallo! Ich bin dein Cashlytics Assistent")
  );
  await page.setViewport({ width: 390, height: 800 });
  await sleep(800);
  check(
    "mobile layout shows the chat history button",
    (await page.$('button[aria-label="Chatverlauf öffnen"]')) !== null
  );
  await page.setViewport({ width: 1280, height: 900 });
  await sleep(800);
  check(
    "desktop layout shows the chat sidebar again",
    await page.$$eval("aside", (els) =>
      els.some((a) => a.innerText.includes("Chats") && a.offsetParent !== null)
    )
  );

  // German plurals
  await page.goto(`${B}/categories`, { waitUntil: "networkidle0" });
  check("German plural for categories", /\d+ Kategorien vorhanden/.test(await text(page)));
  await page.goto(`${B}/accounts`, { waitUntil: "networkidle0" });
  check("German plural for accounts", /\b\d+ Konten\b/.test(await text(page)));

  // Pages with relative dates ("today", "in 3 days") in time zones far from Berlin. Kiritimati
  // (UTC+14) is a day ahead of Berlin from 10:00 to 22:00 UTC, Pago Pago (UTC-11) a day behind
  // from 22:00 to 11:00 UTC, so at any time of day one of them sees another date than the server.
  for (const zone of ["Pacific/Kiritimati", "Pacific/Pago_Pago"]) {
    const z = await newPage({ timezone: zone });
    await login(z.page);
    for (const path of ["/dashboard", "/overview", "/expenses", "/income", "/transfers"]) {
      const before = consoleErrors.length;
      await z.page.goto(`${B}${path}`, { waitUntil: "networkidle0" });
      await sleep(800);
      const errors = consoleErrors
        .slice(before)
        .map((e) => e.text)
        .filter((t) => HYDRATION.test(t));
      check(
        `${path} hydrates without mismatch in ${zone}`,
        errors.length === 0,
        errors.join(" || ")
      );
    }
    await z.context.close();
  }

  await context.close();
}
