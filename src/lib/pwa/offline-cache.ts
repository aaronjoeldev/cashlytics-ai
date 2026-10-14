/**
 * Client-side control of the per-user offline copies kept by the service worker (public/sw.js).
 * Pages are cached per signed-in user and must not outlive that user's session on the device.
 */

// Must match USER_CACHE_PREFIX in public/sw.js
const USER_CACHE_PREFIX = "cashlytics-user-";

async function postToServiceWorker(message: Record<string, string>): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  registration?.active?.postMessage(message);
}

/** Tells the service worker whose pages it may store and serve offline. */
export async function setOfflineCacheUser(userId: string): Promise<void> {
  const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.ready : null;
  registration?.active?.postMessage({ type: "SET_USER", userId });
}

/**
 * Removes all offline copies. The caches are deleted from the page as well, so this also works
 * when the service worker is not running or the device is offline.
 */
export async function clearOfflineUserData(): Promise<void> {
  try {
    await postToServiceWorker({ type: "CLEAR_USER" });
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key.startsWith(USER_CACHE_PREFIX)).map((key) => caches.delete(key))
      );
    }
  } catch (error) {
    console.error("[SW] Clearing offline data failed:", error);
  }
}
