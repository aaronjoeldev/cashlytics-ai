// Registration, e-mail case, password reset through the mail link, sessions, limits (PR 1, 3, 4, 12, 14)
import {
  B,
  DEMO,
  bodyText,
  check,
  clearMails,
  forgetSession,
  goto,
  login,
  loginForm,
  mailText,
  mails,
  newPage,
  psql,
  sleep,
  waitText,
} from "./lib.mjs";

export const ERIKA = { email: "erika@example.de", password: "Erika-Pass-2026" };

async function register(page, email, password, confirm = password) {
  await goto(page, "/register");
  await page.type("#email", email);
  await page.type("#password", password);
  await page.type("#confirmPassword", confirm);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0", timeout: 8000 }).catch(() => {}),
    page.keyboard.press("Enter"),
  ]);
  await sleep(800);
}
async function waitMail(predicate, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const found = (await mails()).filter(predicate);
    if (found.length) return found;
    await sleep(500);
  }
  return [];
}

export async function auth() {
  await clearMails();

  // Registration stores the address in lower case, signs in and sends a welcome mail
  {
    const { page, context } = await newPage();
    await register(page, "Erika@Example.DE", ERIKA.password);
    check(
      "registration signs the new user in",
      !page.url().includes("/register") && !page.url().includes("/login"),
      page.url()
    );
    check(
      "registered address is stored in lower case",
      psql("select email from users where lower(email)='erika@example.de'") === "erika@example.de"
    );
    const welcome = await waitMail((m) => m.To?.some((t) => t.Address === "erika@example.de"));
    check(
      "welcome mail is delivered",
      welcome.length === 1,
      JSON.stringify(welcome.map((m) => m.Subject))
    );
    await context.close();
  }

  // Duplicate in another case is refused with a translated message; nothing is created
  {
    const { page, context } = await newPage();
    await register(page, "DEMO@Cashlytics.Online", "abcdefgh1");
    check(
      "duplicate address in other case is refused",
      (await bodyText(page)).includes("Für diese E-Mail-Adresse gibt es bereits ein Konto.")
    );
    check(
      "no second demo account",
      psql("select count(*) from users where lower(email)='demo@cashlytics.online'") === "1"
    );
    await register(page, "neu@example.de", "abcdefgh1", "abcdefgh2");
    check(
      "password mismatch is reported in German",
      (await bodyText(page)).includes("Die Passwörter stimmen nicht überein.")
    );
    await context.close();
  }

  // Login with a mixed-case address
  {
    const { page, context } = await newPage();
    const ok = await loginForm(page, "ERIKA@example.De", ERIKA.password);
    check("login with a mixed-case address works", ok, page.url());
    await context.close();
  }

  // Password reset: link host, confirmation, other sessions end, token works once
  {
    const signedIn = await newPage();
    check("demo session for the reset test", await login(signedIn.page, ERIKA));

    const { page, context } = await newPage();
    await goto(page, "/forgot-password");
    await page.type("#email", "erika@example.de");
    await page.keyboard.press("Enter");
    check(
      "forgot password shows the confirmation on the page",
      await waitText(page, "E-Mail unterwegs")
    );
    check("forgot password does not redirect", page.url().includes("/forgot-password"), page.url());
    const resetMails = await waitMail(
      (m) =>
        m.To?.some((t) => t.Address === "erika@example.de") &&
        /passwort|password|reset/i.test(m.Subject)
    );
    check(
      "reset mail is delivered",
      resetMails.length >= 1,
      JSON.stringify((await mails()).map((m) => m.Subject))
    );
    const { text, html } = await mailText(resetMails[0]?.ID);
    const link = (text + html).match(
      /https?:\/\/[^\s"'<>]+reset-password\?token=[A-Za-z0-9_-]+/
    )?.[0];
    check(
      "reset link uses the configured app URL",
      link?.startsWith("http://localhost:3100/reset-password?token="),
      link
    );

    await page.goto(link, { waitUntil: "networkidle0" });
    await page.type("#password", "Neues-Passwort-2026");
    await page.type("#confirmPassword", "Neues-Passwort-2026");
    await page.keyboard.press("Enter");
    await page
      .waitForFunction(() => location.pathname === "/login", { timeout: 10000 })
      .catch(() => {});
    check("reset succeeds and leads to the login page", page.url().includes("/login"), page.url());

    await signedIn.page.goto(`${B}/dashboard`, { waitUntil: "networkidle0" });
    check(
      "the other session is ended after the reset",
      signedIn.page.url().includes("/login"),
      signedIn.page.url()
    );
    await signedIn.context.close();
    forgetSession(ERIKA.email);

    await page.goto(link, { waitUntil: "networkidle0" });
    await page.type("#password", "Noch-Ein-Pass-1");
    await page.type("#confirmPassword", "Noch-Ein-Pass-1");
    await page.keyboard.press("Enter");
    check("a used reset link is rejected", await waitText(page, "ungültig oder abgelaufen"));
    ERIKA.password = "Neues-Passwort-2026";
    check("login with the new password works", await loginForm(page, ERIKA.email, ERIKA.password));
    await context.close();
  }

  // Reset mails: at most 3 per hour per address, response stays identical
  {
    await clearMails();
    const { page, context } = await newPage();
    for (let i = 0; i < 4; i++) {
      await goto(page, "/forgot-password");
      await page.type("#email", DEMO.email);
      await page.keyboard.press("Enter");
      check(
        `reset request ${i + 1} shows the same confirmation`,
        await waitText(page, "Falls ein Konto mit dieser E-Mail-Adresse existiert")
      );
    }
    await sleep(3000);
    const demoMails = (await mails()).filter((m) => m.To?.some((t) => t.Address === DEMO.email));
    check("only 3 reset mails per hour are sent", demoMails.length === 3, demoMails.length);
    await clearMails();
    await goto(page, "/forgot-password");
    await page.type("#email", "niemand@example.de");
    await page.keyboard.press("Enter");
    check(
      "unknown address gets the same confirmation",
      await waitText(page, "Falls ein Konto mit dieser E-Mail-Adresse existiert")
    );
    await sleep(2000);
    check("no mail for an unknown address", (await mails()).length === 0);
    await context.close();
  }

  // Login lock after 10 attempts (throwaway account)
  {
    const { page, context } = await newPage();
    await register(page, "sperre@example.de", "Sperre-Pass-1");
    await context.close();
    const p2 = await newPage();
    for (let i = 0; i < 10; i++) await loginForm(p2.page, "sperre@example.de", "falsch-falsch-1");
    const lockedOut = !(await loginForm(p2.page, "sperre@example.de", "Sperre-Pass-1"));
    check("the 11th attempt is refused even with the right password", lockedOut);
    check(
      "lock message is the generic login error",
      (await bodyText(p2.page)).includes("E-Mail oder Passwort ist falsch.")
    );
    await p2.context.close();
  }

  // Registration limit: 5 per hour per client address (3 used above, the refused duplicate counts too)
  {
    const { page, context } = await newPage();
    let limited = false;
    for (let i = 0; i < 4 && !limited; i++) {
      await register(page, `limit${i}@example.de`, "Limit-Pass-1");
      limited = (await bodyText(page)).includes("Zu viele Registrierungsversuche");
      await context.deleteCookie?.();
      await page.deleteCookie(...(await page.cookies()));
    }
    check("registration is throttled per client address", limited);
    await context.close();
  }
}
