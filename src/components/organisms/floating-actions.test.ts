import assert from "node:assert/strict";
import test from "node:test";
import { getFloatingActions } from "./floating-actions";

const LABELS = {
  expense: "Expense",
  income: "Income",
  transfer: "Transfer",
  account: "Account",
  import: "CSV Import",
  scan: "Scan",
} as const;

test("getFloatingActions hides CSV import when AI is disabled", () => {
  const actions = getFloatingActions(false, LABELS);

  assert.equal(
    actions.some((action) => action.key === "import"),
    false
  );
});

test("getFloatingActions shows CSV import when AI is enabled", () => {
  const actions = getFloatingActions(true, LABELS);

  assert.equal(
    actions.some((action) => action.key === "import"),
    true
  );
});
