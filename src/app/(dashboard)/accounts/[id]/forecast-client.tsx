"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  Calendar,
  Loader2,
  ArrowRightLeft,
} from "lucide-react";
import { getAccountForecast, type AccountForecast } from "@/actions/forecast-actions";
import { useSettings } from "@/lib/settings-context";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

interface ForecastClientProps {
  accountId: string;
  currentBalance: string;
}

type TimeHorizon = "3" | "6" | "12";

export function ForecastClient({ accountId, currentBalance }: ForecastClientProps) {
  const { formatCurrency } = useSettings();
  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>("6");
  const [forecast, setForecast] = useState<AccountForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const t = useTranslations("accounts");

  useEffect(() => {
    let cancelled = false;
    getAccountForecast(accountId, parseInt(timeHorizon))
      .then((result) => {
        if (cancelled) return;
        if (result.success) {
          setForecast(result.data);
        } else {
          setForecast(null);
          toast.error(result.error || t("forecastLoadError"));
        }
      })
      .catch(() => {
        if (!cancelled) toast.error(t("forecastLoadError"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, timeHorizon, t]);

  const changeTimeHorizon = (value: TimeHorizon) => {
    setLoading(true);
    setTimeHorizon(value);
  };

  const summary = forecast
    ? {
        totalIncome: forecast.projectedMonths.reduce((sum, m) => sum + m.income, 0),
        totalExpenses: forecast.projectedMonths.reduce((sum, m) => sum + m.expenses, 0),
        totalTransfersIn: forecast.projectedMonths.reduce((sum, m) => sum + m.transfersIn, 0),
        totalTransfersOut: forecast.projectedMonths.reduce((sum, m) => sum + m.transfersOut, 0),
        finalBalance:
          forecast.projectedMonths.length > 0
            ? forecast.projectedMonths[forecast.projectedMonths.length - 1].cumulativeBalance
            : parseFloat(currentBalance),
        change: forecast.isCumulativeAccount
          ? forecast.projectedMonths.length > 0
            ? forecast.projectedMonths[forecast.projectedMonths.length - 1].cumulativeBalance -
              forecast.currentBalance
            : 0
          : forecast.projectedMonths.reduce((sum, m) => sum + m.balance, 0),
      }
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!forecast || !summary) {
    return (
      <Card className="border border-white/[0.08] bg-white/5 backdrop-blur-xl">
        <CardContent className="py-8">
          <p className="text-muted-foreground text-center">{t("forecastLoadError")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h3 className="text-xl font-semibold">{t("forecastTitle")}</h3>
        <Select value={timeHorizon} onValueChange={(v) => changeTimeHorizon(v as TimeHorizon)}>
          <SelectTrigger className="w-[180px] rounded-xl border-white/[0.08] bg-white/5 backdrop-blur-sm">
            <Calendar className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">{t("months3")}</SelectItem>
            <SelectItem value="6">{t("months6")}</SelectItem>
            <SelectItem value="12">{t("months12")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

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
              {formatCurrency(summary.totalIncome)}
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
              {formatCurrency(summary.totalExpenses)}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-white/[0.08] bg-white/5 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              {summary.change >= 0 ? (
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              {t("change")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${summary.change >= 0 ? "text-emerald-500" : "text-red-500"}`}
            >
              {summary.change >= 0 ? "+" : ""}
              {formatCurrency(summary.change)}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-white/[0.08] bg-white/5 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              <TrendingUp className="h-4 w-4" />
              {/* Checking accounts are not projected cumulatively: the value is the last month's net */}
              {forecast.isCumulativeAccount ? t("endBalance") : t("lastMonthNet")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${summary.finalBalance >= 0 ? "text-emerald-500" : "text-red-500"}`}
            >
              {formatCurrency(summary.finalBalance)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-white/[0.08] bg-white/5 backdrop-blur-xl">
        <CardHeader>
          <CardTitle>{t("monthlyProjection")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {forecast.projectedMonths.map((month, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/5 p-4 transition-all duration-300 hover:border-white/15 hover:bg-white/10"
              >
                <div className="flex flex-1 items-center gap-4">
                  <div className="w-24 text-sm font-medium">
                    {month.monthName} {month.year}
                  </div>

                  <div className="flex flex-1 items-center gap-6">
                    <div className="flex items-center gap-2">
                      <div className="rounded-lg bg-emerald-500/10 p-1.5">
                        <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                      </div>
                      <span className="text-sm text-emerald-500">
                        {formatCurrency(month.income)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="rounded-lg bg-red-500/10 p-1.5">
                        <ArrowDownRight className="h-3 w-3 text-red-500" />
                      </div>
                      <span className="text-sm text-red-500">{formatCurrency(month.expenses)}</span>
                    </div>

                    {(month.transfersIn > 0 || month.transfersOut > 0) && (
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-blue-500/10 p-1.5">
                          <ArrowRightLeft className="h-3 w-3 text-blue-500" />
                        </div>
                        <span className="text-sm text-blue-500">
                          {month.transfersIn > 0 && `+${formatCurrency(month.transfersIn)}`}
                          {month.transfersIn > 0 && month.transfersOut > 0 && " / "}
                          {month.transfersOut > 0 && `-${formatCurrency(month.transfersOut)}`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div
                      className={`text-sm font-medium ${month.balance >= 0 ? "text-emerald-500" : "text-red-500"}`}
                    >
                      {month.balance >= 0 ? "+" : ""}
                      {formatCurrency(month.balance)}
                    </div>
                  </div>

                  <div className="h-8 w-px bg-white/10" />

                  <div className="min-w-[100px] text-right">
                    <p className="text-muted-foreground text-xs">
                      {forecast.isCumulativeAccount ? t("balance") : t("net")}
                    </p>
                    <div
                      className={`text-sm font-bold ${(forecast.isCumulativeAccount ? month.cumulativeBalance : month.balance) >= 0 ? "text-emerald-500" : "text-red-500"}`}
                    >
                      {formatCurrency(
                        forecast.isCumulativeAccount ? month.cumulativeBalance : month.balance
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-white/[0.08] bg-white/5 backdrop-blur-xl">
        <CardHeader>
          <CardTitle>
            {forecast.isCumulativeAccount ? t("cumulativeDevelopment") : t("monthlyBalance")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {forecast.projectedMonths.map((month, index) => {
              const startBalance = forecast.isCumulativeAccount ? forecast.currentBalance : 0;
              const displayBalance = forecast.isCumulativeAccount
                ? month.cumulativeBalance
                : month.balance;
              const allBalances = forecast.isCumulativeAccount
                ? forecast.projectedMonths.map((m) => m.cumulativeBalance)
                : forecast.projectedMonths.map((m) => m.balance);
              const minBalance = Math.min(startBalance, ...allBalances);
              const maxBalance = Math.max(startBalance, ...allBalances);
              const range = maxBalance - minBalance || 1;
              const position = ((displayBalance - minBalance) / range) * 100;

              return (
                <div key={index} className="flex items-center gap-3">
                  <div className="text-muted-foreground w-24 text-xs">
                    {month.monthName} {month.year}
                  </div>
                  <div className="relative h-8 flex-1 overflow-hidden rounded-lg bg-white/5">
                    <div
                      className={`absolute top-0 bottom-0 rounded-lg ${
                        displayBalance >= 0
                          ? "bg-gradient-to-r from-emerald-500/30 to-emerald-500/10"
                          : "bg-gradient-to-r from-red-500/30 to-red-500/10"
                      }`}
                      style={{ width: `${Math.max(5, position)}%` }}
                    />
                    <div
                      className={`absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full ${
                        displayBalance >= 0 ? "bg-emerald-500" : "bg-red-500"
                      }`}
                      style={{ left: `${Math.max(2, Math.min(98, position))}%` }}
                    />
                  </div>
                  <div
                    className={`w-24 text-right text-sm font-medium ${displayBalance >= 0 ? "text-emerald-500" : "text-red-500"}`}
                  >
                    {formatCurrency(displayBalance)}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
