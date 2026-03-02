export const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export type TrialState = "active" | "expired";

export function calculateTrialEndsAt(trialStartedAt: Date): Date {
  return new Date(trialStartedAt.getTime() + TRIAL_DURATION_MS);
}

export function getTrialState(trialEndsAt: Date | null, now: Date = new Date()): TrialState {
  if (!trialEndsAt) {
    return "expired";
  }

  return now.getTime() < trialEndsAt.getTime() ? "active" : "expired";
}

export function getTrialRemainingMs(trialEndsAt: Date | null, now: Date = new Date()): number {
  if (!trialEndsAt) {
    return 0;
  }

  return Math.max(0, trialEndsAt.getTime() - now.getTime());
}
