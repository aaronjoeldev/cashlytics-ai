"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronRight, Pencil } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/lib/settings-context";
import { splitIncome } from "@/lib/salary-plan";
import type { SalaryPlan } from "@/lib/services/salary-plan";
import { EverydayBudgetDialog } from "@/components/organisms/everyday-budget-dialog";

type Part = "fixed" | "reserves" | "everyday" | "savings" | "free";

// Colours of the bar segments and legend dots
const PART_COLORS: Record<Part, string> = {
  fixed: "bg-slate-500 dark:bg-slate-400",
  reserves: "bg-violet-500",
  everyday: "bg-amber-400",
  savings: "bg-emerald-500",
  free: "bg-muted-foreground/25",
};

export function SalaryPlanClient({ plan }: { plan: SalaryPlan | null }) {
  const t = useTranslations("salaryPlan");
  const { formatCurrency } = useSettings();
  const router = useRouter();
  const { toast } = useToast();
  const [budgetOpen, setBudgetOpen] = useState(false);

  if (!plan) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("title")} description={t("description")} />
        <p className="text-destructive text-sm">{t("loadFailed")}</p>
      </div>
    );
  }

  // Rounded to cents first, so the shown parts add up to the shown remainder
  const cents = (n: number) => Math.round(n * 100) / 100;
  const amounts = {
    income: cents(plan.income),
    fixed: cents(plan.fixed),
    reserves: cents(plan.reserves),
    everyday: cents(plan.everyday.amount),
    savings: cents(plan.savingsTotal),
  };
  const { free, shares } = splitIncome(amounts);
  const values: Record<Part, number> = { ...amounts, free };
  const parts: Part[] = ["fixed", "reserves", "everyday", "savings", "free"];
  const percent = (n: number) =>
    plan.income > 0 ? `${Math.round((Math.max(0, n) / plan.income) * 100)} %` : "–";

  const pot = plan.reservePot;
  const depositGap = pot ? cents(amounts.reserves - pot.plannedMonthlyDeposit) : 0;
  const staysOnChecking = amounts.fixed + amounts.everyday + Math.max(0, free);

  const everydayDetail =
    plan.everyday.source === "custom"
      ? t("everydayCustom", { average: formatCurrency(plan.everyday.average) })
      : plan.everyday.monthsWithData > 0
        ? t("everydayAverage", { count: plan.everyday.monthsWithData })
        : t("everydayNoData");

  const details: Record<Part, React.ReactNode> = {
    fixed: t("fixedDetail", { count: plan.fixedCount }),
    reserves: t("reservesDetail"),
    everyday: everydayDetail,
    savings:
      plan.savings.length > 0
        ? plan.savings.map((s) => `${s.accountName} ${formatCurrency(s.monthly)}`).join(" · ")
        : t("savingsNone"),
    free: free < 0 ? t("freeNegativeDetail") : t("freeDetail"),
  };
  const links: Partial<Record<Part, string>> = {
    fixed: "/expenses",
    reserves: "/reserves",
    savings: "/transfers",
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      <Card>
        <CardHeader>
          <CardDescription>{t("income")}</CardDescription>
          <CardTitle className="text-3xl tabular-nums">{formatCurrency(plan.income)}</CardTitle>
          <p className="text-muted-foreground text-xs">
            {plan.incomes.length > 0
              ? plan.incomes.map((i) => `${i.name} ${formatCurrency(i.monthly)}`).join(" · ")
              : t("noIncome")}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="bg-muted flex h-9 overflow-hidden rounded-lg"
            role="img"
            aria-label={parts
              .map((p) => `${t(`parts.${p}`)} ${formatCurrency(values[p])}`)
              .join(", ")}
          >
            {parts.map((part) =>
              shares[part] > 0 ? (
                <span
                  key={part}
                  className={`${PART_COLORS[part]} h-full`}
                  style={{ width: `${shares[part] * 100}%` }}
                />
              ) : null
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
            {parts.map((part) => (
              <div key={part} className="flex min-w-0 items-baseline gap-2">
                <span className={`${PART_COLORS[part]} h-2.5 w-2.5 shrink-0 rounded-sm`} />
                <div className="min-w-0">
                  <p className="truncate text-sm">{t(`parts.${part}`)}</p>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {formatCurrency(values[part])} · {percent(values[part])}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {free < 0 && (
        <div className="flex gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div className="space-y-1">
            <p className="text-sm font-semibold">
              {t("planShort", { amount: formatCurrency(-free) })}
            </p>
            <p className="text-muted-foreground text-sm">{t("planShortHint")}</p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("splitTitle")}</CardTitle>
          <CardDescription>{t("splitDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-border/60 divide-y">
            {parts.map((part) => (
              <li key={part} className="flex items-center gap-3 py-3">
                <span className={`${PART_COLORS[part]} h-8 w-1.5 shrink-0 rounded-full`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t(`parts.${part}`)}</p>
                  <p className="text-muted-foreground text-xs">{details[part]}</p>
                </div>
                <span
                  className={`text-sm font-semibold tabular-nums ${part === "free" && free < 0 ? "text-destructive" : ""}`}
                >
                  {formatCurrency(values[part])}
                </span>
                {part === "everyday" ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => setBudgetOpen(true)}
                    aria-label={t("editEveryday")}
                    title={t("editEveryday")}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                ) : links[part] ? (
                  <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <Link href={links[part]} aria-label={t("open", { name: t(`parts.${part}`) })}>
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <span className="h-8 w-8 shrink-0" />
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("paydayTitle")}</CardTitle>
          <CardDescription>{t("paydayDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {plan.reserves > 0 && (
              <PaydayRow
                label={pot ? t("toAccount", { name: pot.accountName }) : t("toReserves")}
                amount={formatCurrency(plan.reserves)}
                note={
                  !pot ? (
                    <Link href="/reserves" className="underline underline-offset-2">
                      {t("noPot")}
                    </Link>
                  ) : depositGap > 0 ? (
                    t("plannedTooLow", {
                      planned: formatCurrency(pot.plannedMonthlyDeposit),
                      gap: formatCurrency(depositGap),
                    })
                  ) : (
                    t("plannedCovers", { planned: formatCurrency(pot.plannedMonthlyDeposit) })
                  )
                }
                ok={pot !== null && depositGap <= 0}
              />
            )}
            {plan.savings.map((s) => (
              <PaydayRow
                key={s.accountId}
                label={t("toAccount", { name: s.accountName })}
                amount={formatCurrency(s.monthly)}
                note={t("savingsPlanned")}
                ok
              />
            ))}
            <li className="bg-muted/50 flex flex-wrap items-baseline justify-between gap-2 rounded-xl p-3">
              <span className="text-sm">{t("staysOnChecking")}</span>
              <span className="text-sm font-semibold tabular-nums">
                {formatCurrency(staysOnChecking)}
              </span>
              <span className="text-muted-foreground w-full text-xs">
                {t("staysOnCheckingHint")}
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {budgetOpen && (
        <EverydayBudgetDialog
          open
          onOpenChange={setBudgetOpen}
          custom={plan.everyday.source === "custom" ? plan.everyday.amount : undefined}
          average={plan.everyday.average}
          onSaved={() => {
            setBudgetOpen(false);
            toast({ title: t("everydaySaved") });
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="from-foreground to-foreground/60 bg-gradient-to-br bg-clip-text text-[2rem] leading-none font-bold tracking-[-0.03em] text-transparent">
        {title}
      </h2>
      <p className="text-muted-foreground/60 mt-1.5 text-sm">{description}</p>
    </div>
  );
}

function PaydayRow({
  label,
  amount,
  note,
  ok,
}: {
  label: string;
  amount: string;
  note: React.ReactNode;
  ok: boolean;
}) {
  const Icon = ok ? CheckCircle2 : AlertTriangle;
  return (
    <li className="flex items-start gap-3">
      <ArrowRight className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-sm font-semibold tabular-nums">{amount}</span>
        </div>
        <p className="text-muted-foreground flex items-center gap-1 text-xs">
          <Icon className={`h-3 w-3 ${ok ? "text-emerald-500" : "text-amber-500"}`} />
          {note}
        </p>
      </div>
    </li>
  );
}
