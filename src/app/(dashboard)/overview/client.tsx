'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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
} from 'lucide-react';
import { useSettings } from '@/lib/settings-context';
import type { MonthlyOverview, Forecast, CategoryBreakdown, ExpenseWithDetails } from '@/types/database';

interface OverviewClientProps {
  month: number;
  year: number;
  overview: MonthlyOverview | null;
  forecast: Forecast | null;
  categoryBreakdown: CategoryBreakdown[];
  normalizedExpenses: Array<{ expense: ExpenseWithDetails; monthlyAmount: number }>;
}

function getMonthName(month: number): string {
  return new Date(2024, month - 1).toLocaleDateString('de-DE', { month: 'long' });
}

function getRecurrenceLabel(type: string, interval: number | null): string {
  switch (type) {
    case 'daily': return 'Täglich';
    case 'weekly': return 'Wöchentlich';
    case 'monthly': return 'Monatlich';
    case 'quarterly': return 'Vierteljährlich';
    case 'yearly': return 'Jährlich';
    case 'custom': return interval ? `Alle ${interval} Monate` : 'Benutzerdefiniert';
    case 'once': return 'Einmalig';
    default: return type;
  }
}

export function OverviewClient({
  month,
  year,
  overview,
  forecast,
  categoryBreakdown,
  normalizedExpenses,
}: OverviewClientProps) {
  const { formatCurrency } = useSettings();
  const totalIncome = overview?.totalIncome ?? 0;
  const totalExpenses = overview?.totalExpenses ?? 0;
  const balance = overview?.balance ?? 0;
  const hasBreakdown = categoryBreakdown.length > 0;
  const hasExpenses = normalizedExpenses.length > 0;
  const hasForecast = forecast && forecast.monthlyDetails.length > 0;

  const totalNormalizedMonthly = normalizedExpenses.reduce((sum, e) => sum + e.monthlyAmount, 0);

  // Split expenses: monthly fixed costs vs. periodic reserves
  const monthlyFixed = normalizedExpenses.filter(e => e.expense.recurrenceType === 'monthly');
  const periodicReserves = normalizedExpenses.filter(e => e.expense.recurrenceType !== 'monthly' && e.expense.recurrenceType !== 'once');
  const totalMonthlyFixed = monthlyFixed.reduce((sum, e) => sum + e.monthlyAmount, 0);
  const totalReserves = periodicReserves.reduce((sum, e) => sum + e.monthlyAmount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-[2rem] font-bold tracking-[-0.03em] leading-none bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
          Übersicht
        </h2>
        <p className="text-sm text-muted-foreground/60 mt-1.5">
          {getMonthName(month)} {year} &mdash; Deine finanzielle Gesamtübersicht
        </p>
      </div>

      {/* Monthly Balance KPIs */}
      <div className="grid gap-4 md:grid-cols-3 stagger-children">
        {/* Income */}
        <Card className="hover:bg-card/80 dark:hover:bg-white/[0.08] hover:-translate-y-0.5 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Einnahmen</CardTitle>
            <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 rounded-xl p-2">
              <ArrowUpRight className="h-4 w-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">{formatCurrency(totalIncome)}</div>
            <p className="text-xs text-muted-foreground mt-1">Monatliches Einkommen</p>
          </CardContent>
        </Card>

        {/* Expenses */}
        <Card className="hover:bg-card/80 dark:hover:bg-white/[0.08] hover:-translate-y-0.5 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ausgaben</CardTitle>
            <div className="bg-gradient-to-br from-red-500/20 to-red-500/5 rounded-xl p-2">
              <ArrowDownRight className="h-4 w-4 text-red-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{formatCurrency(totalExpenses)}</div>
            <p className="text-xs text-muted-foreground mt-1">Fixkosten + variable Ausgaben</p>
          </CardContent>
        </Card>

        {/* Balance */}
        <Card className={`hover:bg-card/80 dark:hover:bg-white/[0.08] hover:-translate-y-0.5 transition-all duration-300 ${balance >= 0 ? 'dark:shadow-[0_0_30px_rgba(52,211,153,0.08)]' : 'dark:shadow-[0_0_30px_rgba(248,113,113,0.08)]'}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bilanz</CardTitle>
            <div className={`rounded-xl p-2 ${balance >= 0 ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-500/5' : 'bg-gradient-to-br from-red-500/20 to-red-500/5'}`}>
              <Scale className={`h-4 w-4 ${balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {formatCurrency(balance)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {balance >= 0 ? 'Überschuss diesen Monat' : 'Defizit diesen Monat'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Category Breakdown */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl p-2">
                <PieChart className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle>Ausgaben nach Kategorie</CardTitle>
                <CardDescription>{getMonthName(month)} {year}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!hasBreakdown ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mx-auto mb-3">
                  <PieChart className="h-6 w-6 text-primary/50" />
                </div>
                <p className="text-muted-foreground text-sm">Noch keine Ausgaben diesen Monat</p>
              </div>
            ) : (
              <div className="space-y-1">
                {categoryBreakdown.map((item) => (
                  <div key={item.category.id} className="p-3 rounded-xl hover:bg-accent/30 dark:hover:bg-white/5 transition-colors duration-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center"
                          style={{
                            background: item.category.color
                              ? `linear-gradient(135deg, ${item.category.color}33, ${item.category.color}11)`
                              : undefined,
                          }}
                        >
                          <span className="text-base">{item.category.icon || '📦'}</span>
                        </div>
                        <span className="text-sm font-medium">{item.category.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold">{formatCurrency(item.amount)}</span>
                        <span className="text-xs text-muted-foreground ml-2">{item.percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                    <Progress value={item.percentage} className="h-1.5" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly Fixed Costs */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-amber-500/20 to-amber-500/5 rounded-xl p-2">
                <Wallet className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <CardTitle>Monatliche Fixkosten</CardTitle>
                <CardDescription>
                  {monthlyFixed.length > 0 ? (
                    <>Wird jeden Monat abgebucht: <span className="font-semibold text-foreground">{formatCurrency(totalMonthlyFixed)}</span></>
                  ) : (
                    'Feste monatliche Abbuchungen'
                  )}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {monthlyFixed.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 flex items-center justify-center mx-auto mb-3">
                  <Wallet className="h-6 w-6 text-amber-500/50" />
                </div>
                <p className="text-muted-foreground text-sm">Keine monatlichen Fixkosten erfasst</p>
              </div>
            ) : (
              <div className="space-y-1">
                {monthlyFixed
                  .sort((a, b) => b.monthlyAmount - a.monthlyAmount)
                  .map((item) => (
                    <div key={item.expense.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-accent/30 dark:hover:bg-white/5 transition-colors duration-200">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center"
                          style={{
                            background: item.expense.category?.color
                              ? `linear-gradient(135deg, ${item.expense.category.color}33, ${item.expense.category.color}11)`
                              : undefined,
                          }}
                        >
                          <span className="text-base">{item.expense.category?.icon || '💰'}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{item.expense.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.expense.category?.name ?? 'Ohne Kategorie'}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold tabular-nums">{formatCurrency(item.monthlyAmount)}<span className="text-xs text-muted-foreground font-normal">/Mo</span></span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Periodic Reserves */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-violet-500/20 to-violet-500/5 rounded-xl p-2">
              <PiggyBank className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <CardTitle>Rücklagen für periodische Ausgaben</CardTitle>
              <CardDescription>
                {periodicReserves.length > 0 ? (
                  <>Monatlich zurücklegen: <span className="font-semibold text-foreground">{formatCurrency(totalReserves)}</span> &mdash; damit größere Zahlungen gedeckt sind</>
                ) : (
                  'Monatliche Rücklage für nicht-monatliche Ausgaben'
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {periodicReserves.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/10 to-violet-500/5 flex items-center justify-center mx-auto mb-3">
                <PiggyBank className="h-6 w-6 text-violet-500/50" />
              </div>
              <p className="text-muted-foreground text-sm">Keine periodischen Ausgaben erfasst</p>
            </div>
          ) : (
            <div className="space-y-1">
              {periodicReserves
                .sort((a, b) => b.monthlyAmount - a.monthlyAmount)
                .map((item) => (
                  <div key={item.expense.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-accent/30 dark:hover:bg-white/5 transition-colors duration-200">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center"
                        style={{
                          background: item.expense.category?.color
                            ? `linear-gradient(135deg, ${item.expense.category.color}33, ${item.expense.category.color}11)`
                            : undefined,
                        }}
                      >
                        <span className="text-base">{item.expense.category?.icon || '💰'}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{item.expense.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(parseFloat(item.expense.amount))} &middot; {getRecurrenceLabel(item.expense.recurrenceType, item.expense.recurrenceInterval)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold tabular-nums">{formatCurrency(item.monthlyAmount)}<span className="text-xs text-muted-foreground font-normal">/Mo</span></span>
                      <p className="text-xs text-muted-foreground">Rücklage</p>
                    </div>
                  </div>
                ))}
              <div className="mt-3 p-3 rounded-xl bg-violet-500/5 dark:bg-violet-500/10 border border-violet-500/10 dark:border-violet-500/15">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Gesamt monatlich zurücklegen</span>
                  <span className="text-sm font-bold text-violet-500">{formatCurrency(totalReserves)}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary: Total monthly commitment */}
      {hasExpenses && (
        <Card className="border-primary/20 dark:border-primary/10">
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/5 dark:bg-amber-500/10">
                <Wallet className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Fixkosten</p>
                  <p className="text-lg font-bold">{formatCurrency(totalMonthlyFixed)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-violet-500/5 dark:bg-violet-500/10">
                <PiggyBank className="h-5 w-5 text-violet-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Rücklagen</p>
                  <p className="text-lg font-bold">{formatCurrency(totalReserves)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/5 dark:bg-red-500/10">
                <Repeat className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Gesamt pro Monat</p>
                  <p className="text-lg font-bold">{formatCurrency(totalNormalizedMonthly)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Forecast */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500/20 to-blue-500/5 rounded-xl p-2">
              <CalendarRange className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <CardTitle>3-Monats-Prognose</CardTitle>
              <CardDescription>
                {hasForecast ? (
                  <>Projizierte Bilanz: <span className={`font-semibold ${forecast.projectedBalance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{formatCurrency(forecast.projectedBalance)}</span></>
                ) : (
                  'Finanzielle Vorausschau'
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!hasForecast ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 flex items-center justify-center mx-auto mb-3">
                <CalendarRange className="h-6 w-6 text-blue-500/50" />
              </div>
              <p className="text-muted-foreground text-sm">Erfasse Einnahmen und Ausgaben für eine Prognose</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3 stagger-children">
              {forecast.monthlyDetails.map((detail) => {
                const isPositive = detail.balance >= 0;
                return (
                  <div
                    key={`${detail.year}-${detail.month}`}
                    className="p-4 rounded-2xl bg-accent/20 dark:bg-white/[0.03] border border-border/50 dark:border-white/[0.06] hover:dark:bg-white/[0.05] transition-colors duration-200"
                  >
                    <p className="text-sm font-semibold mb-3 capitalize">{getMonthName(detail.month)} {detail.year}</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="text-xs text-muted-foreground">Einnahmen</span>
                        </div>
                        <span className="text-sm font-medium text-emerald-500">{formatCurrency(detail.income)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                          <span className="text-xs text-muted-foreground">Ausgaben</span>
                        </div>
                        <span className="text-sm font-medium text-red-500">{formatCurrency(detail.expenses)}</span>
                      </div>
                      <div className="h-px bg-border/50 dark:bg-white/[0.06] my-1" />
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">Bilanz</span>
                        <span className={`text-sm font-bold ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
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
