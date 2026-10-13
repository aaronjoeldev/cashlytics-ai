// Erhöhen, wenn alte Caches verworfen werden sollen (v1 war nicht an den Nutzer gebunden)
const CACHE_VERSION = 'v2';
const STATIC_CACHE = `cashlytics-static-${CACHE_VERSION}`;
const META_CACHE = `cashlytics-meta-${CACHE_VERSION}`;
// Muss zu USER_CACHE_PREFIX in src/lib/pwa/offline-cache.ts passen
const USER_CACHE_PREFIX = 'cashlytics-user-';
const OFFLINE_URL = '/~offline';
const USER_KEY = '/__sw/current-user';
const CACHED_AT_HEADER = 'x-sw-cached-at';
// Ältere Offline-Kopien werden nicht mehr ausgeliefert (z. B. nach abgelaufener Session)
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Install: Offline-Seite vorhalten
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, '/favicon.ico', '/site.webmanifest']))
      .then(() => self.skipWaiting()),
  );
});

// Activate: Caches früherer Versionen aufräumen
self.addEventListener('activate', (event) => {
  const keep = (key) =>
    key === STATIC_CACHE || key === META_CACHE || key.startsWith(USER_CACHE_PREFIX);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// ---------------------------------------------------------------------------
// Offline-Kopien pro Nutzer
//
// Seiten und RSC-Daten sind nutzerspezifisch. Sie liegen in einem Cache, der die Nutzer-ID im
// Namen trägt, und werden nur für den aktuell angemeldeten Nutzer ausgeliefert. Die Seite
// meldet den Nutzer nach dem Login (SET_USER) und räumt beim Abmelden auf (CLEAR_USER).
// ---------------------------------------------------------------------------

async function getCurrentUser() {
  const meta = await caches.open(META_CACHE);
  const stored = await meta.match(USER_KEY);
  return stored ? stored.text() : null;
}

async function deleteUserCaches(exceptUserId = null) {
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => key.startsWith(USER_CACHE_PREFIX) && key !== USER_CACHE_PREFIX + exceptUserId)
      .map((key) => caches.delete(key)),
  );
}

async function setCurrentUser(userId) {
  const meta = await caches.open(META_CACHE);
  await meta.put(USER_KEY, new Response(userId));
  await deleteUserCaches(userId);
}

async function clearCurrentUser() {
  const meta = await caches.open(META_CACHE);
  await meta.delete(USER_KEY);
  await deleteUserCaches();
}

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'SET_USER' && typeof data.userId === 'string' && data.userId) {
    event.waitUntil(setCurrentUser(data.userId));
  } else if (data.type === 'CLEAR_USER') {
    event.waitUntil(clearCurrentUser());
  }
});

// Fetch: Caching-Strategien nach Route
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Nur GET, nur Same-Origin
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // /_next/static/ — Cache-first (Inhalts-Hash im Dateinamen = immutable)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // API-Antworten (Session, Schlüssel, Kurse) werden nie gespeichert
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/')) return;

  // Seiten und RSC-Daten — Network-first, offline die Kopie des angemeldeten Nutzers
  event.respondWith(networkFirstForUser(request));
});

// Cache-first: aus Cache liefern, bei Miss netzwerken und cachen
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

async function storeForUser(request, response) {
  // Erst nach dem Laden prüfen: während der Anfrage kann abgemeldet worden sein
  const userId = await getCurrentUser();
  if (!userId) return;

  const headers = new Headers(response.headers);
  headers.set(CACHED_AT_HEADER, String(Date.now()));
  const copy = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
  const cache = await caches.open(USER_CACHE_PREFIX + userId);
  await cache.put(request, copy);
}

async function matchForUser(request) {
  const userId = await getCurrentUser();
  if (!userId) return null;

  const cache = await caches.open(USER_CACHE_PREFIX + userId);
  const cached = await cache.match(request);
  if (!cached) return null;

  const cachedAt = Number(cached.headers.get(CACHED_AT_HEADER));
  if (!cachedAt || Date.now() - cachedAt > MAX_AGE_MS) {
    await cache.delete(request);
    return null;
  }
  return cached;
}

// Network-first: Netzwerk bevorzugt, offline die Kopie des Nutzers, sonst die Offline-Seite
async function networkFirstForUser(request) {
  try {
    const response = await fetch(request);
    // Weiterleitungen (z. B. zum Login) und Fehler werden nicht gespeichert
    if (response.ok && !response.redirected) {
      storeForUser(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    const cached = await matchForUser(request);
    if (cached) return cached;

    if (request.mode === 'navigate') {
      const offline = await caches.match(OFFLINE_URL);
      if (offline) return offline;
    }
    return new Response('Offline', { status: 503 });
  }
}

// ---------------------------------------------------------------------------
// Push Notifications
// ---------------------------------------------------------------------------

/**
 * push — Incoming server-sent push message.
 *
 * Expected payload (JSON):
 *   { title, body, icon?, badge?, url? }
 *
 * Falls back to sensible defaults when optional fields are absent.
 */
self.addEventListener('push', (event) => {
  // Guard: nothing to show if no payload was delivered
  if (!event.data) return;

  /** @type {{ title: string, body: string, icon?: string, badge?: string, url?: string }} */
  const { title, body, icon, badge, url } = event.data.json();

  const options = {
    body,
    // Use the provided icon or fall back to the 192 × 192 PWA icon
    icon: icon || '/web-app-manifest-192x192.png',
    // Badge is the small monochrome icon shown in the notification tray
    badge: badge || '/favicon-96x96.png',
    // Attach the target URL so the click handler can navigate to it
    data: { url: url || '/' },
  };

  // Keep the service worker alive until the notification is displayed
  event.waitUntil(self.registration.showNotification(title, options));
});

/**
 * notificationclick — User tapped / clicked a displayed notification.
 *
 * Behaviour:
 *  1. Close the notification immediately.
 *  2. If an app window is already open, focus it and navigate to the URL.
 *  3. Otherwise open a new window at the URL.
 */
self.addEventListener('notificationclick', (event) => {
  // Dismiss the notification banner right away
  event.notification.close();

  // Resolve the destination URL from the notification payload
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    // Find all controlled windows belonging to this origin
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Look for an existing window we can reuse
        for (const client of windowClients) {
          // Same-origin check: only reuse windows on our own origin
          if (new URL(client.url).origin === self.location.origin) {
            // Bring the existing window to the foreground …
            return client.focus().then((focusedClient) => {
              // … and navigate it to the notification's target URL
              if (focusedClient && 'navigate' in focusedClient) {
                return focusedClient.navigate(targetUrl);
              }
            });
          }
        }

        // No suitable window found — open a new one
        return self.clients.openWindow(targetUrl);
      }),
  );
});
