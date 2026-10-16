"use client";

import { getCalendarDayInTimeZone, getNextOccurrence } from "@/lib/recurrence";
import { useState, useCallback, useRef } from "react";
import { useNow, useTimeZone, useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  CalendarRange,
  Repeat,
  PieChart,
  Wallet,
  PiggyBank,
  CreditCard,
  Calendar,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
} from "lucide-react";
import { useSettings } from "@/lib/settings-context";
import { getMonthlyPaymentsCalendar } from "@/actions/analytics-actions";
import { toast } from "sonner";
import type {
  MonthlyOverview,
  Forecast,
  CategoryBreakdown,
  ExpenseWithDetails,
  Account,
} from "@/types/database";
import type { CalendarDay, CalendarPayment } from "@/actions/analytics-actions";

interface OverviewClientProps {
  month: number;
  year: number;
  overview: MonthlyOverview | null;
  forecast: Forecast | null;
  categoryBreakdown: CategoryBreakdown[];
  normalizedExpenses: Array<{ expense: ExpenseWithDetails; monthlyAmount: number }>;
  subscriptions: Array<{ expense: ExpenseWithDetails; monthlyAmount: number }>;
  initialCalendarDays: CalendarDay[];
  accounts: Account[];
}

export function OverviewClient({
  month,
  year,
  overview,
  forecast,
  categoryBreakdown,
  normalizedExpenses,
  subscriptions,
  initialCalendarDays,
  accounts,
}: OverviewClientProps) {
  const t = useTranslations("overview");
  const tCommon = useTranslations("common");
  const tRecurrence = useTranslations("recurrence");
  const tWeekdays = useTranslations("weekdays");
  const { formatCurrency, locale } = useSettings();
  const [calendarExpanded, setCalendarExpanded] = useState(true);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(month);
  const [calendarYear, setCalendarYear] = useState(year);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>(initialCalendarDays);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");

  const getMonthName = useCallback(
    (m: number): string => {
      return new Date(2024, m - 1).toLocaleDateString(locale, { month: "long" });
    },
    [locale]
  );

  const getRecurrenceLabel = useCallback(
    (type: string, interval: number | null): string => {
      switch (type) {
        case "daily":
          return tRecurrence("daily");
        case "weekly":
          return tRecurrence("weekly");
        case "monthly":
          return tRecurrence("monthly");
        case "quarterly":
          return tRecurrence("quarterly");
        case "semiannual":
          return tRecurrence("semiannual");
        case "yearly":
          return tRecurrence("yearly");
        case "custom":
          return interval ? tRecurrence("everyMonths", { count: interval }) : tRecurrence("custom");
        case "once":
          return tRecurrence("once");
        default:
          return type;
      }
    },
    [tRecurrence]
  );

  // "Today" in the configured time zone, so server and browser render the same relative dates
  const now = useNow();
  const timeZone = useTimeZone() ?? "Europe/Berlin";
  const todayTime = getCalendarDayInTimeZone(timeZone, now).getTime();

  const formatNextPayment = useCallback(
    (expense: {
      recurrenceType: string;
      startDate: Date | string;
      recurrenceInterval: number | null;
      endDate?: Date | string | null;
    }): string | null => {
      const nextDate = getNextOccurrence(expense, new Date(todayTime));
      if (!nextDate) return null;

      const diffDays = Math.round((nextDate.getTime() - todayTime) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return tCommon("today");
      if (diffDays === 1) return tCommon("tomorrow");
      if (diffDays <= 7) return tCommon("inDays", { count: diffDays });

      return new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }).format(nextDate);
    },
    [tCommon, locale, todayTime]
  );

  // Only the latest navigation may update the calendar; slower earlier answers are dropped
  const calendarRequestRef = useRef(0);

  const showCalendarMonth = useCallback(
    async (y: number, m: number) => {
      const request = ++calendarRequestRef.current;
      setCalendarYear(y);
      setCalendarMonth(m);
      setSelectedDay(null);

      if (y === year && m === month) {
        setCalendarDays(initialCalendarDays);
        setCalendarLoading(false);
        return;
      }

      setCalendarLoading(true);
      try {
        const result = await getMonthlyPaymentsCalendar(y, m);
        if (request !== calendarRequestRef.current) return;
        if (result.success) {
          setCalendarDays(result.data);
        } else {
          setCalendarDays([]);
          toast.error(t("calendarLoadFailed"));
        }
      } catch (error) {
        console.error("Failed to fetch calendar data:", error);
        if (request === calendarRequestRef.current) {
          setCalendarDays([]);
          toast.error(t("calendarLoadFailed"));
        }
      } finally {
        if (request === calendarRequestRef.current) setCalendarLoading(false);
      }
    },
    [initialCalendarDays, month, year, t]
  );

  const goToPrevMonth = () =>
    calendarMonth === 1
      ? showCalendarMonth(calendarYear - 1, 12)
      : showCalendarMonth(calendarYear, calendarMonth - 1);

  const goToNextMonth = () =>
    calendarMonth === 12
      ? showCalendarMonth(calendarYear + 1, 1)
      : showCalendarMonth(calendarYear, calendarMonth + 1);

  const goToCurrentMonth = () => showCalendarMonth(year, month);

  const isCurrentMonth = calendarMonth === month && calendarYear === year;

  const totalIncome = overview?.totalIncome ?? 0;
  const totalExpenses = overview?.totalExpenses ?? 0;
  const balance = overview?.balance ?? 0;
  const hasForecast = forecast && forecast.monthlyDetails.length > 0;

  const filteredNormalizedExpenses =
    selectedAccountId === "all"
      ? normalizedExpenses
      : normalizedExpenses.filter((e) => e.expense.accountId === selectedAccountId);
  const filteredSubscriptions =
    selectedAccountId === "all"
      ? subscriptions
      : subscriptions.filter((s) => s.expense.accountId === selectedAccountId);

  const hasBreakdown = categoryBreakdown.length > 0;
  const hasExpenses = filteredNormalizedExpenses.length > 0;
  const hasSubscriptions = filteredSubscriptions.length > 0;

  const totalNormalizedMonthly = filteredNormalizedExpenses.reduce(
    (sum, e) => sum + e.monthlyAmount,
    0
  );
  const totalSubscriptionsMonthly = filteredSubscriptions.reduce(
    (sum, s) => sum + s.monthlyAmount,
    0
  );

  const monthlyFixed = filteredNormalizedExpenses.filter(
    (e) => e.expense.recurrenceType === "monthly"
  );
  const periodicReserves = filteredNormalizedExpenses.filter(
    (e) => e.expense.recurrenceType !== "monthly" && e.expense.recurrenceType !== "once"
  );
  const totalMonthlyFixed = monthlyFixed.reduce((sum, e) => sum + e.monthlyAmount, 0);
  const totalReserves = periodicReserves.reduce((sum, e) => sum + e.monthlyAmount, 0);

  const handleDayClick = (day: CalendarDay) => {
    if (day.payments.length > 0) {
      setSelectedDay(day);
    }
  };

  const formatDayDate = (date: Date): string => {
    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      // Calendar days are stored as UTC midnight
      timeZone: "UTC",
    }).format(date);
  };

  const weekdayLabels = [
    tWeekdays("short.mon"),
    tWeekdays("short.tue"),
    tWeekdays("short.wed"),
    tWeekdays("short.thu"),
    tWeekdays("short.fri"),
    tWeekdays("short.sat"),
    tWeekdays("short.sun"),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="from-foreground to-foreground/60 bg-gradient-to-br bg-clip-text text-[2rem] leading-none font-bold tracking-[-0.03em] text-transparent">
            {t("title")}
          </h2>
          <p className="text-muted-foreground/60 mt-1.5 text-sm">
            {t("subtitle", { month: getMonthName(month), year })}
          </p>
        </div>
        {accounts.length > 1 && (
          <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tCommon("allAccounts")}</SelectItem>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div
              className="flex cursor-pointer items-center gap-3"
              onClick={() => setCalendarExpanded(!calendarExpanded)}
            >
              <div className="from-primary/20 to-primary/5 rounded-xl bg-gradient-to-br p-2">
                <Calendar className="text-primary h-4 w-4" />
              </div>
              <div>
                <CardTitle>{t("paymentCalendar")}</CardTitle>
                <CardDescription>{t("paymentCalendarDescription")}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {!isCurrentMonth && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goToCurrentMonth}
                  className="h-7 px-2 text-xs"
                >
                  {tCommon("today")}
                </Button>
              )}
              <button
                className="hover:bg-accent rounded-lg p-2 transition-colors"
                onClick={goToPrevMonth}
              >
                <ChevronLeft className="text-muted-foreground h-4 w-4" />
              </button>
              <button
                className="hover:bg-accent rounded-lg p-2 transition-colors"
                onClick={goToNextMonth}
              >
                <ChevronRight className="text-muted-foreground h-4 w-4" />
              </button>
              <button
                className="hover:bg-accent rounded-lg p-2 transition-colors"
                onClick={() => setCalendarExpanded(!calendarExpanded)}
              >
                {calendarExpanded ? (
                  <ChevronUp className="text-muted-foreground h-4 w-4" />
                ) : (
                  <ChevronDown className="text-muted-foreground h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </CardHeader>
        {calendarExpanded && (
          <CardContent>
            <div className="mb-4 flex items-center justify-center">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPrevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-[160px] text-center text-lg font-semibold capitalize">
                  {getMonthName(calendarMonth)} {calendarYear}
                </span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {calendarLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
              </div>
            ) : (
              <>
                <div className="mb-2 grid grid-cols-7 gap-1">
                  {weekdayLabels.map((day) => (
                    <div
                      key={day}
                      className="text-muted-foreground/60 py-2 text-center text-xs font-medium"
                    >
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day: CalendarDay, i: number) => {
                    const hasPayments = day.payments.length > 0;
                    // Calendar days are UTC midnight; toDateString() would shift them west of UTC
                    const isToday = new Date(day.date).getTime() === todayTime;

                    return (
                      <div
                        key={i}
                        onClick={() => handleDayClick(day)}
                        className={`relative min-h-[60px] rounded-lg border p-1.5 transition-all ${
                          day.isCurrentMonth
                            ? "bg-card border-border/50 dark:border-white/[0.06]"
                            : "bg-muted/30 border-transparent"
                        } ${
                          isToday ? "ring-primary ring-offset-background ring-2 ring-offset-1" : ""
                        } ${
                          hasPayments
                            ? "hover:border-primary/30 hover:bg-accent/30 cursor-pointer"
                            : ""
                        } ${
                          selectedDay?.date.toDateString() === day.date.toDateString()
                            ? "border-primary bg-primary/5"
                            : ""
                        } `}
                      >
                        <span
                          className={`text-sm font-medium ${day.isCurrentMonth ? "text-foreground" : "text-muted-foreground/40"} ${isToday ? "text-primary" : ""} `}
                        >
                          {day.dayOfMonth}
                        </span>
                        {hasPayments && (
                          <div className="mt-1 space-y-0.5">
                            {day.payments
                              .slice(0, 2)
                              .map((payment: CalendarPayment, pi: number) => (
                                <div
                                  key={pi}
                                  className={`truncate rounded px-1 py-0.5 text-[10px] ${
                                    payment.type === "income"
                                      ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                      : "bg-red-500/20 text-red-600 dark:text-red-400"
                                  } `}
                                >
                                  {payment.name.slice(0, 8)}
                                </div>
                              ))}
                            {day.payments.length > 2 && (
                              <div className="text-muted-foreground px-1 text-[10px]">
                                +{day.payments.length - 2} {tCommon("more")}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            <div className="border-border/50 mt-4 flex items-center gap-4 border-t pt-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-emerald-500/20"></div>
                <span className="text-muted-foreground text-xs">{t("income")}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-red-500/20"></div>
                <span className="text-muted-foreground text-xs">{t("expenses")}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="ring-primary h-3 w-3 rounded ring-2"></div>
                <span className="text-muted-foreground text-xs">{tCommon("today")}</span>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {selectedDay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedDay(null)}
        >
          <Card
            className="max-h-[80vh] w-full max-w-md overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="from-primary/20 to-primary/5 rounded-xl bg-gradient-to-br p-2">
                    <Calendar className="text-primary h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{formatDayDate(selectedDay.date)}</CardTitle>
                    <CardDescription>
                      {t("paymentsCount", { count: selectedDay.payments.length })}
                    </CardDescription>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="hover:bg-accent rounded-lg p-2 transition-colors"
                >
                  <X className="text-muted-foreground h-4 w-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {selectedDay.payments.map((payment, i) => (
                  <div
                    key={i}
                    className="bg-accent/30 flex items-center justify-between rounded-xl p-3 dark:bg-white/[0.03]"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                        style={{
                          background: payment.category?.color
                            ? `linear-gradient(135deg, ${payment.category.color}28, ${payment.category.color}0e)`
                            : payment.type === "income"
                              ? "linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05))"
                              : "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))",
                        }}
                      >
                        <span className="text-base">
                          {payment.isSubscription
                            ? "💳"
                            : payment.category?.icon || (payment.type === "income" ? "💰" : "💸")}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{payment.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {payment.category?.name ||
                            (payment.type === "income" ? t("income") : t("expenses"))}
                          {payment.isSubscription && ` · ${tCommon("subscription")}`}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-sm font-semibold ${payment.type === "income" ? "text-emerald-500" : "text-red-500"}`}
                    >
                      {payment.type === "income" ? "+" : "−"}
                      {formatCurrency(payment.amount)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-border/50 mt-4 border-t pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">{t("dayBalance")}</span>
                  <span
                    className={`font-bold ${
                      selectedDay.payments.reduce(
                        (sum, p) => sum + (p.type === "income" ? p.amount : -p.amount),
                        0
                      ) >= 0
                        ? "text-emerald-500"
                        : "text-red-500"
                    }`}
                  >
                    {formatCurrency(
                      selectedDay.payments.reduce(
                        (sum, p) => sum + (p.type === "income" ? p.amount : -p.amount),
                        0
                      )
                    )}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="stagger-children grid gap-4 md:grid-cols-3">
        <Card className="hover:bg-card/80 transition-all duration-300 hover:-translate-y-0.5 dark:hover:bg-white/[0.08]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("income")}</CardTitle>
            <div className="rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 p-2">
              <ArrowUpRight className="h-4 w-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">{formatCurrency(totalIncome)}</div>
            <p className="text-muted-foreground mt-1 text-xs">{t("monthlyIncome")}</p>
          </CardContent>
        </Card>

        <Card className="hover:bg-card/80 transition-all duration-300 hover:-translate-y-0.5 dark:hover:bg-white/[0.08]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("expenses")}</CardTitle>
            <div className="rounded-xl bg-gradient-to-br from-red-500/20 to-red-500/5 p-2">
              <ArrowDownRight className="h-4 w-4 text-red-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{formatCurrency(totalExpenses)}</div>
            <p className="text-muted-foreground mt-1 text-xs">{t("fixedCosts")}</p>
          </CardContent>
        </Card>

        <Card
          className={`hover:bg-card/80 transition-all duration-300 hover:-translate-y-0.5 dark:hover:bg-white/[0.08] ${balance >= 0 ? "dark:shadow-[0_0_30px_rgba(52,211,153,0.08)]" : "dark:shadow-[0_0_30px_rgba(248,113,113,0.08)]"}`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("balance")}</CardTitle>
            <div
              className={`rounded-xl p-2 ${balance >= 0 ? "bg-gradient-to-br from-emerald-500/20 to-emerald-500/5" : "bg-gradient-to-br from-red-500/20 to-red-500/5"}`}
            >
              <Scale className={`h-4 w-4 ${balance >= 0 ? "text-emerald-500" : "text-red-500"}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${balance >= 0 ? "text-emerald-500" : "text-red-500"}`}
            >
              {formatCurrency(balance)}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              {balance >= 0 ? t("surplusThisMonth") : t("deficitThisMonth")}
            </p>
          </CardContent>
        </Card>
      </div>

      {hasSubscriptions && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 p-2">
                  <CreditCard className="h-4 w-4 text-cyan-500" />
                </div>
                <div>
                  <CardTitle>{t("activeSubscriptions")}</CardTitle>
                  <CardDescription>
                    {t("subscriptionsCount", { count: filteredSubscriptions.length })} &middot;{" "}
                    {t("monthlyLabel")}{" "}
                    <span className="text-foreground font-semibold">
                      {formatCurrency(totalSubscriptionsMonthly)}
                    </span>
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {filteredSubscriptions
                .sort((a, b) => b.monthlyAmount - a.monthlyAmount)
                .map((item) => (
                  <div
                    key={item.expense.id}
                    className="hover:bg-accent/30 flex items-center justify-between rounded-xl p-3 transition-colors duration-200 dark:hover:bg-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-xl"
                        style={{
                          background: item.expense.category?.color
                            ? `linear-gradient(135deg, ${item.expense.category.color}33, ${item.expense.category.color}11)`
                            : undefined,
                        }}
                      >
                        <span className="text-base">{item.expense.category?.icon || "💳"}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{item.expense.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {item.expense.category?.name ?? tCommon("withoutCategory")} &middot;{" "}
                          {getRecurrenceLabel(
                            item.expense.recurrenceType,
                            item.expense.recurrenceInterval
                          )}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatCurrency(item.monthlyAmount)}
                      <span className="text-muted-foreground text-xs font-normal">
                        {t("perMonth")}
                      </span>
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="from-primary/20 to-primary/5 rounded-xl bg-gradient-to-br p-2">
                <PieChart className="text-primary h-4 w-4" />
              </div>
              <div>
                <CardTitle>{t("expensesByCategory")}</CardTitle>
                <CardDescription>
                  {getMonthName(month)} {year}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!hasBreakdown ? (
              <div className="py-12 text-center">
                <div className="from-primary/10 to-primary/5 mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br">
                  <PieChart className="text-primary/50 h-6 w-6" />
                </div>
                <p className="text-muted-foreground text-sm">{t("noExpensesThisMonth")}</p>
              </div>
            ) : (
              <div className="space-y-1">
                {categoryBreakdown.map((item) => (
                  <div
                    key={item.category.id}
                    className="hover:bg-accent/30 rounded-xl p-3 transition-colors duration-200 dark:hover:bg-white/5"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-xl"
                          style={{
                            background: item.category.color
                              ? `linear-gradient(135deg, ${item.category.color}33, ${item.category.color}11)`
                              : undefined,
                          }}
                        >
                          <span className="text-base">{item.category.icon || "📦"}</span>
                        </div>
                        <span className="text-sm font-medium">{item.category.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold">{formatCurrency(item.amount)}</span>
                        <span className="text-muted-foreground ml-2 text-xs">
                          {item.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <Progress value={item.percentage} className="h-1.5" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 p-2">
                <Wallet className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <CardTitle>{t("monthlyFixedCosts")}</CardTitle>
                <CardDescription>
                  {monthlyFixed.length > 0 ? (
                    <>
                      {t("monthlyDebit")}{" "}
                      <span className="text-foreground font-semibold">
                        {formatCurrency(totalMonthlyFixed)}
                      </span>
                    </>
                  ) : (
                    t("fixedMonthlyDebits")
                  )}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {monthlyFixed.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-500/5">
                  <Wallet className="h-6 w-6 text-amber-500/50" />
                </div>
                <p className="text-muted-foreground text-sm">{t("noMonthlyFixedCosts")}</p>
              </div>
            ) : (
              <div className="space-y-1">
                {monthlyFixed
                  .sort((a, b) => b.monthlyAmount - a.monthlyAmount)
                  .map((item) => (
                    <div
                      key={item.expense.id}
                      className="hover:bg-accent/30 flex items-center justify-between rounded-xl p-3 transition-colors duration-200 dark:hover:bg-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-xl"
                          style={{
                            background: item.expense.category?.color
                              ? `linear-gradient(135deg, ${item.expense.category.color}33, ${item.expense.category.color}11)`
                              : undefined,
                          }}
                        >
                          <span className="text-base">{item.expense.category?.icon || "💰"}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{item.expense.name}</p>
                          <p className="text-muted-foreground text-xs">
                            {item.expense.category?.name ?? tCommon("withoutCategory")}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold tabular-nums">
                        {formatCurrency(item.monthlyAmount)}
                        <span className="text-muted-foreground text-xs font-normal">
                          {t("perMonth")}
                        </span>
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 p-2">
              <PiggyBank className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <CardTitle>{t("periodicReserves")}</CardTitle>
              <CardDescription>
                {periodicReserves.length > 0 ? (
                  <>
                    {t("monthlyReserve")}{" "}
                    <span className="text-foreground font-semibold">
                      {formatCurrency(totalReserves)}
                    </span>{" "}
                    &mdash; {t("reservesDescription")}
                  </>
                ) : (
                  t("reservesSubtitle")
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {periodicReserves.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/10 to-violet-500/5">
                <PiggyBank className="h-6 w-6 text-violet-500/50" />
              </div>
              <p className="text-muted-foreground text-sm">{t("noPeriodicExpenses")}</p>
            </div>
          ) : (
            <div className="space-y-1">
              {periodicReserves
                .sort((a, b) => b.monthlyAmount - a.monthlyAmount)
                .map((item) => {
                  const nextPayment = formatNextPayment(item.expense);
                  return (
                    <div
                      key={item.expense.id}
                      className="hover:bg-accent/30 flex items-center justify-between rounded-xl p-3 transition-colors duration-200 dark:hover:bg-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-xl"
                          style={{
                            background: item.expense.category?.color
                              ? `linear-gradient(135deg, ${item.expense.category.color}33, ${item.expense.category.color}11)`
                              : undefined,
                          }}
                        >
                          <span className="text-base">{item.expense.category?.icon || "💰"}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{item.expense.name}</p>
                          <p className="text-muted-foreground text-xs">
                            {formatCurrency(parseFloat(item.expense.amount))} &middot;{" "}
                            {getRecurrenceLabel(
                              item.expense.recurrenceType,
                              item.expense.recurrenceInterval
                            )}
                            {nextPayment && (
                              <span className="ml-2 text-emerald-600 dark:text-emerald-400">
                                • {t("nextPayment")} {nextPayment}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold tabular-nums">
                          {formatCurrency(item.monthlyAmount)}
                          <span className="text-muted-foreground text-xs font-normal">
                            {t("perMonth")}
                          </span>
                        </span>
                        <p className="text-muted-foreground text-xs">{t("reserve")}</p>
                      </div>
                    </div>
                  );
                })}
              <div className="mt-3 rounded-xl border border-violet-500/10 bg-violet-500/5 p-3 dark:border-violet-500/15 dark:bg-violet-500/10">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">{t("totalMonthlyReserve")}</span>
                  <span className="text-sm font-bold text-violet-500">
                    {formatCurrency(totalReserves)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {hasExpenses && (
        <Card className="border-primary/20 dark:border-primary/10">
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-center gap-3 rounded-xl bg-amber-500/5 p-3 dark:bg-amber-500/10">
                <Wallet className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="text-muted-foreground text-xs">{t("fixedCostsLabel")}</p>
                  <p className="text-lg font-bold">{formatCurrency(totalMonthlyFixed)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-violet-500/5 p-3 dark:bg-violet-500/10">
                <PiggyBank className="h-5 w-5 text-violet-500" />
                <div>
                  <p className="text-muted-foreground text-xs">{t("reservesLabel")}</p>
                  <p className="text-lg font-bold">{formatCurrency(totalReserves)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-red-500/5 p-3 dark:bg-red-500/10">
                <Repeat className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-muted-foreground text-xs">{t("totalPerMonth")}</p>
                  <p className="text-lg font-bold">{formatCurrency(totalNormalizedMonthly)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 p-2">
              <CalendarRange className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <CardTitle>{t("threeMonthForecast")}</CardTitle>
              <CardDescription>
                {hasForecast ? (
                  <>
                    {t("projectedBalance")}{" "}
                    <span
                      className={`font-semibold ${forecast.projectedBalance >= 0 ? "text-emerald-500" : "text-red-500"}`}
                    >
                      {formatCurrency(forecast.projectedBalance)}
                    </span>
                  </>
                ) : (
                  t("financialOutlook")
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!hasForecast ? (
            <div className="py-12 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-500/5">
                <CalendarRange className="h-6 w-6 text-blue-500/50" />
              </div>
              <p className="text-muted-foreground text-sm">{t("addDataForForecast")}</p>
            </div>
          ) : (
            <div className="stagger-children grid gap-4 md:grid-cols-3">
              {forecast.monthlyDetails.map((detail) => {
                const isPositive = detail.balance >= 0;
                return (
                  <div
                    key={`${detail.year}-${detail.month}`}
                    className="bg-accent/20 border-border/50 rounded-2xl border p-4 transition-colors duration-200 dark:border-white/[0.06] dark:bg-white/[0.03] hover:dark:bg-white/[0.05]"
                  >
                    <p className="mb-3 text-sm font-semibold capitalize">
                      {getMonthName(detail.month)} {detail.year}
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="text-muted-foreground text-xs">{t("income")}</span>
                        </div>
                        <span className="text-sm font-medium text-emerald-500">
                          {formatCurrency(detail.income)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                          <span className="text-muted-foreground text-xs">{t("expenses")}</span>
                        </div>
                        <span className="text-sm font-medium text-red-500">
                          {formatCurrency(detail.expenses)}
                        </span>
                      </div>
                      <div className="bg-border/50 my-1 h-px dark:bg-white/[0.06]" />
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">{t("balance")}</span>
                        <span
                          className={`text-sm font-bold ${isPositive ? "text-emerald-500" : "text-red-500"}`}
                        >
                          {formatCurrency(detail.balance)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
