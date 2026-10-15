import assert from "node:assert/strict";
import test from "node:test";
import de from "../../messages/de.json";
import en from "../../messages/en.json";

function keysOf(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keysOf(child, prefix ? `${prefix}.${key}` : key)
  );
}

test("German and English translations have the same keys", () => {
  const germanKeys = new Set(keysOf(de));
  const englishKeys = new Set(keysOf(en));
  assert.deepEqual(
    [...germanKeys].filter((key) => !englishKeys.has(key)),
    [],
    "missing in en.json"
  );
  assert.deepEqual(
    [...englishKeys].filter((key) => !germanKeys.has(key)),
    [],
    "missing in de.json"
  );
});
