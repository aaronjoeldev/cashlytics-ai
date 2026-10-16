"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, ChevronRight, PiggyBank } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSettings } from "@/lib/settings-context";
import { formatCalendarDate } from "@/lib/format-date";
import { potStatus } from "@/lib/reserves";
import type { ReservePlan } from "@/lib/services/reserves";

/** Dashboard summary of the reserve plan: monthly amount, pot status, next infrequent bill. */
export function ReserveStatusCard({ plan }: { plan: ReservePlan }) {
  const t = useTranslations("reserves");
  const { formatCurrency, locale } = useSettings();
  const { items, monthlyTotal, targetTotal, pot } = plan;
  const nextBill = items.find((item) => item.nextDue);
  const status = pot
    ? potStatus({
        targetTotal,
        monthlyTotal,
        balance: pot.balance,
        plannedMonthlyDeposit: pot.plannedMonthlyDeposit,
      })
    : null;
  const needsAttention = status !== null && (status.shortfall > 0 || status.depositGap > 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 p-2">
            <PiggyBank className="h-4 w-4 text-violet-500" />
          </div>
          <div>
            <CardTitle>{t("card.title")}</CardTitle>
            <CardDescription>{t("card.monthly")}</CardDescription>
          </div>
        </div>
        <Link
          href="/reserves"
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
        >
          {t("card.open")}
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-2xl font-bold tabular-nums">{formatCurrency(monthlyTotal)}</p>
          <p className="text-muted-foreground text-xs">
            {t("monthlyTotalHint", { count: items.length })}
          </p>
        </div>
        <div className="flex items-start gap-2">
          {status ? (
            <>
              {needsAttention ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {status.shortfall > 0
                    ? t("shortfall", { amount: formatCurrency(status.shortfall) })
                    : t("onTrack")}
                </p>
                <p className="text-muted-foreground text-xs">
                  {status.depositGap > 0
                    ? t("depositGap", { amount: formatCurrency(status.depositGap) })
                    : t("potAccount", { name: pot!.accountName }) +
                      " · " +
                      formatCurrency(pot!.balance)}
                </p>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">{t("noPotHint")}</p>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">{t("card.nextBill")}</p>
          {nextBill?.nextDue ? (
            <>
              <p className="truncate text-sm font-medium">{nextBill.name}</p>
              <p className="text-muted-foreground text-xs tabular-nums">
                {formatCalendarDate(nextBill.nextDue, locale, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}{" "}
                · {formatCurrency(nextBill.amount)}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">{t("card.noBills")}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
