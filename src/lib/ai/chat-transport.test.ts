import assert from "node:assert/strict";
import test from "node:test";
import { parseTimeZone } from "./chat-transport";

test("known time zones are accepted, anything else is ignored", () => {
  assert.equal(parseTimeZone("Europe/Berlin"), "Europe/Berlin");
  assert.equal(parseTimeZone("UTC"), "UTC");
  assert.equal(parseTimeZone(null), undefined);
  assert.equal(parseTimeZone(""), undefined);
  assert.equal(parseTimeZone("Mars/Olympus"), undefined);
  assert.equal(parseTimeZone("x".repeat(100)), undefined);
});

test("shortly after midnight in Berlin, the Berlin day is already the next one", () => {
  const now = new Date("2026-10-31T23:30:00Z");
  assert.equal(now.toLocaleDateString("en-CA", { timeZone: "UTC" }), "2026-10-31");
  assert.equal(now.toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" }), "2026-11-01");
});
