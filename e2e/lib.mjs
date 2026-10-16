// Shared helpers for the e2e suites: results, database and container access, browser.
import puppeteer from "puppeteer-core";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const B = "http://localhost:3100";
export const MAIL = "http://localhost:18025";
export const FAKE = "http://localhost:14011";
export const E2E = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.dirname(E2E);
export const FIXTURES = path.join(E2E, "fixtures");
/** Scratch directory for files the suites generate (CSV with current dates). */
export const TMP = mkdtempSync(path.join(tmpdir(), "cashlytics-e2e-"));
export const env = (name) =>
  readFileSync(path.join(E2E, ".env"), "utf8").match(new RegExp(`^${name}=(.*)$`, "m"))?.[1];
export const DEMO = { email: "demo@cashlytics.online", password: "admin123456789" };
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Results ──────────────────────────────────────────────────────────────────
export const results = [];
let currentSection = "";
export function section(name) {
  currentSection = name;
  console.log(`\n=== ${name}`);
}
export function check(label, ok, detail = "") {
  results.push({ section: currentSection, label, ok: Boolean(ok) });
  const info = !ok && detail ? "  -> " + String(detail).replace(/\s+/g, " ").slice(0, 300) : "";
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${info}`);
}
export async function run(name, fn) {
  section(name);
  try {
    let timer;
    await Promise.race([
      fn(),
      new Promise(
        (_, reject) =>
          (timer = setTimeout(
            () => reject(new Error(`${name} timed out after 8 minutes`)),
            8 * 60_000
          ))
      ),
    ]).finally(() => clearTimeout(timer));
  } catch (error) {
    check(`${name}: section finished without exception`, false, error.stack ?? String(error));
  }
}
export function summary() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  for (const f of failed) console.log(`  FAIL [${f.section}] ${f.label}`);
  return failed.length;
}

// ── Database and containers ──────────────────────────────────────────────────
const PG = "cashlytics-e2e-postgres-1";
export function psql(query) {
  return execFileSync("docker", [
    "exec",
    "-i",
    PG,
    "psql",
    "-U",
    "cashlytics",
    "-d",
    "cashlytics",
    "-At",
    "-q",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    query,
  ])
    .toString()
    .trim();
}
export function psqlFile(path) {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      PG,
      "psql",
      "-U",
      "cashlytics",
      "-d",
      "cashlytics",
      "-q",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    {
      input: readFileSync(path),
      stdio: ["pipe", "pipe", "pipe"],
    }
  ).toString();
}
export function docker(...args) {
  return execFileSync("docker", args, { stdio: ["ignore", "pipe", "pipe"] }).toString();
}
export const demoUserId = () => psql(`select id from users where email='${DEMO.email}'`);

// ── Mailpit and fake OpenAI ──────────────────────────────────────────────────
export async function mails() {
  const res = await fetch(`${MAIL}/api/v1/messages?limit=200`);
  return (await res.json()).messages ?? [];
}
export async function mailText(id) {
  const res = await fetch(`${MAIL}/api/v1/message/${id}`);
  const m = await res.json();
  return {
    text: m.Text ?? "",
    html: m.HTML ?? "",
    subject: m.Subject,
    to: m.To?.map((t) => t.Address),
  };
}
export const clearMails = () => fetch(`${MAIL}/api/v1/messages`, { method: "DELETE" });
export const fakeState = (state) =>
  fetch(`${FAKE}/__state`, { method: "POST", body: JSON.stringify(state) }).then((r) => r.json());
export const fakeReset = () => fetch(`${FAKE}/__reset`, { method: "POST" });
export const fakeLog = () => fetch(`${FAKE}/__log`).then((r) => r.json());

// ── Server actions (ids from the image's manifest) ───────────────────────────
let manifest;
export function actionId(name) {
  if (!manifest) {
    manifest = JSON.parse(
      docker(
        "exec",
        "cashlytics-e2e-app-1",
        "cat",
        "/app/.next/server/server-reference-manifest.json"
      )
    );
  }
  return Object.entries(manifest.node).find(([, v]) => v.exportedName === name)?.[0];
}
/** Calls a server action the way the browser does; returns the decoded result. */
export async function callAction(cookieHeader, name, args, path = "/dashboard") {
  const id = actionId(name);
  if (!id) throw new Error(`no action ${name}`);
  const res = await fetch(`${B}${path}`, {
    method: "POST",
    headers: {
      "Next-Action": id,
      Origin: B,
      Cookie: cookieHeader,
      "Content-Type": "text/plain;charset=UTF-8",
      Accept: "text/x-component",
    },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  const line = text.split("\n").find((l) => l.startsWith("1:"));
  try {
    return line ? JSON.parse(line.slice(2)) : { raw: text.slice(0, 300), status: res.status };
  } catch {
    return { raw: line.slice(0, 300), status: res.status };
  }
}

// ── Browser ──────────────────────────────────────────────────────────────────
const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];
const executablePath = process.env.CHROME_PATH ?? CHROME_CANDIDATES.find((p) => existsSync(p));
if (!executablePath)
  throw new Error("No Chrome found. Set CHROME_PATH to a Chrome or Chromium binary.");

export const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ["--lang=de-DE", ...(process.env.CI ? ["--no-sandbox"] : [])],
});
export const consoleErrors = [];

export async function newPage({ timezone = "Europe/Berlin", width = 1280 } = {}) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width, height: 900 });
  await page.emulateTimezone(timezone);
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push({ url: page.url(), text: m.text() });
  });
  page.on("pageerror", (e) => consoleErrors.push({ url: page.url(), text: String(e) }));
  page.setDefaultTimeout(20000);
  return { page, context };
}

// Every login attempt counts against the 10-per-15-minutes limit, so sessions are reused
const sessions = new Map();
export function forgetSession(email) {
  sessions.delete(email.toLowerCase());
}
export async function loginForm(page, email, password) {
  await page.goto(`${B}/login`, { waitUntil: "networkidle0" });
  await page.type('input[type="email"]', email);
  await page.type('input[type="password"]', password);
  await page.keyboard.press("Enter");
  // Success navigates away; a refused login shows the error box instead
  await page
    .waitForFunction(
      () => location.pathname !== "/login" || document.querySelector(".text-destructive"),
      { timeout: 15000 }
    )
    .catch(() => {});
  await page.waitForNetworkIdle({ idleTime: 300, timeout: 10000 }).catch(() => {});
  return !page.url().includes("/login");
}
export async function login(page, { email, password } = DEMO) {
  const key = email.toLowerCase();
  if (sessions.has(key)) {
    await page.setCookie(...sessions.get(key));
    await page.goto(`${B}/dashboard`, { waitUntil: "networkidle0" });
    if (!page.url().includes("/login") && !page.url().includes("session-expired")) return true;
    sessions.delete(key);
  }
  const ok = await loginForm(page, email, password);
  if (ok)
    sessions.set(
      key,
      (await page.cookies()).filter((c) => c.name.includes("authjs"))
    );
  return ok;
}
export async function cookieHeader(page) {
  return (await page.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
}

export const bodyText = (page) => page.$eval("body", (e) => e.innerText);
export const waitText = (page, t, timeout = 15000) =>
  page
    .waitForFunction((x) => document.body.innerText.includes(x), { timeout }, t)
    .then(
      () => true,
      () => false
    );
export async function clickText(page, selector, text) {
  const handles = await page.$$(selector);
  for (const h of handles) {
    const t = await h.evaluate((e) => e.textContent?.trim());
    const visible = await h.evaluate(
      (e) => e.offsetParent !== null || getComputedStyle(e).position === "fixed"
    );
    if (t && t.includes(text) && visible) {
      await h.click();
      return true;
    }
  }
  return false;
}
/** Picks an option of the combobox whose current text contains `current`. */
export async function selectOption(page, scope, current, option) {
  for (const c of await page.$$(`${scope} [role="combobox"]`)) {
    const t = await c.evaluate((e) => e.innerText);
    if (t.includes(current)) {
      await c.click();
      await sleep(300);
      const ok = await clickText(page, '[role="option"]', option);
      await sleep(300);
      return ok;
    }
  }
  return false;
}
export async function goto(page, path) {
  await page.goto(`${B}${path}`, { waitUntil: "networkidle0" });
  await sleep(400);
}

/** Clicks the icon button (e.g. "lucide-pencil") in the smallest container that contains `text`. */
export async function clickRowIcon(page, text, icon) {
  const marked = await page.$$eval(
    "button",
    (els, [text, icon]) => {
      let best = null;
      for (const b of els) {
        if (!b.querySelector(`svg.${icon}`)) continue;
        let el = b.parentElement;
        while (el && !el.innerText.includes(text)) el = el.parentElement;
        if (el && (!best || el.innerText.length < best.len)) best = { b, len: el.innerText.length };
      }
      if (!best) return false;
      document
        .querySelectorAll("[data-e2e-target]")
        .forEach((e) => e.removeAttribute("data-e2e-target"));
      best.b.setAttribute("data-e2e-target", "1");
      return true;
    },
    [text, icon]
  );
  if (marked) await page.click("[data-e2e-target]");
  return marked;
}
export const dialogDates = (page) =>
  page.$$eval('[role="dialog"] input[type="date"]', (els) => els.map((e) => e.value));
export async function typeInto(page, selector, value) {
  await page.$eval(selector, (e) => {
    e.focus();
    e.select?.();
  });
  await page.click(selector, { clickCount: 3 });
  await page.keyboard.press("Backspace");
  await page.type(selector, value);
}
export async function setDate(page, index, iso) {
  const inputs = await page.$$('[role="dialog"] input[type="date"]');
  await inputs[index].evaluate((e, v) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(e, v);
    e.dispatchEvent(new Event("input", { bubbles: true }));
    e.dispatchEvent(new Event("change", { bubbles: true }));
  }, iso);
}
export const toastText = (page) =>
  page
    .$$eval("[data-sonner-toast], [role='status'], li[role='status']", (els) =>
      els.map((e) => e.innerText).join(" | ")
    )
    .catch(() => "");
export const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
