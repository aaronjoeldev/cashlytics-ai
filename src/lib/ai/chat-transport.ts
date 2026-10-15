import { DefaultChatTransport } from "ai";

/** Header with the browser's IANA time zone, so the chat route knows the user's "today". */
export const TIME_ZONE_HEADER = "X-Time-Zone";

/** Shared transport for every `useChat` caller; the header is read when a request is sent. */
export const chatTransport = new DefaultChatTransport({
  api: "/api/chat",
  headers: (): Record<string, string> => ({
    [TIME_ZONE_HEADER]: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }),
});

/** The time zone from the request header if the runtime knows it, otherwise undefined. */
export function parseTimeZone(value: string | null): string | undefined {
  if (!value || value.length > 64) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return value;
  } catch {
    return undefined;
  }
}
