// Offline copies per user in the service worker (PR 4)
import { B, bodyText, check, docker, loginForm, newPage, sleep, forgetSession } from "./lib.mjs";

// Real outage: the server is frozen, so the service worker cannot reach it either
// (page.setOfflineMode does not apply to the service worker's own requests)
const serverDown = () => docker("stop", "-t", "2", "cashlytics-e2e-app-1");
async function serverUp() {
  docker("start", "cashlytics-e2e-app-1");
  for (let i = 0; i < 90; i++) {
    if (
      docker("inspect", "-f", "{{.State.Health.Status}}", "cashlytics-e2e-app-1").trim() ===
      "healthy"
    )
      return;
    await sleep(1000);
  }
}
const gotoOffline = (page, path) =>
  page.goto(`${B}${path}`, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
import { ERIKA } from "./auth.mjs";

const cacheKeys = (page) => page.evaluate(async () => (await caches.keys()).sort());
const userCacheUrls = (page) =>
  page.evaluate(async () => {
    const urls = [];
    for (const key of await caches.keys()) {
      if (!key.startsWith("cashlytics-user-")) continue;
      const cache = await caches.open(key);
      for (const req of await cache.keys()) urls.push(new URL(req.url).pathname);
    }
    return urls;
  });

export async function offline() {
  const { page, context } = await newPage();
  // One context = one browser profile, shared by both users like a family computer
  await loginForm(page, "demo@cashlytics.online", "admin123456789");
  await page
    .waitForFunction(() => navigator.serviceWorker?.controller, { timeout: 15000 })
    .catch(() => {});
  for (const path of ["/dashboard", "/expenses", "/dashboard"]) {
    await page.goto(`${B}${path}`, { waitUntil: "networkidle0" });
    await sleep(800);
  }
  const keys = await cacheKeys(page);
  check(
    "service worker keeps a cache for the signed-in user",
    keys.some((k) => k.startsWith("cashlytics-user-")),
    keys.join(",")
  );
  const urls = await userCacheUrls(page);
  check(
    "visited pages are cached, API responses are not",
    urls.includes("/expenses") && !urls.some((u) => u.startsWith("/api/")),
    urls.join(",")
  );

  serverDown();
  try {
    await gotoOffline(page, "/expenses");
    await sleep(1500);
    check("a visited page is served offline", (await bodyText(page)).includes("Miete"));
    await gotoOffline(page, "/accounts/a0000000-0000-0000-0000-000000000003");
    await sleep(1500);
    const offlinePage = await bodyText(page);
    check(
      "a page that was never loaded shows the offline page",
      /offline/i.test(offlinePage) && !offlinePage.includes("Weltportfolio"),
      offlinePage.slice(0, 200)
    );
    await gotoOffline(page, "/tools");
    await sleep(1500);
    // Prefetching stores only RSC payloads, not pages, so an unvisited sidebar page is offline too
    check(
      "an unvisited sidebar page shows the offline page",
      /offline/i.test(await bodyText(page)) && !(await bodyText(page)).includes("Währungsrechner")
    );
  } finally {
    await serverUp();
  }

  // Logout removes the copies
  await page.goto(`${B}/dashboard`, { waitUntil: "networkidle0" });
  await page.$$eval("button, a", (els) =>
    els.find((e) => e.innerText.trim() === "Sign out" || e.innerText.trim() === "Abmelden")?.click()
  );
  await page
    .waitForFunction(() => location.pathname === "/login", { timeout: 15000 })
    .catch(() => {});
  await sleep(1500);
  check("logout leads to the login page", page.url().includes("/login"), page.url());
  check(
    "logout removes the offline copies",
    (await userCacheUrls(page)).length === 0,
    (await userCacheUrls(page)).join(",")
  );

  // The next user on the same browser never sees the first user's pages
  forgetSession(ERIKA.email);
  await loginForm(page, ERIKA.email, ERIKA.password);
  await page.goto(`${B}/dashboard`, { waitUntil: "networkidle0" });
  await sleep(800);
  serverDown();
  try {
    await gotoOffline(page, "/expenses");
    await sleep(1500);
    check(
      "second user offline never sees the first user's data",
      !(await bodyText(page)).includes("Miete")
    );
  } finally {
    await serverUp();
  }
  await context.close();
}
