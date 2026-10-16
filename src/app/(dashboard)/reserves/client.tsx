"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useNow, useTimeZone, useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, PiggyBank, Pencil, CalendarClock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/lib/settings-context";
import { formatCalendarDate } from "@/lib/format-date";
import { getCalendarDayInTimeZone } from "@/lib/recurrence";
import { potStatus } from "@/lib/reserves";
import type { ReservePlan, ReserveItem } from "@/lib/services/reserves";
import { ReservePotDialog } from "@/components/organisms/reserve-pot-dialog";

interface ReservesClientProps {
  plan: ReservePlan;
  accounts: Array<{ id: string; name: string }>;
  loadFailed: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function ReservesClient({ plan, accounts, loadFailed }: ReservesClientProps) {
  const t = useTranslations("reserves");
  const tCommon = useTranslations("common");
  const tRecurrence = useTranslations("recurrence");
  const { formatCurrency, locale } = useSettings();
  const router = useRouter();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);

  // "Today" in the configured time zone, so server and browser render the same relative dates
  const now = useNow();
  const timeZone = useTimeZone() ?? "Europe/Berlin";
  const todayTime = getCalendarDayInTimeZone(timeZone, now).getTime();

  const { items, monthlyTotal, targetTotal, pot } = plan;
  const status = pot
    ? potStatus({
        targetTotal,
        monthlyTotal,
        balance: pot.balance,
        plannedMonthlyDeposit: pot.plannedMonthlyDeposit,
      })
    : null;

  const recurrenceLabel = (item: ReserveItem) => {
    switch (item.recurrenceType) {
      case "quarterly":
        return tRecurrence("quarterly");
      case "semiannual":
        return tRecurrence("semiannual");
      case "yearly":
        return tRecurrence("yearly");
      default:
        return tRecurrence("everyMonths", { count: item.recurrenceInterval ?? 0 });
    }
  };

  const dueLabel = (date: Date) => {
    const days = Math.round((new Date(date).getTime() - todayTime) / DAY_MS);
    const formatted = formatCalendarDate(date, locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    if (days === 0) return `${formatted} · ${tCommon("today")}`;
    if (days === 1) return `${formatted} · ${tCommon("tomorrow")}`;
    if (days <= 31) return `${formatted} · ${tCommon("inDays", { count: days })}`;
    return formatted;
  };

  const handleSaved = () => {
    setDialogOpen(false);
    toast({ title: t("potSaved") });
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="from-foreground to-foreground/60 bg-gradient-to-br bg-clip-text text-[2rem] leading-none font-bold tracking-[-0.03em] text-transparent">
            {t("title")}
          </h2>
          <p className="text-muted-foreground/60 mt-1.5 text-sm">{t("description")}</p>
        </div>
      </div>

      {loadFailed && <p className="text-destructive text-sm">{t("loadFailed")}</p>}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>{t("monthlyTotal")}</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{formatCurrency(monthlyTotal)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-xs">
              {t("monthlyTotalHint", { count: items.length })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{t("targetTotal")}</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{formatCurrency(targetTotal)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-xs">{t("targetTotalHint")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{t("potBalance")}</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {pot ? formatCurrency(pot.balance) : "–"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted-foreground text-xs">
              {pot ? t("potAccount", { name: pot.accountName }) : t("noPotHint")}
            </p>
            <Button
              size="sm"
              variant={pot ? "outline" : "default"}
              onClick={() => setDialogOpen(true)}
              disabled={accounts.length === 0}
            >
              {pot ? (
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
              ) : (
                <PiggyBank className="mr-1.5 h-4 w-4" />
              )}
              {pot ? t("correctBalance") : t("setUpPot")}
            </Button>
          </CardContent>
        </Card>
      </div>

      {pot && status && items.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {status.shortfall > 0 ? (
            <StatusNote
              tone="warn"
              title={t("shortfall", { amount: formatCurrency(status.shortfall) })}
            >
              {t("shortfallHint", { rate: formatCurrency(monthlyTotal) })}
            </StatusNote>
          ) : (
            <StatusNote tone="good" title={t("onTrack")}>
              {status.surplus > 0
                ? t("surplusHint", { amount: formatCurrency(status.surplus) })
                : t("onTrackHint")}
            </StatusNote>
          )}
          {status.depositGap > 0 ? (
            <StatusNote
              tone="warn"
              title={t("depositGap", { amount: formatCurrency(status.depositGap) })}
            >
              {t("depositGapHint", {
                planned: formatCurrency(pot.plannedMonthlyDeposit),
                name: pot.accountName,
                needed: formatCurrency(monthlyTotal),
              })}{" "}
              <Link href="/transfers" className="text-foreground underline underline-offset-2">
                {t("toTransfers")}
              </Link>
            </StatusNote>
          ) : (
            <StatusNote tone="good" title={t("depositCovered")}>
              {t("depositCoveredHint", {
                planned: formatCurrency(pot.plannedMonthlyDeposit),
                name: pot.accountName,
              })}
            </StatusNote>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("billsTitle")}</CardTitle>
          <CardDescription>{t("billsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="py-10 text-center">
              <PiggyBank className="text-muted-foreground/50 mx-auto mb-3 h-8 w-8" />
              <p className="text-muted-foreground text-sm">{t("noBills")}</p>
              <Button asChild variant="outline" size="sm" className="mt-4">
                <Link href="/expenses">{t("toExpenses")}</Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-border/60 divide-y">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div
                      className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                      style={
                        item.categoryColor ? { background: `${item.categoryColor}22` } : undefined
                      }
                    >
                      <span className="text-base">{item.categoryIcon || "💰"}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatCurrency(item.amount)} · {recurrenceLabel(item)}
                      </p>
                      <p className="text-muted-foreground flex items-center gap-1 text-xs">
                        <CalendarClock className="h-3 w-3" />
                        {item.nextDue ? dueLabel(item.nextDue) : t("ended")}
                      </p>
                    </div>
                  </div>
                  <div className="w-full sm:w-56">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-semibold tabular-nums">
                        {formatCurrency(item.monthlyRate)}
                        <span className="text-muted-foreground text-xs font-normal">
                          {t("perMonth")}
                        </span>
                      </span>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {t("targetToday", { amount: formatCurrency(item.target) })}
                      </span>
                    </div>
                    <Progress
                      value={item.amount > 0 ? (item.target / item.amount) * 100 : 0}
                      className="mt-1.5 h-1.5"
                      aria-label={t("progressLabel", { name: item.name })}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("howTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 text-sm">
          <p>{t("howRate")}</p>
          <p>{t("howTarget")}</p>
          <p>{t("howPot")}</p>
        </CardContent>
      </Card>

      {dialogOpen && (
        <ReservePotDialog
          open
          onOpenChange={setDialogOpen}
          accounts={accounts}
          initialAccountId={pot?.accountId}
          initialBalance={pot?.balance}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

function StatusNote({
  tone,
  title,
  children,
}: {
  tone: "good" | "warn";
  title: string;
  children: React.ReactNode;
}) {
  const Icon = tone === "good" ? CheckCircle2 : AlertTriangle;
  return (
    <div
      className={`flex gap-3 rounded-xl border p-4 ${
        tone === "good"
          ? "border-emerald-500/20 bg-emerald-500/5"
          : "border-amber-500/25 bg-amber-500/5"
      }`}
    >
      <Icon
        className={`mt-0.5 h-4 w-4 shrink-0 ${tone === "good" ? "text-emerald-500" : "text-amber-500"}`}
      />
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-muted-foreground text-sm">{children}</p>
      </div>
    </div>
  );
}
