// Assistant with tool approvals against the fake Responses API (PR 6, 9, 13)
import {
  B,
  bodyText,
  check,
  clickText,
  fakeLog,
  fakeState,
  login,
  newPage,
  psql,
  sleep,
} from "./lib.mjs";

export async function assistant() {
  const { page, context } = await newPage();
  await login(page);
  const latestConversation = () =>
    psql("select id from conversations order by created_at desc limit 1");
  const savedMessages = (conversationId) =>
    psql(
      `select coalesce(string_agg(role || ': ' || replace(content, chr(10), ' / '), ' || ' order by created_at), '') from messages where conversation_id='${conversationId}'`
    );

  async function send(text) {
    await page.click('textarea[aria-label="Chat-Nachricht eingeben"]');
    await page.type('textarea[aria-label="Chat-Nachricht eingeben"]', text);
    await page.keyboard.press("Enter");
  }
  const waitFor = (fn, arg, timeout = 15000) =>
    page.waitForFunction(fn, { timeout }, arg).then(
      () => true,
      () => false
    );
  const waitText = (text, timeout) =>
    waitFor((t) => document.body.innerText.includes(t), text, timeout);
  const waitIdle = () => sleep(1500);
  // Smallest element that holds a whole approval card (buttons and details)
  const cardText = () =>
    page.$$eval(
      "div",
      (els) =>
        els
          .filter(
            (e) =>
              e.innerText.includes("Annehmen") &&
              e.innerText.includes("Ablehnen") &&
              e.querySelector("dl")
          )
          .map((e) => e.innerText)
          .sort((a, b) => a.length - b.length)[0] ?? ""
    );

  const reweId = psql(
    "select id from daily_expenses where description='Rewe Wocheneinkauf' order by date desc limit 1"
  );
  await fakeState({ reweId });
  const reweDate = psql(
    `select to_char(date, 'DD.MM.YYYY') from daily_expenses where id='${reweId}'`
  );
  const reweAmount = psql(
    `select replace(to_char(amount, 'FM999990.00'), '.', ',') from daily_expenses where id='${reweId}'`
  );
  await page.goto(`${B}/assistant`, { waitUntil: "networkidle0" });
  await sleep(1500);
  const conversationId = latestConversation();
  const expensesBefore = Number(psql("select count(*) from daily_expenses"));

  // 1. Create with approval: card shows account, category, amount; stored once after approval
  await send("buche REWE");
  await waitText("Annehmen");
  await sleep(800);
  let card = await cardText();
  check(
    "create card shows account and category names",
    card.includes("Hauptkonto") && card.includes("Lebensmittel"),
    card
  );
  check("create card shows amount with currency", /45,00\s*€/.test(card), card);
  await clickText(page, "button", "Annehmen");
  await waitText("Erledigt.");
  await waitIdle();
  check(
    "approved expense is booked",
    Number(psql("select count(*) from daily_expenses")) === expensesBefore + 1
  );
  let saved = savedMessages(conversationId);
  check(
    "turn stored once: user + one assistant message with the tool line",
    saved ===
      "user: buche REWE || assistant: Ich buche das: Erledigt. /  / ✓ Ausgabe erfassen (REWE, 45)",
    saved
  );

  // 2. Delete card names the entry; deny keeps it and stores the denial
  await send("lösche Rewe");
  await waitText("Annehmen");
  await sleep(1000);
  card = await cardText();
  check(
    "delete card shows the entry, amount and date",
    card.includes("Rewe Wocheneinkauf") &&
      new RegExp(`${reweAmount}\\s*€`).test(card) &&
      card.includes(reweDate),
    card
  );
  await clickText(page, "button", "Ablehnen");
  await waitFor(() => !document.body.innerText.includes("Annehmen"), null);
  await waitIdle();
  check(
    "denied delete keeps the entry",
    psql(`select count(*) from daily_expenses where id='${reweId}'`) === "1"
  );
  saved = savedMessages(conversationId);
  check(
    "denial is stored",
    saved.includes("user: lösche Rewe || assistant:") &&
      saved.includes("✗ Abgelehnt: Ausgabe löschen"),
    saved
  );

  // 3. Update card shows old → new
  await send("ändere Betrag");
  await waitText("Annehmen");
  await sleep(1000);
  card = await cardText();
  check(
    "update card shows old → new amount",
    new RegExp(`${reweAmount}\\s*€\\s*→\\s*70,00\\s*€`).test(card) &&
      card.includes("Rewe Wocheneinkauf"),
    card
  );
  await clickText(page, "button", "Ablehnen");
  await waitIdle();
  await sleep(1500);

  // 4. Transfer card layout
  await send("transfer");
  await waitText("Annehmen");
  await sleep(1000);
  card = await cardText();
  check(
    "transfer card shows both accounts and amount",
    card.includes("Transfer erstellen") &&
      card.includes("Hauptkonto") &&
      card.includes("Notgroschen") &&
      /200,00\s*€/.test(card),
    card
  );
  await clickText(page, "button", "Ablehnen");
  await waitIdle();
  await sleep(1500);

  // 5. Amount filter reaches the action
  await send("über 70");
  await waitText("Gefunden:");
  await waitIdle();
  const expected = psql("select count(*) from daily_expenses where amount >= 70");
  const shown = (await bodyText(page)).match(/Gefunden: (\d+)/g)?.at(-1);
  check(
    "minAmount filters the daily expenses",
    shown === `Gefunden: ${expected}`,
    `${shown} vs DB ${expected}`
  );

  // 6. Learned merchant category reaches the system prompt
  const lastRequest = (await fakeLog()).filter((l) => l.body.stream).at(-1);
  const system = JSON.stringify(lastRequest.body.input?.[0] ?? lastRequest.body.instructions ?? "");
  check(
    "system prompt lists the learned category",
    system.includes("Gelernte Kategorien") && system.includes('\\"rewe\\" → \\"Lebensmittel\\"'),
    system.match(/Gelernte Kategorien.{0,120}/)?.[0] ?? "missing"
  );

  // 7. Error, then retry: user message shown and stored once
  const before = savedMessages(conversationId);
  await send("fehler bitte");
  check("error is shown", await waitText("Ein Fehler ist aufgetreten", 30000));
  await waitIdle();
  check(
    "failed turn is not stored",
    savedMessages(conversationId) === before,
    savedMessages(conversationId).slice(before.length)
  );
  await clickText(page, "button", "Wiederholen");
  await waitText("Antwort auf: fehler bitte");
  await waitIdle();
  const userBubbles = (await bodyText(page)).split("fehler bitte").length - 1;
  check(
    "retry does not duplicate the user message on screen",
    userBubbles === 2,
    `occurrences=${userBubbles}`
  ); // bubble + answer text
  saved = savedMessages(conversationId);
  check(
    "retry stores the turn once",
    saved.split("user: fehler bitte").length === 2 &&
      saved.endsWith("assistant: Antwort auf: fehler bitte"),
    saved.slice(-160)
  );

  // 8. Switching to a new chat mid-stream stores nothing in either conversation
  const beforeSwitch = savedMessages(conversationId);
  await send("langsam");
  await sleep(1200);
  await page.$$eval('button[aria-label="Neuer Chat"]', (els) =>
    els.find((e) => e.offsetParent !== null)?.click()
  );
  await sleep(6000);
  const newConversation = latestConversation();
  check("new chat started", newConversation !== conversationId);
  check(
    "aborted answer not stored in the old chat",
    savedMessages(conversationId) === beforeSwitch,
    savedMessages(conversationId).slice(-120)
  );
  check("nothing stored in the new chat", savedMessages(newConversation) === "");
  check("new chat shows no old messages", !(await bodyText(page)).includes("Das dauert etwas"));

  // 9. Mini chat on the dashboard can approve
  await page.goto(`${B}/dashboard`, { waitUntil: "networkidle0" });
  const countBefore = Number(psql("select count(*) from daily_expenses"));
  await page.click('button[aria-label="Chat öffnen"]');
  await sleep(500);
  await page.type("input[placeholder=\"z.B. '45€ REWE'\"]", "buche REWE");
  await page.keyboard.press("Enter");
  await waitText("Annehmen");
  await sleep(800);
  const enabled = await page.$$eval(
    "button",
    (els) => els.find((e) => e.innerText.includes("Annehmen"))?.disabled === false
  );
  check("mini chat approval buttons are enabled", enabled);
  await clickText(page, "button", "Annehmen");
  await waitText("Erledigt.");
  await sleep(1000);
  check(
    "mini chat approval books the expense",
    Number(psql("select count(*) from daily_expenses")) === countBefore + 1
  );

  // "Today" in the prompt follows the browser's time zone
  for (const zone of ["Pacific/Kiritimati", "America/Los_Angeles"]) {
    const z = await newPage({ timezone: zone });
    await login(z.page);
    await z.page.goto(`${B}/assistant`, { waitUntil: "networkidle0" });
    await sleep(800);
    await z.page.click('textarea[aria-label="Chat-Nachricht eingeben"]');
    await z.page.type('textarea[aria-label="Chat-Nachricht eingeben"]', `Datum ${zone}`);
    await z.page.keyboard.press("Enter");
    await sleep(2500);
    const req = (await fakeLog())
      .filter((l) => l.body.stream && JSON.stringify(l.body).includes(`Datum ${zone}`))
      .at(-1);
    const expected = new Date().toLocaleDateString("en-CA", { timeZone: zone });
    check(
      `system prompt uses the day in ${zone}`,
      JSON.stringify(req?.body ?? "").includes(expected),
      expected
    );
    await z.context.close();
  }
  await context.close();
}
