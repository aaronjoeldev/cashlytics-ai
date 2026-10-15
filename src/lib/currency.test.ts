import assert from "node:assert/strict";
import test from "node:test";
import { convertCurrency, exchangeRates, toBaseCurrency, type ExchangeRateTable } from "./currency";

const live: ExchangeRateTable = { ...exchangeRates, USD: 1.25, GBP: 0.8 };

test("conversion uses the given rates instead of the fallback table", () => {
  assert.equal(convertCurrency(125, "USD", "EUR", live), 100);
  assert.equal(convertCurrency(100, "EUR", "GBP", live), 80);
  // USD → GBP goes through EUR: 125 USD = 100 EUR = 80 GBP
  assert.equal(convertCurrency(125, "USD", "GBP", live), 80);
});

test("without rates the fallback table is used", () => {
  assert.equal(convertCurrency(exchangeRates.USD, "USD", "EUR"), 1);
});

test("toBaseCurrency treats unknown and missing currencies as the base currency", () => {
  assert.equal(toBaseCurrency(50, "USD", "EUR", live), 40);
  assert.equal(toBaseCurrency(50, null, "EUR", live), 50);
  assert.equal(toBaseCurrency(50, "XYZ", "USD", live), 50);
  assert.equal(toBaseCurrency(40, "EUR", "USD", live), 50);
});
