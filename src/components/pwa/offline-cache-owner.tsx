"use client";

import { useEffect } from "react";
import { clearOfflineUserData, setOfflineCacheUser } from "@/lib/pwa/offline-cache";

/**
 * Binds the offline copies to the signed-in user. Without a user (login, registration and
 * password pages) it removes them, which covers logout, expired sessions and password resets.
 */
export function OfflineCacheOwner({ userId }: { userId: string | null }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;

    if (userId) {
      setOfflineCacheUser(userId).catch((err) => console.error("[SW] SET_USER failed:", err));
    } else {
      clearOfflineUserData();
    }
  }, [userId]);

  return null;
}
