const MICRO_EUR_FACTOR = 1_000_000;
const TOKENS_PER_MILLION = 1_000_000;

export const AI_PRICING_VERSION = "openai-eur-2026-03-02";

type ModelPricing = {
  inputMicroEurPerMillionTokens: number;
  outputMicroEurPerMillionTokens: number;
};

const MODEL_PRICING_TABLE: Record<string, ModelPricing> = {
  "gpt-4o": {
    inputMicroEurPerMillionTokens: 4_600_000,
    outputMicroEurPerMillionTokens: 13_800_000,
  },
  "gpt-4o-mini": {
    inputMicroEurPerMillionTokens: 140_000,
    outputMicroEurPerMillionTokens: 560_000,
  },
};

export type CostCalculationInput = {
  model: string;
  promptTokens: number;
  completionTokens: number;
};

export type CostCalculationResult = {
  pricingVersion: string;
  inputCostEur: string;
  outputCostEur: string;
  totalCostEur: string;
};

function toNonNegativeInteger(value: number): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid token count: ${value}`);
  }

  return value;
}

function calculateMicroEur(tokens: number, microEurPerMillionTokens: number): number {
  const numerator = tokens * microEurPerMillionTokens;

  return Math.round(numerator / TOKENS_PER_MILLION);
}

function microEurToEurString(microEur: number): string {
  const whole = Math.floor(microEur / MICRO_EUR_FACTOR);
  const fractional = (microEur % MICRO_EUR_FACTOR).toString().padStart(6, "0");

  return `${whole}.${fractional}`;
}

export function calculateUsageCostEur(input: CostCalculationInput): CostCalculationResult {
  const pricing = MODEL_PRICING_TABLE[input.model];
  if (!pricing) {
    throw new Error(`Unsupported model for pricing: ${input.model}`);
  }

  const promptTokens = toNonNegativeInteger(input.promptTokens);
  const completionTokens = toNonNegativeInteger(input.completionTokens);

  const inputMicroEur = calculateMicroEur(promptTokens, pricing.inputMicroEurPerMillionTokens);
  const outputMicroEur = calculateMicroEur(
    completionTokens,
    pricing.outputMicroEurPerMillionTokens
  );
  const totalMicroEur = inputMicroEur + outputMicroEur;

  return {
    pricingVersion: AI_PRICING_VERSION,
    inputCostEur: microEurToEurString(inputMicroEur),
    outputCostEur: microEurToEurString(outputMicroEur),
    totalCostEur: microEurToEurString(totalMicroEur),
  };
}
