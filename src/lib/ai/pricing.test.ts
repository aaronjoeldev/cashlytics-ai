import test from "node:test";
import assert from "node:assert/strict";
import { calculateUsageCostEur } from "@/lib/ai/pricing";

test("calculates gpt-4o input and output costs deterministically", () => {
  const result = calculateUsageCostEur({
    model: "gpt-4o",
    promptTokens: 1_000,
    completionTokens: 500,
  });

  assert.equal(result.inputCostEur, "0.004600");
  assert.equal(result.outputCostEur, "0.006900");
  assert.equal(result.totalCostEur, "0.011500");
});

test("rounds to nearest micro-eur for tiny requests", () => {
  const result = calculateUsageCostEur({
    model: "gpt-4o-mini",
    promptTokens: 1,
    completionTokens: 1,
  });

  assert.equal(result.inputCostEur, "0.000000");
  assert.equal(result.outputCostEur, "0.000001");
  assert.equal(result.totalCostEur, "0.000001");
});

test("throws for unsupported model", () => {
  assert.throws(() =>
    calculateUsageCostEur({
      model: "unknown-model",
      promptTokens: 1,
      completionTokens: 1,
    })
  );
});
