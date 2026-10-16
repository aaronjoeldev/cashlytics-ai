import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const dir = path.join(process.cwd(), "messages");
const locales = readdirSync(dir).filter((file) => file.endsWith(".json"));

type Messages = { [key: string]: string | Messages };
const keys = (messages: Messages, prefix = ""): string[] =>
  Object.entries(messages).flatMap(([key, value]) =>
    typeof value === "string" ? [prefix + key] : keys(value, `${prefix}${key}.`)
  );
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();

const load = (file: string) => JSON.parse(readFileSync(path.join(dir, file), "utf8")) as Messages;
const lookup = (messages: Messages, key: string) =>
  key
    .split(".")
    .reduce<string | Messages>((node, part) => (node as Messages)[part], messages) as string;

test("every locale has the same message keys", () => {
  const [first, ...rest] = locales;
  const expected = keys(load(first)).sort();
  for (const file of rest) {
    const actual = keys(load(file)).sort();
    assert.deepEqual(
      actual.filter((key) => !expected.includes(key)),
      [],
      `${file} has keys that ${first} lacks`
    );
    assert.deepEqual(
      expected.filter((key) => !actual.includes(key)),
      [],
      `${file} lacks keys of ${first}`
    );
  }
});

test("translations use the same placeholders", () => {
  const [first, ...rest] = locales;
  const base = load(first);
  for (const file of rest) {
    const other = load(file);
    for (const key of keys(base)) {
      assert.deepEqual(
        placeholders(lookup(other, key)),
        placeholders(lookup(base, key)),
        `${file}: placeholders of "${key}" differ from ${first}`
      );
    }
  }
});
