// Receipt scanner with the fake AI: prefill, save, currency on the success screen, attach failure (PR 6, 10, 14)
import {
  FIXTURES,
  bodyText,
  check,
  clickText,
  fakeState,
  goto,
  login,
  newPage,
  psql,
  sleep,
  waitText,
} from "./lib.mjs";

export async function scan() {
  const { page, context } = await newPage();
  await login(page);

  async function scanFile(file) {
    await goto(page, "/scan");
    const input = await page.$('input[type="file"]');
    await input.uploadFile(file);
    await page
      .waitForFunction(
        () =>
          document.querySelector("#description") ||
          /Ungültiges Format|zu groß|nicht analysiert/.test(document.body.innerText),
        { timeout: 20000 }
      )
      .catch(() => {});
    await sleep(500);
  }
  const value = (sel) => page.$eval(sel, (e) => e.value).catch(() => null);

  // 1. Prefilled review form, save, receipt attached
  await scanFile(`${FIXTURES}/receipt.png`);
  check("scan prefills the description", (await value("#description")) === "Bäckerei Krume");
  check("scan prefills the amount", (await value("#amount")) === "12.5");
  check("scan suggests the category", (await bodyText(page)).includes("Lebensmittel"));
  await clickText(page, "main button", "Ausgabe speichern");
  check("saving shows the success screen", await waitText(page, "Ausgabe erfasst!"));
  check("success screen shows the amount in euros", /12,50\s€/.test(await bodyText(page)));
  const row = psql(
    "select d.amount || '|' || d.currency || '|' || c.name || '|' || count(doc.id) from daily_expenses d left join categories c on c.id=d.category_id left join documents doc on doc.daily_expense_id=d.id where d.description='Bäckerei Krume' group by d.amount, d.currency, c.name"
  );
  check(
    "expense is stored with category and the receipt attached",
    row === "12.50|EUR|Lebensmittel|1",
    row
  );

  // 2. Foreign currency: success screen uses the chosen currency, exchange rate stored
  await fakeState({
    receipt: {
      merchant: "NYC Deli",
      amount: 9.99,
      date: new Date().toISOString().slice(0, 10),
      currency: "USD",
      description: "Bagel",
      suggestedCategoryName: null,
      confidence: "high",
    },
  });
  await scanFile(`${FIXTURES}/receipt.png`);
  check("scanned currency is preselected", (await bodyText(page)).includes("USD"));
  await clickText(page, "main button", "Ausgabe speichern");
  check("USD receipt is saved", await waitText(page, "Ausgabe erfasst!"));
  check(
    "success screen shows dollars",
    /9,99\s\$/.test(await bodyText(page)),
    (await bodyText(page)).match(/.{0,20}9,99.{0,5}/)?.[0]
  );
  const usd = psql(
    "select currency || '|' || original_amount || '|' || exchange_rate from daily_expenses where description='NYC Deli'"
  );
  check(
    "USD receipt stores currency, original amount and the live rate (1 USD = 0.8 EUR)",
    usd === "USD|9.99|0.800000",
    usd
  );
  await fakeState({ receipt: null });

  // 3. Receipt that cannot be attached: expense saved, warning shown
  psql(
    "create or replace function fail_documents() returns trigger as $$ begin raise exception 'disk full'; end $$ language plpgsql"
  );
  psql(
    "create trigger fail_documents before insert on documents for each row execute function fail_documents()"
  );
  await fakeState({
    receipt: {
      merchant: "Ohne Beleg GmbH",
      amount: 4.2,
      date: new Date().toISOString().slice(0, 10),
      currency: "EUR",
      description: "Test",
      suggestedCategoryName: null,
      confidence: "high",
    },
  });
  await scanFile(`${FIXTURES}/receipt.png`);
  await clickText(page, "main button", "Ausgabe speichern");
  check(
    "missing attachment is reported",
    await waitText(page, "der Beleg konnte nicht angehängt werden")
  );
  check(
    "expense is saved anyway",
    psql("select count(*) from daily_expenses where description='Ohne Beleg GmbH'") === "1"
  );
  psql("drop trigger fail_documents on documents");
  await fakeState({ receipt: null });

  // 4. Unsupported file type is refused before any AI call
  await scanFile(`${FIXTURES}/not-an-image.pdf`);
  check("unsupported file type is refused", (await bodyText(page)).includes("Ungültiges Format"));

  await context.close();
}
