export const WEBHOOK_FAILURE_THRESHOLD = 5;
export const WEBHOOK_FAILURE_RATE_THRESHOLD = 5;
export const WEBHOOK_WINDOW_MINUTES = 10;

export const AI_SPIKE_RATIO_THRESHOLD = 2;
export const AI_SPIKE_ABSOLUTE_THRESHOLD_EUR = 25;

export type WebhookAlertInput = {
  total: number;
  failed: number;
};

export function evaluateWebhookFailureAlert({ total, failed }: WebhookAlertInput) {
  const failureRatePct = total === 0 ? 0 : Number(((failed / total) * 100).toFixed(2));
  const failedThresholdExceeded = failed >= WEBHOOK_FAILURE_THRESHOLD;
  const failureRateThresholdExceeded = failureRatePct >= WEBHOOK_FAILURE_RATE_THRESHOLD;

  const status =
    failedThresholdExceeded || failureRateThresholdExceeded
      ? "critical"
      : failed > 0
        ? "warning"
        : "healthy";

  return {
    status,
    failureRatePct,
    failedThresholdExceeded,
    failureRateThresholdExceeded,
  };
}

export type AiSpendSpikeInput = {
  currentHourSpendEur: number;
  baseline24hSpendEur: number;
};

export function evaluateAiSpendSpikeAlert({
  currentHourSpendEur,
  baseline24hSpendEur,
}: AiSpendSpikeInput) {
  const baselineHourlyAvgEur = Number((baseline24hSpendEur / 24).toFixed(2));
  const ratioToBaseline =
    baselineHourlyAvgEur <= 0
      ? null
      : Number((currentHourSpendEur / baselineHourlyAvgEur).toFixed(2));

  const thresholdBreached =
    currentHourSpendEur >= AI_SPIKE_ABSOLUTE_THRESHOLD_EUR &&
    ratioToBaseline !== null &&
    ratioToBaseline >= AI_SPIKE_RATIO_THRESHOLD;

  return {
    status: thresholdBreached ? "critical" : "normal",
    thresholdBreached,
    baselineHourlyAvgEur,
    ratioToBaseline,
  };
}
