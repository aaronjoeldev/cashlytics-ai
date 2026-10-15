import assert from "node:assert/strict";
import test from "node:test";
import type { UIMessage } from "ai";
import { collectTurnToSave } from "./chat-history";
import { summarizeToolActivity } from "./tool-labels";

const user = (id: string, text: string): UIMessage => ({
  id,
  role: "user",
  parts: [{ type: "text", text }],
});

function assistant(id: string, parts: unknown[]): UIMessage {
  return { id, role: "assistant", parts } as UIMessage;
}

const toolPart = (state: string, extra: Record<string, unknown> = {}) => ({
  type: "tool-createDailyExpense",
  toolCallId: "call-1",
  state,
  input: { description: "REWE", amount: 45 },
  ...extra,
});

test("a turn waiting for approval is not stored yet", () => {
  const answer = assistant("a1", [
    { type: "text", text: "Soll ich das buchen?" },
    toolPart("approval-requested", { approval: { id: "ap-1" } }),
  ]);

  assert.equal(collectTurnToSave(answer, [user("u1", "45€ REWE"), answer], new Set()), null);
});

test("after approval the turn is stored once with the tool result", () => {
  const answer = assistant("a1", [
    { type: "text", text: "Soll ich das buchen?" },
    toolPart("output-available", { output: { success: true } }),
    { type: "text", text: "Erledigt." },
  ]);
  const messages = [user("u1", "45€ REWE"), answer];

  const turn = collectTurnToSave(answer, messages, new Set());
  assert.equal(turn?.user?.id, "u1");
  assert.deepEqual(turn?.assistantIds, ["a1"]);
  assert.equal(
    turn?.assistantContent,
    "Soll ich das buchen?Erledigt.\n\n✓ Ausgabe erfassen (REWE, 45)"
  );

  // A second finish for the same turn stores nothing new
  const again = collectTurnToSave(answer, messages, new Set(["u1", "a1"]));
  assert.equal(again?.user, null);
  assert.equal(again?.assistantContent, "");
});

test("an answer split over two assistant messages is stored together", () => {
  const first = assistant("a1", [
    { type: "text", text: "Ich buche das." },
    toolPart("output-denied"),
  ]);
  const second = assistant("a2", [{ type: "text", text: "Okay, nicht gebucht." }]);

  const turn = collectTurnToSave(second, [user("u1", "45€ REWE"), first, second], new Set());
  assert.deepEqual(turn?.assistantIds, ["a1", "a2"]);
  assert.equal(
    turn?.assistantContent,
    "Ich buche das.\n\n✗ Abgelehnt: Ausgabe erfassen (REWE, 45)\n\nOkay, nicht gebucht."
  );
});

test("only the latest turn is collected, earlier stored messages are skipped", () => {
  const messages = [
    user("u1", "Hallo"),
    assistant("a1", [{ type: "text", text: "Hi" }]),
    user("u2", "Und jetzt?"),
    assistant("a2", [{ type: "text", text: "Weiter" }]),
  ];

  const turn = collectTurnToSave(messages[3], messages, new Set(["u1", "a1"]));
  assert.equal(turn?.user?.id, "u2");
  assert.deepEqual(turn?.assistantIds, ["a2"]);
});

test("summarizeToolActivity lists changes, failures and denials but no reads", () => {
  const summary = summarizeToolActivity([
    { type: "text" },
    { type: "tool-getAccounts", state: "output-available", output: { success: true } },
    {
      type: "tool-deleteDailyExpense",
      state: "output-available",
      input: { id: "x" },
      output: { success: false, error: "nicht gefunden" },
    },
    { type: "tool-createIncome", state: "output-error", input: { source: "Gehalt", amount: 3000 } },
    { type: "tool-createCategory", state: "approval-requested", input: { name: "Neu" } },
  ]);

  assert.equal(
    summary,
    "⚠ Fehlgeschlagen: Ausgabe löschen\n⚠ Fehlgeschlagen: Einnahme erfassen (Gehalt, 3000)"
  );
});
