import {
  evaluateAiSpendSpikeAlert,
  evaluateWebhookFailureAlert,
} from "@/lib/admin/diagnostics-alerts";

function runWebhookFailureScenario() {
  return evaluateWebhookFailureAlert({ total: 20, failed: 6 });
}

function runAiSpendSpikeScenario() {
  return evaluateAiSpendSpikeAlert({ currentHourSpendEur: 55, baseline24hSpendEur: 144 });
}

const webhook = runWebhookFailureScenario();
const aiSpike = runAiSpendSpikeScenario();

console.log(
  JSON.stringify(
    {
      webhookFailureThresholdScenario: webhook,
      aiSpendSpikeThresholdScenario: aiSpike,
    },
    null,
    2
  )
);

if (webhook.status !== "critical" || aiSpike.status !== "critical") {
  process.exitCode = 1;
}
