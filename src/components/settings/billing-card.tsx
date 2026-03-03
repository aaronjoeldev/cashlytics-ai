"use client";

import { useEffect, useState } from "react";
import { CreditCard, Zap, Clock, CheckCircle, AlertTriangle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { BillingMeResponse } from "@/lib/billing/contracts";

function formatEur(value: string): string {
  const num = parseFloat(value);
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(num);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

function formatRemainingTime(ms: number): string {
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days} Tag${days !== 1 ? "e" : ""}`;
  if (hours > 0) return `${hours} Stunde${hours !== 1 ? "n" : ""}`;
  return "< 1 Stunde";
}

type PlanBadgeProps = {
  planCode: string;
  subscriptionStatus: string | null;
  billingDisabled: boolean;
};

function PlanBadge({ planCode, subscriptionStatus, billingDisabled }: PlanBadgeProps) {
  if (billingDisabled) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-400/10 px-2.5 py-1 text-xs font-medium text-sky-400 ring-1 ring-sky-400/20">
        Self-Host
      </span>
    );
  }

  if (planCode === "trial" && subscriptionStatus === null) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-medium text-amber-400 ring-1 ring-amber-400/20">
        <Clock className="h-3 w-3" />
        Testphase
      </span>
    );
  }
  const isActive =
    subscriptionStatus === "active" ||
    subscriptionStatus === "trialing" ||
    subscriptionStatus === "past_due";
  if (isActive) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-400 ring-1 ring-emerald-400/20">
        <CheckCircle className="h-3 w-3" />
        Aktiv
      </span>
    );
  }
  return (
    <span className="bg-destructive/10 text-destructive ring-destructive/20 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1">
      <AlertTriangle className="h-3 w-3" />
      Abgelaufen
    </span>
  );
}

export function BillingCard() {
  const [data, setData] = useState<BillingMeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<"monthly" | "yearly" | "portal" | null>(null);

  useEffect(() => {
    fetch("/api/billing/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setData(json))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  async function startCheckout(plan: "monthly" | "yearly") {
    setActionLoading(plan);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) throw new Error();
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      toast.error("Checkout konnte nicht gestartet werden. Bitte versuche es erneut.");
      setActionLoading(null);
    }
  }

  async function openPortal() {
    setActionLoading("portal");
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error();
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      toast.error("Billing-Portal konnte nicht geöffnet werden. Bitte versuche es erneut.");
      setActionLoading(null);
    }
  }

  const isTrial = data?.planCode === "trial" && data?.subscription.status === null;
  const billingDisabled = data?.billingRequired === false;
  const isActive =
    data?.subscription.status === "active" ||
    data?.subscription.status === "trialing" ||
    data?.subscription.status === "past_due";
  const isExpired = !loading && data && !billingDisabled && !isTrial && !isActive;

  const spendNum = parseFloat(data?.aiSpendToDateEur ?? "0");
  const capNum = parseFloat(data?.aiHardCapEur ?? "2");
  const spendPercent = capNum > 0 ? Math.min(100, (spendNum / capNum) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="from-primary/20 to-primary/5 flex size-8 items-center justify-center rounded-xl bg-gradient-to-br">
            <CreditCard className="text-primary h-4 w-4" />
          </span>
          Abonnement & Plan
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading && (
          <div className="border-border/60 rounded-xl border px-4 py-3 dark:border-white/[0.06]">
            <div className="bg-muted/60 h-4 w-32 animate-pulse rounded" />
          </div>
        )}

        {!loading && !data && (
          <div className="border-border/60 bg-muted/40 rounded-xl border px-4 py-3 dark:border-white/[0.06]">
            <p className="text-muted-foreground text-sm">
              Billing-Informationen konnten nicht geladen werden.
            </p>
          </div>
        )}

        {data && (
          <>
            {/* Plan status row */}
            <div className="border-border/60 flex items-center justify-between rounded-xl border px-4 py-3 dark:border-white/[0.06]">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">
                  {billingDisabled
                    ? "Cashlytics Self-Host"
                    : isActive
                      ? data.subscription.planInterval === "yearly"
                        ? "Cashlytics Pro — Jährlich"
                        : "Cashlytics Pro — Monatlich"
                      : "Cashlytics Free Trial"}
                </span>
                {billingDisabled && (
                  <span className="text-muted-foreground text-xs">
                    Billing ist deaktiviert. Diese Instanz erfordert kein Abo.
                  </span>
                )}
                {isTrial && data.trial.status === "active" && (
                  <span className="text-muted-foreground text-xs">
                    Noch {formatRemainingTime(data.trial.remainingMs)} verbleibend
                    {data.trial.endsAt ? ` · endet ${formatDate(data.trial.endsAt)}` : ""}
                  </span>
                )}
                {isActive && data.subscription.currentPeriodEnd && (
                  <span className="text-muted-foreground text-xs">
                    Verlängert am {formatDate(data.subscription.currentPeriodEnd)}
                  </span>
                )}
                {isExpired && (
                  <span className="text-destructive text-xs">
                    Testphase abgelaufen — KI-Assistent gesperrt
                  </span>
                )}
              </div>
              <PlanBadge
                planCode={data.planCode}
                subscriptionStatus={data.subscription.status}
                billingDisabled={billingDisabled}
              />
            </div>

            {/* AI usage bar — only for trial or free plans */}
            {!isActive && !billingDisabled && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Zap className="text-muted-foreground h-3.5 w-3.5" />
                    <span className="text-muted-foreground text-xs font-medium">
                      KI-Nutzung (Testlimit)
                    </span>
                  </div>
                  <span className="font-mono text-xs">
                    {formatEur(data.aiSpendToDateEur)} / {formatEur(data.aiHardCapEur)}
                  </span>
                </div>
                <div className="bg-muted/60 h-1.5 w-full overflow-hidden rounded-full dark:bg-white/[0.06]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${spendPercent}%`,
                      background:
                        spendPercent >= 90
                          ? "oklch(var(--destructive))"
                          : spendPercent >= 70
                            ? "rgb(245 158 11)"
                            : "oklch(var(--primary))",
                    }}
                  />
                </div>
              </div>
            )}

            {/* CTA section */}
            {billingDisabled ? (
              <div className="border-border/60 bg-muted/40 rounded-xl border px-4 py-3 dark:border-white/[0.06]">
                <p className="text-muted-foreground text-sm">
                  In Self-Host-Mode sind Checkout und Billing-Portal deaktiviert.
                </p>
              </div>
            ) : isActive ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={openPortal}
                disabled={actionLoading === "portal"}
              >
                <ExternalLink className="mr-2 h-3.5 w-3.5" />
                {actionLoading === "portal" ? "Wird geöffnet…" : "Abonnement verwalten"}
              </Button>
            ) : (
              <div className="space-y-2">
                {isExpired && (
                  <div className="border-destructive/20 bg-destructive/5 flex items-start gap-3 rounded-xl border px-4 py-3">
                    <AlertTriangle className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
                    <p className="text-destructive text-sm leading-relaxed">
                      Deine Testphase ist abgelaufen. Upgrade jetzt, um den KI-Assistenten und alle
                      Features weiter zu nutzen.
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    onClick={() => startCheckout("monthly")}
                    disabled={actionLoading !== null}
                    className="w-full"
                  >
                    {actionLoading === "monthly" ? "Weiterleitung…" : "Monatlich upgraden"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => startCheckout("yearly")}
                    disabled={actionLoading !== null}
                    className="w-full"
                  >
                    {actionLoading === "yearly" ? "Weiterleitung…" : "Jährlich upgraden"}
                  </Button>
                </div>
                <p className="text-muted-foreground/60 text-center text-xs">
                  Jährlich sparen · Jederzeit kündbar · Sofort aktiv
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
