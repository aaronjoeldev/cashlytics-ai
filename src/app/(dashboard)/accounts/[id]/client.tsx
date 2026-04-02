"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Building2,
  PiggyBank,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  TrendingUp as ForecastIcon,
  ArrowRightLeft,
} from "lucide-react";
import { useSettings } from "@/lib/settings-context";
import { convertCurrency, currencies, type Currency } from "@/lib/currency";
import { useTranslations } from "next-intl";
import type {
  Account,
  ExpenseWithDetails,
  IncomeWithAccount,
  TransferWithDetails,
} from "@/types/database";
import { ForecastClient } from "./forecast-client";

interface AccountDetailClientProps {
  account: Account;
  initialExpenses: ExpenseWithDetails[];
  initialIncomes: IncomeWithAccount[];
  initialTransfers: TransferWithDetails[];
}

function isTransactionInMonth(
  item: {
    startDate: Date | string;
    endDate?: Date | string | null;
    recurrenceType: string;
    recurrenceInterval?: number | null;
  },
  monthStart: Date,
  monthEnd: Date
): boolean {
  const itemStart = new Date(item.startDate);
  const itemEnd = item.endDate ? new Date(item.endDate) : null;

  if (itemStart > monthEnd) return false;
  if (itemEnd !== null && itemEnd < monthStart) return false;

  const monthDiff =
    (monthStart.getFullYear() - itemStart.getFullYear()) * 12 +
    (monthStart.getMonth() - itemStart.getMonth());

  switch (item.recurrenceType) {
    case "once":
      return itemStart >= monthStart && itemStart <= monthEnd;
    case "daily":
    case "weekly":
    case "monthly":
      return true;
    case "quarterly":
      return monthDiff >= 0 && monthDiff % 3 === 0;
    case "semiannual":
      return monthDiff >= 0 && monthDiff % 6 === 0;
    case "yearly":
      return monthDiff >= 0 && monthDiff % 12 === 0;
    case "custom": {
      const interval = item.recurrenceInterval;
      if (!interval) return true;
      return monthDiff >= 0 && monthDiff % interval === 0;
    }
    default:
      return true;
  }
}

function getTransactionDateForMonth(
  item: {
    startDate: Date | string;
    recurrenceType: string;
  },
  monthStart: Date,
  monthEnd: Date
): Date {
  const itemStart = new Date(item.startDate);

  switch (item.recurrenceType) {
    case "once":
      return itemStart;
    case "daily":
      return itemStart > monthStart ? itemStart : monthStart;
    case "weekly": {
      const firstInMonth = new Date(monthStart);
      const daysToAdd = (itemStart.getDay() - firstInMonth.getDay() + 7) % 7;
      firstInMonth.setDate(firstInMonth.getDate() + daysToAdd);
      if (firstInMonth < itemStart) {
        firstInMonth.setDate(firstInMonth.getDate() + 7);
      }
      return firstInMonth <= monthEnd ? firstInMonth : monthStart;
    }
    default: {
      const maxDay = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
      return new Date(
        monthStart.getFullYear(),
        monthStart.getMonth(),
        Math.min(itemStart.getDate(), maxDay)
      );
    }
  }
}

function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

function getMonthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();

  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
    options.push({ value, label });
  }

  return options;
}

type Transaction = {
  id: string;
  type: "income" | "expense" | "transfer_in" | "transfer_out";
  name: string;
  amount: string;
  date: Date | string;
  category?: { name: string } | null;
  description?: string | null;
};

function normalizeExpenseToMonthly(
  amount: number,
  recurrenceType: string,
  recurrenceInterval: number | null
): number {
  switch (recurrenceType) {
    case "daily":
      return amount * 30;
    case "weekly":
      return amount * 4.33;
    case "monthly":
      return amount;
    case "quarterly":
      return amount / 3;
    case "semiannual":
      return amount / 6;
    case "yearly":
      return amount / 12;
    case "custom":
      return recurrenceInterval ? amount / recurrenceInterval : amount;
    default:
      return amount;
  }
}

function normalizeIncomeToMonthly(amount: number, recurrenceType: string): number {
  switch (recurrenceType) {
    case "monthly":
      return amount;
    case "yearly":
      return amount / 12;
    default:
      return amount;
  }
}

function normalizeTransferToMonthly(amount: number, recurrenceType: string): number {
  switch (recurrenceType) {
    case "monthly":
      return amount;
    case "quarterly":
      return amount / 3;
    case "yearly":
      return amount / 12;
    default:
      return amount;
  }
}

export function AccountDetailClient({
  account,
  initialExpenses,
  initialIncomes,
  initialTransfers,
}: AccountDetailClientProps) {
  const router = useRouter();
  const { formatCurrency: fmt, currency: baseCurrency } = useSettings();
  const formatCurrency = (amount: string | number) =>
    fmt(typeof amount === "string" ? parseFloat(amount) : amount);
  const toBase = (amount: number, entryCurrency?: string | null): number => {
    const from = (entryCurrency && currencies.includes(entryCurrency as Currency))
      ? (entryCurrency as Currency)
      : baseCurrency;
    return convertCurrency(amount, from, baseCurrency);
  };
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [calculationMode, setCalculationMode] = useState<"cashflow" | "reserve">("cashflow");
  const t = useTranslations("accounts");
  const tCommon = useTranslations("common");

  const accountTypeConfig = {
    checking: { label: t("types.checking"), icon: Building2, color: "text-blue-600" },
    savings: { label: t("types.savings"), icon: PiggyBank, color: "text-emerald-500" },
    etf: { label: t("types.etf"), icon: TrendingUp, color: "text-purple-600" },
  };

  const monthOptions = getMonthOptions();
  const selectedMonthLabel =
    monthOptions.find((option) => option.value === selectedMonth)?.label ?? selectedMonth;

  const transactions = useMemo<Transaction[]>(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const filteredExpenses = initialExpenses.filter((e) =>
      isTransactionInMonth(e, startDate, endDate)
    );
    const filteredIncomes = initialIncomes.filter((i) =>
      isTransactionInMonth(i, startDate, endDate)
    );
    const filteredTransfers = initialTransfers.filter((t) =>
      isTransactionInMonth(t, startDate, endDate)
    );

    const expenseTransactions: Transaction[] = filteredExpenses.map((e) => {
      const rawAmount = parseFloat(e.amount);
      const normalizedAmount =
        calculationMode === "reserve" && e.recurrenceType !== "once"
          ? normalizeExpenseToMonthly(rawAmount, e.recurrenceType, e.recurrenceInterval)
          : rawAmount;

      return {
        id: e.id,
        type: "expense" as const,
        name: e.name,
        amount: toBase(normalizedAmount, e.currency).toString(),
        date: getTransactionDateForMonth(e, startDate, endDate),
        category: e.category,
      };
    });

    const incomeTransactions: Transaction[] = filteredIncomes.map((i) => {
      const rawAmount = parseFloat(i.amount);
      const normalizedAmount =
        calculationMode === "reserve" && i.recurrenceType !== "once"
          ? normalizeIncomeToMonthly(rawAmount, i.recurrenceType)
          : rawAmount;

      return {
        id: i.id,
        type: "income" as const,
        name: i.source,
        amount: toBase(normalizedAmount, i.currency).toString(),
        date: getTransactionDateForMonth(i, startDate, endDate),
      };
    });

    const transferTransactions: Transaction[] = filteredTransfers.map((t) => {
      const rawAmount = parseFloat(t.amount);
      const normalizedAmount =
        calculationMode === "reserve" && t.recurrenceType !== "once"
          ? normalizeTransferToMonthly(rawAmount, t.recurrenceType)
          : rawAmount;

      return {
        id: t.id,
        type:
          t.targetAccountId === account.id ? ("transfer_in" as const) : ("transfer_out" as const),
        name: t.description || "Transfer",
        amount: toBase(normalizedAmount, t.sourceCurrency).toString(),
        date: getTransactionDateForMonth(t, startDate, endDate),
        description:
          t.targetAccountId === account.id
            ? `von ${t.sourceAccount?.name || "Unbekannt"}`
            : `nach ${t.targetAccount?.name || "Unbekannt"}`,
      };
    });

    return [...expenseTransactions, ...incomeTransactions, ...transferTransactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [
    selectedMonth,
    initialExpenses,
    initialIncomes,
    initialTransfers,
    account.id,
    calculationMode,
    baseCurrency,
  ]);

  const summary = useMemo(() => {
    const income = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const expenses = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const transfersIn = transactions
      .filter((t) => t.type === "transfer_in")
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const transfersOut = transactions
      .filter((t) => t.type === "transfer_out")
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    return {
      income,
      expenses,
      transfersIn,
      transfersOut,
      balance: income - expenses + transfersIn - transfersOut,
    };
  }, [transactions]);

  const config = accountTypeConfig[account.type];
  const Icon = config.icon;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/accounts")}
          className="rounded-xl border border-white/[0.08] bg-white/5 backdrop-blur-sm hover:bg-white/10"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {tCommon("back")}
        </Button>
      </div>

      <Card className="border border-white/[0.08] bg-white/5 backdrop-blur-xl">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex-shrink-0 rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/10 to-white/5 p-3">
                <Icon className={`h-6 w-6 ${config.color}`} />
              </div>
              <div className="min-w-0">
                <CardTitle className="truncate text-2xl">{account.name}</CardTitle>
                <p className="text-muted-foreground text-sm">{config.label}</p>
              </div>
            </div>
            <div className="flex-shrink-0 text-right">
              <div
                className={`text-2xl font-bold sm:text-3xl ${summary.balance >= 0 ? "text-emerald-500" : "text-red-500"}`}
              >
                {formatCurrency(summary.balance)}
              </div>
              <p className="text-muted-foreground text-xs">
                {t("monthlyBalance")} • {selectedMonthLabel}
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="transactions" className="space-y-6">
        <TabsList className="border border-white/[0.08] bg-white/5 backdrop-blur-sm">
          <TabsTrigger value="transactions" className="gap-2">
            <Receipt className="h-4 w-4" />
            {t("transactions")}
          </TabsTrigger>
          <TabsTrigger value="forecast" className="gap-2">
            <ForecastIcon className="h-4 w-4" />
            {t("forecast")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h3 className="text-xl font-semibold">{t("transactions")}</h3>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center rounded-lg border border-white/[0.08] bg-white/5 p-1">
                <button
                  type="button"
                  onClick={() => setCalculationMode("cashflow")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                    calculationMode === "cashflow"
                      ? "text-foreground bg-white/10"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t("viewModes.cashflow")}
                </button>
                <button
                  type="button"
                  onClick={() => setCalculationMode("reserve")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                    calculationMode === "reserve"
                      ? "text-foreground bg-white/10"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t("viewModes.reserve")}
                </button>
              </div>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[180px] rounded-xl border-white/[0.08] bg-white/5 backdrop-blur-sm">
                  <SelectValue placeholder={t("selectMonth")} />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-muted-foreground text-xs">{t(`viewExplanation.${calculationMode}`)}</p>

          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border border-white/[0.08] bg-white/5 backdrop-blur-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                  <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                  {t("income")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-500">
                  {formatCurrency(summary.income)}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-white/[0.08] bg-white/5 backdrop-blur-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                  <ArrowDownRight className="h-4 w-4 text-red-500" />
                  {t("expenses")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">
                  {formatCurrency(summary.expenses)}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-white/[0.08] bg-white/5 backdrop-blur-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                  <ArrowRightLeft className="h-4 w-4 text-blue-500" />
                  {t("transfers")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {summary.transfersIn > 0 && (
                    <span className="text-sm text-emerald-500">
                      +{formatCurrency(summary.transfersIn)}
                    </span>
                  )}
                  {summary.transfersIn > 0 && summary.transfersOut > 0 && (
                    <span className="text-muted-foreground">/</span>
                  )}
                  {summary.transfersOut > 0 && (
                    <span className="text-sm text-red-500">
                      -{formatCurrency(summary.transfersOut)}
                    </span>
                  )}
                  {summary.transfersIn === 0 && summary.transfersOut === 0 && (
                    <span className="text-muted-foreground text-sm">0,00 €</span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-white/[0.08] bg-white/5 backdrop-blur-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                  <TrendingUp className="h-4 w-4" />
                  {t("monthlyBalance")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${summary.balance >= 0 ? "text-emerald-500" : "text-red-500"}`}
                >
                  {formatCurrency(summary.balance)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border border-white/[0.08] bg-white/5 backdrop-blur-xl">
            <CardHeader>
              <CardTitle>{t("transactionList")}</CardTitle>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">
                  {t("noTransactionsThisMonth")}
                </p>
              ) : (
                <div className="space-y-2">
                  {transactions.map((transaction) => {
                    const isTransfer =
                      transaction.type === "transfer_in" || transaction.type === "transfer_out";
                    const isPositive =
                      transaction.type === "income" || transaction.type === "transfer_in";

                    return (
                      <div
                        key={`${transaction.type}-${transaction.id}`}
                        className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-white/5 p-4 transition-all duration-300 hover:border-white/15 hover:bg-white/10"
                      >
                        <div
                          className={`flex-shrink-0 rounded-lg p-2 ${
                            isTransfer
                              ? "bg-blue-500/10 text-blue-500"
                              : isPositive
                                ? "bg-emerald-500/10 text-emerald-500"
                                : "bg-red-500/10 text-red-500"
                          }`}
                        >
                          {isTransfer ? (
                            <ArrowRightLeft className="h-4 w-4" />
                          ) : isPositive ? (
                            <ArrowUpRight className="h-4 w-4" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          {/* Zeile 1: Name links, Betrag rechts */}
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium">{transaction.name}</p>
                            <p
                              className={`flex-shrink-0 font-semibold whitespace-nowrap ${
                                isTransfer
                                  ? "text-blue-500"
                                  : isPositive
                                    ? "text-emerald-500"
                                    : "text-red-500"
                              }`}
                            >
                              {isPositive ? "+" : "-"}
                              {formatCurrency(transaction.amount)}
                            </p>
                          </div>
                          {/* Zeile 2: Kategorie / Beschreibung + Datum */}
                          <p className="text-muted-foreground mt-0.5 text-xs">
                            {isTransfer
                              ? transaction.description
                              : transaction.category?.name ||
                                (isPositive ? t("income") : t("expenses"))}
                            {" • "}
                            {formatDate(transaction.date)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forecast">
          <ForecastClient accountId={account.id} currentBalance={account.balance} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
