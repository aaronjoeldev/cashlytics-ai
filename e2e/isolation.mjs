// Data of one user stays invisible and untouchable for another; server-side validation (PR 1, 3, 5, 6)
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
  newPage,
  psql,
} from "./lib.mjs";
import { ERIKA } from "./auth.mjs";

const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export async function isolation() {
  const demoId = demoUserId();
  const erikaId = psql(`select id from users where email='${ERIKA.email}'`);
  const demoExpense = psql(
    `select id from daily_expenses where user_id='${demoId}' and description='Rewe Wocheneinkauf' order by date desc limit 1`
  );
  const demoAccount = "a0000000-0000-0000-0000-000000000001";
  const demoCategory = "c0000000-0000-0000-0000-000000000002";
  const docId = psql(
    `insert into documents (daily_expense_id, file_name, mime_type, size, data, user_id) values ('${demoExpense}', 'demo-beleg.png', 'image/png', 68, '${PNG}', '${demoId}') returning id`
  ).split("\n")[0];

  const erika = await newPage();
  check("second user signs in", await login(erika.page, ERIKA));
  const erikaCookie = await cookieHeader(erika.page);

  await goto(erika.page, "/dashboard");
  const dash = await bodyText(erika.page);
  check(
    "second user's dashboard shows none of the demo data",
    !dash.includes("Miete") && !dash.includes("Rewe") && !dash.includes("Hauptkonto")
  );
  for (const path of ["/expenses", "/income", "/transfers", "/accounts", "/documents"]) {
    await goto(erika.page, path);
    const t = await bodyText(erika.page);
    check(
      `second user sees no demo entries on ${path}`,
      !/Miete|Rewe|Gehalt|Hauptkonto|demo-beleg/.test(t),
      t.match(/.{0,40}(Miete|Rewe|Gehalt|Hauptkonto|demo-beleg).{0,20}/)?.[0]
    );
  }
  const search = await callAction(erikaCookie, "globalSearch", ["Rewe"]);
  check(
    "search of the second user finds no demo entries",
    Array.isArray(search) && search.length === 0,
    JSON.stringify(search).slice(0, 200)
  );

  const docRes = await fetch(`${B}/api/documents/${docId}`, { headers: { Cookie: erikaCookie } });
  check(
    "second user cannot download a demo document",
    docRes.status === 404 || docRes.status === 403,
    docRes.status
  );
  const download = await callAction(erikaCookie, "downloadDocument", [docId]);
  check(
    "document action refuses a foreign document",
    download.success === false,
    JSON.stringify(download).slice(0, 120)
  );

  const before = psql(`select amount from daily_expenses where id='${demoExpense}'`);
  const upd = await callAction(erikaCookie, "updateDailyExpense", [
    demoExpense,
    { amount: "1.00" },
  ]);
  check(
    "updating a foreign expense fails",
    upd.success === false,
    JSON.stringify(upd).slice(0, 160)
  );
  check(
    "foreign expense is unchanged",
    psql(`select amount from daily_expenses where id='${demoExpense}'`) === before
  );
  const del = await callAction(erikaCookie, "deleteDailyExpense", [demoExpense]);
  check(
    "deleting a foreign expense fails",
    del.success === false &&
      psql(`select count(*) from daily_expenses where id='${demoExpense}'`) === "1"
  );
  const foreignAccount = await callAction(erikaCookie, "createDailyExpense", [
    {
      accountId: demoAccount,
      description: "Fremd",
      amount: "5.00",
      date: "2026-10-14",
      currency: "EUR",
    },
  ]);
  check(
    "creating an entry on a foreign account fails",
    foreignAccount.success === false &&
      psql("select count(*) from daily_expenses where description='Fremd'") === "0",
    JSON.stringify(foreignAccount).slice(0, 160)
  );

  // Push subscription moves to the user who subscribed last in the browser
  const endpoint = "https://fcm.googleapis.com/fcm/send/e2e-shared";
  const demo = await newPage();
  await login(demo.page);
  const demoCookie = await cookieHeader(demo.page);
  const sub = (cookie, url = endpoint) =>
    fetch(`${B}/api/push/subscribe`, {
      method: "POST",
      headers: { Cookie: cookie, "content-type": "application/json" },
      body: JSON.stringify({ endpoint: url, p256dh: "p", auth: "a" }),
    });
  await sub(demoCookie);
  await sub(erikaCookie);
  check(
    "push subscription belongs to the user who subscribed last",
    psql(`select user_id from push_subscriptions where endpoint='${endpoint}'`) === erikaId
  );
  psql(`delete from push_subscriptions where endpoint='${endpoint}'`);

  // Only endpoints of known push services are accepted (no SSRF through the reminder job)
  const internalEndpoint = "http://127.0.0.1:5432/e2e";
  const rejected = await sub(demoCookie, internalEndpoint);
  check(
    "push subscription with a non push-service endpoint is rejected",
    rejected.status === 400 &&
      psql(`select count(*) from push_subscriptions where endpoint='${internalEndpoint}'`) === "0",
    `status ${rejected.status}`
  );

  // Validation of direct action calls (as the demo user)
  const reject = async (label, name, args, contains) => {
    const r = await callAction(demoCookie, name, args);
    check(
      label,
      r.success === false && (!contains || contains.test(String(r.error))),
      JSON.stringify(r).slice(0, 200)
    );
  };
  await reject("negative amount is rejected", "createDailyExpense", [
    { accountId: demoAccount, description: "Minus", amount: "-5", date: "2026-10-14" },
  ]);
  await reject("invalid date is rejected", "createDailyExpense", [
    { accountId: demoAccount, description: "Datum", amount: "5", date: "kein-datum" },
  ]);
  await reject("unknown recurrence type is rejected", "createExpense", [
    {
      accountId: demoAccount,
      name: "Typ",
      amount: "5",
      recurrenceType: "hourly",
      startDate: "2026-10-01",
    },
  ]);
  await reject("custom interval 0 is rejected", "createExpense", [
    {
      accountId: demoAccount,
      name: "Intervall",
      amount: "5",
      recurrenceType: "custom",
      recurrenceInterval: 0,
      startDate: "2026-10-01",
    },
  ]);
  await reject(
    "end date before start date is rejected",
    "createExpense",
    [
      {
        accountId: demoAccount,
        name: "Ende",
        amount: "5",
        recurrenceType: "monthly",
        startDate: "2026-10-01",
        endDate: "2026-09-01",
      },
    ],
    /Enddatum/
  );
  await reject("transfer to the same account is rejected", "createTransfer", [
    {
      sourceAccountId: demoAccount,
      targetAccountId: demoAccount,
      amount: "5",
      recurrenceType: "once",
      startDate: "2026-10-01",
    },
  ]);
  await reject("empty update is rejected", "updateDailyExpense", [demoExpense, {}]);
  await reject("overlong category name is rejected", "createCategory", [{ name: "x".repeat(300) }]);
  await reject(
    "deleting an unknown category reports not found",
    "deleteCategory",
    ["00000000-0000-4000-8000-000000000000"],
    /not found|nicht gefunden/i
  );
  const injected = await callAction(demoCookie, "createDailyExpense", [
    {
      accountId: demoAccount,
      categoryId: demoCategory,
      description: "Injektion",
      amount: "5.555",
      date: "2026-10-14",
      userId: erikaId,
      id: "11111111-1111-4111-8111-111111111111",
    },
  ]);
  const stored = psql(
    "select user_id || '|' || (id = '11111111-1111-4111-8111-111111111111') from daily_expenses where description='Injektion'"
  );
  check(
    "injected userId and id are ignored",
    injected.success === true && stored === `${demoId}|false`,
    `${JSON.stringify(injected).slice(0, 100)} ${stored}`
  );
  check(
    "amount 5.555 is rounded half up to 5.56",
    psql("select amount from daily_expenses where description='Injektion'") === "5.56",
    psql("select amount from daily_expenses where description='Injektion'")
  );
  psql("delete from daily_expenses where description='Injektion'");
  check("generateInsights is not callable as a server action", !actionId("generateInsights"));

  psql(`delete from documents where id='${docId}'`);
  await erika.context.close();
  await demo.context.close();
}
