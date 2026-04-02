"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Calendar,
} from "lucide-react";
import { useSettings } from "@/lib/settings-context";
import type { DailyExpenseWithDetails } from "@/types/database";
import type { Locale } from "@/i18n/config";

interface DashboardStats {
  totalAssets: number;
  hasMultiCurrency: boolean;
  reserveView: {
    monthlyIncome: number;
    monthlyExpenses: number;
    savingsRate: number;
    incomeTrend: number;
    expenseTrend: number;
  };
  cashflowView: {
    monthlyIncome: number;
    monthlyExpenses: number;
    savingsRate: number;
    incomeTrend: number;
    expenseTrend: number;
  };
}

interface CategoryBreakdown {
  categoryId: string | null;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  total: number;
  percentage: number;
}

interface UpcomingPayment {
  id: string;
  name: string;
  amount: number;
  date: Date;
  type: "expense" | "daily_expense";
  category: {
    name: string | null;
    icon: string | null;
    color: string | null;
  } | null;
  isSubscription: boolean;
}

interface DashboardClientProps {
  stats: DashboardStats;
  categoryBreakdown: CategoryBreakdown[];
  recentTransactions: DailyExpenseWithDetails[];
  upcomingPayments: UpcomingPayment[];
}

function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" }).format(
    new Date(date)
  );
}

interface KpiCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  iconBg: string;
  valueColor?: string;
  trend?: number;
  accentLine?: string;
}

function KpiCard({
  title,
  value,
  subtitle,
  icon,
  iconBg,
  valueColor,
  trend,
  accentLine,
}: KpiCardProps) {
  return (
    <Card className="relative cursor-default overflow-hidden hover:-translate-y-0.5 hover:dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_32px_rgba(0,0,0,0.32)]">
      {accentLine && (
        <div
          className="absolute top-0 right-6 left-6 h-px rounded-full opacity-60"
          style={{ background: accentLine }}
        />
      )}

      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle
            className="text-muted-foreground/70 text-xs font-medium tracking-[0.1em] uppercase"
            style={{ fontFamily: "var(--font-jakarta)" }}
          >
            {title}
          </CardTitle>
        </div>
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
          style={{ background: iconBg }}
        >
          {icon}
        </div>
      </CardHeader>

      <CardContent className="pb-4">
        <div
          className={`mb-2 text-[1.75rem] leading-none font-bold tracking-[-0.04em] ${valueColor || "text-foreground"}`}
          style={{ fontFamily: "var(--font-syne)" }}
        >
          {value}
        </div>
        <p className="text-muted-foreground/60 flex items-center gap-1 text-xs">
          {trend !== undefined && trend !== 0 && (
            <span
              className={`inline-flex items-center gap-0.5 font-medium ${trend > 0 ? "text-emerald-500" : "text-red-400"}`}
            >
              {trend > 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {Math.abs(trend).toFixed(1)}%
            </span>
          )}
          {trend === 0 && (
            <span className="text-muted-foreground/40 inline-flex items-center gap-0.5">
              <Minus className="h-3 w-3" />
            </span>
          )}
          <span>{subtitle}</span>
        </p>
      </CardContent>
    </Card>
  );
}

export function DashboardClient({
  stats,
  categoryBreakdown,
  recentTransactions,
  upcomingPayments,
}: DashboardClientProps) {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const { formatCurrency, locale } = useSettings();
  const [viewMode, setViewMode] = useState<"reserve" | "cashflow">("reserve");
  const activeStats = viewMode === "reserve" ? stats.reserveView : stats.cashflowView;
  const portfolioMonthlyBalance = stats.cashflowView.savingsRate;
  const hasExpenses = categoryBreakdown.length > 0;
  const hasTransactions = recentTransactions.length > 0;
  const hasUpcoming = upcomingPayments.length > 0;

  const localeMap: Record<Locale, string> = {
    de: "de-DE",
    en: "en-US",
  };

  const intlLocale = localeMap[locale];
  const today = new Date().toLocaleDateString(intlLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  function formatRelativeDate(date: Date): string {
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return tCommon("today");
    if (diffDays === 1) return tCommon("tomorrow");
    if (diffDays <= 7) return tCommon("inDays", { count: diffDays });

    return new Intl.DateTimeFormat(intlLocale, { day: "numeric", month: "short" }).format(date);
  }

  return (
    <div className="stagger-children space-y-7">
      <div className="flex items-end justify-between">
        <div>
          <h2
            className="text-[2rem] leading-none font-bold tracking-[-0.03em]"
            style={{
              fontFamily: "var(--font-syne)",
              background:
                "linear-gradient(135deg, var(--foreground) 0%, color-mix(in srgb, var(--foreground) 55%, transparent) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {t("title")}
          </h2>
          <p
            suppressHydrationWarning
            className="text-muted-foreground/60 mt-1.5 text-sm tracking-wide"
            style={{ fontFamily: "var(--font-jakarta)" }}
          >
            {today}
          </p>
        </div>

        <div className="hidden flex-col items-end gap-0.5 sm:flex">
          <span
            className="text-muted-foreground/50 text-[10px] tracking-[0.15em] uppercase"
            style={{ fontFamily: "var(--font-jakarta)" }}
          >
            {t("monthlyBalance")}
          </span>
          <span
            className="text-foreground text-xl font-bold tracking-[-0.03em]"
            style={{ fontFamily: "var(--font-syne)" }}
          >
            {stats.hasMultiCurrency ? "≈\u202f" : ""}{formatCurrency(portfolioMonthlyBalance)}
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="md:col-span-2 lg:col-span-4">
          <CardContent className="pt-5 pb-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-muted-foreground/70 text-xs font-medium tracking-[0.1em] uppercase">
                  {t("calculationView")}
                </p>
                <p className="text-muted-foreground/60 mt-1 text-xs">
                  {t(`viewExplanation.${viewMode}`)}
                </p>
              </div>
              <div className="border-border/60 bg-background/60 inline-flex items-center rounded-xl border p-1">
                <button
                  type="button"
                  onClick={() => setViewMode("reserve")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === "reserve"
                      ? "text-foreground bg-white/10"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t("viewModes.reserve")}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("cashflow")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === "cashflow"
                      ? "text-foreground bg-white/10"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t("viewModes.cashflow")}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <KpiCard
          title={t("monthlyBalance")}
          value={`${stats.hasMultiCurrency ? "≈\u202f" : ""}${formatCurrency(portfolioMonthlyBalance)}`}
          subtitle={t("allAccountsMonthly")}
          icon={<Wallet className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
          iconBg="linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.06))"
          accentLine="linear-gradient(90deg, transparent, rgba(245,158,11,0.5), transparent)"
        />

        <KpiCard
          title={t("monthlyIncome")}
          value={formatCurrency(activeStats.monthlyIncome)}
          subtitle={t("vsLastMonth")}
          icon={<ArrowUpRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
          iconBg="linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.06))"
          valueColor="text-emerald-600 dark:text-emerald-400"
          trend={activeStats.incomeTrend}
          accentLine="linear-gradient(90deg, transparent, rgba(16,185,129,0.45), transparent)"
        />

        <KpiCard
          title={t("monthlyExpenses")}
          value={formatCurrency(activeStats.monthlyExpenses)}
          subtitle={t("vsLastMonth")}
          icon={<ArrowDownRight className="h-4 w-4 text-red-500 dark:text-red-400" />}
          iconBg="linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.06))"
          valueColor="text-red-500 dark:text-red-400"
          trend={activeStats.expenseTrend}
          accentLine="linear-gradient(90deg, transparent, rgba(239,68,68,0.4), transparent)"
        />

        <KpiCard
          title={t("savingsRate")}
          value={formatCurrency(activeStats.savingsRate)}
          subtitle={activeStats.savingsRate >= 0 ? t("surplusThisMonth") : t("deficitThisMonth")}
          icon={<PiggyBank className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
          iconBg="linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.06))"
          valueColor={
            activeStats.savingsRate >= 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-500 dark:text-red-400"
          }
          accentLine={
            activeStats.savingsRate >= 0
              ? "linear-gradient(90deg, transparent, rgba(16,185,129,0.4), transparent)"
              : "linear-gradient(90deg, transparent, rgba(239,68,68,0.4), transparent)"
          }
        />
      </div>

      {hasUpcoming && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
                  <Calendar className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <CardTitle className="text-base" style={{ fontFamily: "var(--font-syne)" }}>
                    {t("upcomingPayments")}
                  </CardTitle>
                  <CardDescription className="mt-0.5 text-xs">{t("next14Days")}</CardDescription>
                </div>
              </div>
              <span className="text-muted-foreground/50 border-border/50 rounded-lg border bg-white/5 px-2 py-1 text-xs font-medium dark:border-white/[0.06] dark:bg-white/[0.04]">
                {t("pendingCount", { count: upcomingPayments.length })}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {upcomingPayments.slice(0, 6).map((payment, i) => (
                <div
                  key={`${payment.id}-${i}`}
                  className="group hover:border-border/40 flex items-center gap-3 rounded-xl border border-transparent p-3 transition-all duration-200 hover:bg-white/4 dark:hover:border-white/[0.05] dark:hover:bg-white/[0.04]"
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      background: payment.category?.color
                        ? `linear-gradient(135deg, ${payment.category.color}28, ${payment.category.color}0e)`
                        : "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))",
                    }}
                  >
                    <span className="text-base">
                      {payment.isSubscription ? "💳" : payment.category?.icon || "💸"}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-foreground/90 truncate text-sm font-medium"
                      style={{ fontFamily: "var(--font-jakarta)" }}
                    >
                      {payment.name}
                    </p>
                    <p
                      className="text-muted-foreground/50 mt-0.5 text-xs"
                      style={{ fontFamily: "var(--font-jakarta)" }}
                    >
                      {formatRelativeDate(new Date(payment.date))}
                    </p>
                  </div>
                  <span
                    className="shrink-0 text-sm font-semibold text-red-500 dark:text-red-400"
                    style={{ fontFamily: "var(--font-syne)" }}
                  >
                    −{formatCurrency(payment.amount)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base" style={{ fontFamily: "var(--font-syne)" }}>
                  {t("expensesByCategory")}
                </CardTitle>
                <CardDescription className="mt-1 text-xs">{t("thisMonth")}</CardDescription>
              </div>
              {hasExpenses && (
                <span
                  className="text-muted-foreground/50 border-border/50 rounded-lg border bg-white/5 px-2 py-1 text-xs font-medium dark:border-white/[0.06] dark:bg-white/[0.04]"
                  style={{ fontFamily: "var(--font-jakarta)" }}
                >
                  {t("categoriesCount", { count: categoryBreakdown.length })}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!hasExpenses ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10">
                <div className="text-3xl opacity-20">📊</div>
                <p
                  className="text-muted-foreground/50 text-center text-sm"
                  style={{ fontFamily: "var(--font-jakarta)" }}
                >
                  {t("noExpensesThisMonth")}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {categoryBreakdown.slice(0, 6).map((category) => (
                  <div
                    key={category.categoryId || "other"}
                    className="group hover:border-border/40 space-y-2 rounded-xl border border-transparent p-3 transition-all duration-200 hover:bg-white/4 dark:hover:border-white/[0.05] dark:hover:bg-white/[0.04]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm"
                          style={{
                            background: category.categoryColor
                              ? `linear-gradient(135deg, ${category.categoryColor}28, ${category.categoryColor}0e)`
                              : "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))",
                          }}
                        >
                          {category.categoryIcon || "📦"}
                        </div>
                        <span
                          className="text-foreground/80 text-sm font-medium"
                          style={{ fontFamily: "var(--font-jakarta)" }}
                        >
                          {category.categoryName}
                        </span>
                      </div>
                      <div className="text-right">
                        <span
                          className="text-foreground text-sm font-semibold"
                          style={{ fontFamily: "var(--font-syne)" }}
                        >
                          {formatCurrency(category.total)}
                        </span>
                        <span
                          className="text-muted-foreground/50 ml-1.5 text-xs tabular-nums"
                          style={{ fontFamily: "var(--font-jakarta)" }}
                        >
                          {category.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <Progress
                      value={category.percentage}
                      className="h-1 bg-white/5 dark:bg-white/[0.04]"
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base" style={{ fontFamily: "var(--font-syne)" }}>
                  {t("recentTransactions")}
                </CardTitle>
                <CardDescription className="mt-1 text-xs">
                  {t("yourRecentExpenses")}
                </CardDescription>
              </div>
              {hasTransactions && (
                <span
                  className="text-muted-foreground/50 border-border/50 rounded-lg border bg-white/5 px-2 py-1 text-xs font-medium dark:border-white/[0.06] dark:bg-white/[0.04]"
                  style={{ fontFamily: "var(--font-jakarta)" }}
                >
                  {t("entriesCount", { count: recentTransactions.length })}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!hasTransactions ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10">
                <div className="text-3xl opacity-20">💳</div>
                <p
                  className="text-muted-foreground/50 text-center text-sm"
                  style={{ fontFamily: "var(--font-jakarta)" }}
                >
                  {t("noTransactions")}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {recentTransactions.map((transaction, i) => (
                  <div
                    key={transaction.id}
                    className="group hover:border-border/40 flex items-center justify-between rounded-xl border border-transparent p-3 transition-all duration-200 hover:bg-white/4 dark:hover:border-white/[0.05] dark:hover:bg-white/[0.04]"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-500/[0.18] to-red-500/[0.06]">
                        <span className="text-base leading-none">
                          {transaction.category?.icon || "💸"}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p
                          className="text-foreground/90 truncate text-sm font-medium"
                          style={{ fontFamily: "var(--font-jakarta)" }}
                        >
                          {transaction.description}
                        </p>
                        <p
                          className="text-muted-foreground/50 mt-0.5 text-xs"
                          style={{ fontFamily: "var(--font-jakarta)" }}
                        >
                          {transaction.category?.name || tCommon("withoutCategory")}
                          <span className="mx-1.5 opacity-40">·</span>
                          {formatDate(transaction.date)}
                        </p>
                      </div>
                    </div>
                    <span
                      className="ml-3 shrink-0 text-sm font-semibold text-red-500 dark:text-red-400"
                      style={{ fontFamily: "var(--font-syne)" }}
                    >
                      −
                      {formatCurrency(
                        typeof transaction.amount === "string"
                          ? parseFloat(transaction.amount)
                          : transaction.amount
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
