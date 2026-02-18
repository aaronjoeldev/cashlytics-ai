'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
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
} from 'lucide-react';
import { useSettings } from '@/lib/settings-context';
import { getMonthlyPaymentsCalendar } from '@/actions/analytics-actions';
import type { MonthlyOverview, Forecast, CategoryBreakdown, ExpenseWithDetails } from '@/types/database';
import type { CalendarDay, CalendarPayment } from '@/actions/analytics-actions';

interface OverviewClientProps {
  month: number;
  year: number;
  overview: MonthlyOverview | null;
  forecast: Forecast | null;
  categoryBreakdown: CategoryBreakdown[];
  normalizedExpenses: Array<{ expense: ExpenseWithDetails; monthlyAmount: number }>;
  subscriptions: Array<{ expense: ExpenseWithDetails; monthlyAmount: number }>;
  initialCalendarDays: CalendarDay[];
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

function getNextPaymentDate(expense: { recurrenceType: string; startDate: Date | string; recurrenceInterval: number | null; endDate?: Date | string | null }): Date | null {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = new Date(expense.startDate);
  
  if (expense.endDate) {
    const endDate = new Date(expense.endDate);
    if (endDate < now) return null;
  }
  
  switch (expense.recurrenceType) {
    case 'daily': {
      const next = new Date(now);
      next.setDate(next.getDate() + 1);
      return next;
    }
    case 'weekly': {
      const daysUntilNext = (7 - ((now.getDay() - start.getDay() + 7) % 7)) % 7 || 7;
      const next = new Date(now);
      next.setDate(next.getDate() + daysUntilNext);
      return next;
    }
    case 'monthly': {
      const next = new Date(now.getFullYear(), now.getMonth(), start.getDate());
      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
      }
      return next;
    }
    case 'quarterly': {
      const monthsToAdd = 3 - ((now.getMonth() - start.getMonth() + 3) % 3);
      const next = new Date(now.getFullYear(), now.getMonth() + monthsToAdd, start.getDate());
      if (next <= now) {
        next.setMonth(next.getMonth() + 3);
      }
      return next;
    }
    case 'yearly': {
      const next = new Date(now.getFullYear(), start.getMonth(), start.getDate());
      if (next <= now) {
        next.setFullYear(next.getFullYear() + 1);
      }
      return next;
    }
    case 'custom': {
      if (!expense.recurrenceInterval) return start;
      const monthsDiff = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
      const monthsUntilNext = expense.recurrenceInterval - (monthsDiff % expense.recurrenceInterval);
      const next = new Date(now.getFullYear(), now.getMonth() + monthsUntilNext, start.getDate());
      if (next <= now) {
        next.setMonth(next.getMonth() + expense.recurrenceInterval);
      }
      return next;
    }
    default:
      return null;
  }
}

function formatNextPayment(expense: { recurrenceType: string; startDate: Date | string; recurrenceInterval: number | null; endDate?: Date | string | null }): string | null {
  const nextDate = getNextPaymentDate(expense);
  if (!nextDate) return null;
  
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffTime = nextDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Heute';
  if (diffDays === 1) return 'Morgen';
  if (diffDays <= 7) return `In ${diffDays} Tagen`;
  
  return new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' }).format(nextDate);
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
}: OverviewClientProps) {
  const { formatCurrency } = useSettings();
  const [calendarExpanded, setCalendarExpanded] = useState(true);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(month);
  const [calendarYear, setCalendarYear] = useState(year);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>(initialCalendarDays);
  const [calendarLoading, setCalendarLoading] = useState(false);

  const fetchCalendarData = useCallback(async (y: number, m: number) => {
    setCalendarLoading(true);
    try {
      const result = await getMonthlyPaymentsCalendar(y, m);
      if (result.success && result.data) {
        setCalendarDays(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch calendar data:', error);
    } finally {
      setCalendarLoading(false);
    }
  }, []);

  useEffect(() => {
    if (calendarMonth !== month || calendarYear !== year) {
      fetchCalendarData(calendarYear, calendarMonth);
    }
  }, [calendarMonth, calendarYear, month, year, fetchCalendarData]);

  const goToPrevMonth = () => {
    if (calendarMonth === 1) {
      setCalendarMonth(12);
      setCalendarYear(calendarYear - 1);
    } else {
      setCalendarMonth(calendarMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (calendarMonth === 12) {
      setCalendarMonth(1);
      setCalendarYear(calendarYear + 1);
    } else {
      setCalendarMonth(calendarMonth + 1);
    }
  };

  const goToCurrentMonth = () => {
    setCalendarMonth(month);
    setCalendarYear(year);
  };

  const isCurrentMonth = calendarMonth === month && calendarYear === year;
  
  const totalIncome = overview?.totalIncome ?? 0;
  const totalExpenses = overview?.totalExpenses ?? 0;
  const balance = overview?.balance ?? 0;
  const hasBreakdown = categoryBreakdown.length > 0;
  const hasExpenses = normalizedExpenses.length > 0;
  const hasForecast = forecast && forecast.monthlyDetails.length > 0;
  const hasSubscriptions = subscriptions.length > 0;

  const totalNormalizedMonthly = normalizedExpenses.reduce((sum, e) => sum + e.monthlyAmount, 0);
  const totalSubscriptionsMonthly = subscriptions.reduce((sum, s) => sum + s.monthlyAmount, 0);

  const monthlyFixed = normalizedExpenses.filter(e => e.expense.recurrenceType === 'monthly');
  const periodicReserves = normalizedExpenses.filter(e => e.expense.recurrenceType !== 'monthly' && e.expense.recurrenceType !== 'once');
  const totalMonthlyFixed = monthlyFixed.reduce((sum, e) => sum + e.monthlyAmount, 0);
  const totalReserves = periodicReserves.reduce((sum, e) => sum + e.monthlyAmount, 0);

  const handleDayClick = (day: CalendarDay) => {
    if (day.payments.length > 0) {
      setSelectedDay(day);
    }
  };

  const formatDayDate = (date: Date): string => {
    return new Intl.DateTimeFormat('de-DE', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long',
      year: 'numeric'
    }).format(date);
  };

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

      {/* Monthly Calendar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCalendarExpanded(!calendarExpanded)}>
              <div className="bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl p-2">
                <Calendar className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle>Zahlungskalender</CardTitle>
                <CardDescription>Geplante Ein- und Ausgaben im Überblick</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {!isCurrentMonth && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goToCurrentMonth}
                  className="text-xs h-7 px-2"
                >
                  Heute
                </Button>
              )}
              <button className="p-2 hover:bg-accent rounded-lg transition-colors" onClick={goToPrevMonth}>
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              <button className="p-2 hover:bg-accent rounded-lg transition-colors" onClick={goToNextMonth}>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
              <button className="p-2 hover:bg-accent rounded-lg transition-colors" onClick={() => setCalendarExpanded(!calendarExpanded)}>
                {calendarExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>
        </CardHeader>
        {calendarExpanded && (
          <CardContent>
            <div className="flex items-center justify-center mb-4">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPrevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-lg font-semibold min-w-[160px] text-center capitalize">
                  {getMonthName(calendarMonth)} {calendarYear}
                </span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {calendarLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day) => (
                    <div key={day} className="text-center text-xs font-medium text-muted-foreground/60 py-2">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day: CalendarDay, i: number) => {
                    const hasPayments = day.payments.length > 0;
                    const isToday = day.date.toDateString() === new Date().toDateString();
                    
                    return (
                      <div
                        key={i}
                        onClick={() => handleDayClick(day)}
                        className={`
                          relative min-h-[60px] p-1.5 rounded-lg border transition-all
                          ${day.isCurrentMonth 
                            ? 'bg-card border-border/50 dark:border-white/[0.06]' 
                            : 'bg-muted/30 border-transparent'}
                          ${isToday 
                            ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' 
                            : ''}
                          ${hasPayments 
                            ? 'cursor-pointer hover:border-primary/30 hover:bg-accent/30' 
                            : ''}
                          ${selectedDay?.date.toDateString() === day.date.toDateString() 
                            ? 'border-primary bg-primary/5' 
                            : ''}
                        `}
                      >
                        <span className={`
                          text-sm font-medium
                          ${day.isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/40'}
                          ${isToday ? 'text-primary' : ''}
                        `}>
                          {day.dayOfMonth}
                        </span>
                        {hasPayments && (
                          <div className="mt-1 space-y-0.5">
                            {day.payments.slice(0, 2).map((payment: CalendarPayment, pi: number) => (
                              <div
                                key={pi}
                                className={`
                                  text-[10px] px-1 py-0.5 rounded truncate
                                  ${payment.type === 'income' 
                                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                                    : 'bg-red-500/20 text-red-600 dark:text-red-400'}
                                `}
                              >
                                {payment.name.slice(0, 8)}
                              </div>
                            ))}
                            {day.payments.length > 2 && (
                              <div className="text-[10px] text-muted-foreground px-1">
                                +{day.payments.length - 2} mehr
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
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/50">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-emerald-500/20"></div>
                <span className="text-xs text-muted-foreground">Einnahmen</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-red-500/20"></div>
                <span className="text-xs text-muted-foreground">Ausgaben</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded ring-2 ring-primary"></div>
                <span className="text-xs text-muted-foreground">Heute</span>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Selected Day Detail Overlay */}
      {selectedDay && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedDay(null)}
        >
          <Card 
            className="w-full max-w-md max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl p-2">
                    <Calendar className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      {formatDayDate(selectedDay.date)}
                    </CardTitle>
                    <CardDescription>
                      {selectedDay.payments.length} Zahlung{selectedDay.payments.length !== 1 ? 'en' : ''}
                    </CardDescription>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedDay(null)}
                  className="p-2 hover:bg-accent rounded-lg transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {selectedDay.payments.map((payment, i) => (
                  <div 
                    key={i}
                    className="flex items-center justify-between p-3 rounded-xl bg-accent/30 dark:bg-white/[0.03]"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          background: payment.category?.color
                            ? `linear-gradient(135deg, ${payment.category.color}28, ${payment.category.color}0e)`
                            : payment.type === 'income'
                              ? 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05))'
                              : 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))',
                        }}
                      >
                        <span className="text-base">
                          {payment.isSubscription ? '💳' : payment.category?.icon || (payment.type === 'income' ? '💰' : '💸')}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{payment.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {payment.category?.name || (payment.type === 'income' ? 'Einnahme' : 'Ausgabe')}
                          {payment.isSubscription && ' · Abo'}
                        </p>
                      </div>
                    </div>
                    <span className={`font-semibold text-sm ${payment.type === 'income' ? 'text-emerald-500' : 'text-red-500'}`}>
                      {payment.type === 'income' ? '+' : '−'}{formatCurrency(payment.amount)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Saldo des Tages</span>
                  <span className={`font-bold ${
                    selectedDay.payments.reduce((sum, p) => sum + (p.type === 'income' ? p.amount : -p.amount), 0) >= 0
                      ? 'text-emerald-500'
                      : 'text-red-500'
                  }`}>
                    {formatCurrency(selectedDay.payments.reduce((sum, p) => sum + (p.type === 'income' ? p.amount : -p.amount), 0))}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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

      {/* Subscriptions Card */}
      {hasSubscriptions && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 rounded-xl p-2">
                  <CreditCard className="h-4 w-4 text-cyan-500" />
                </div>
                <div>
                  <CardTitle>Laufende Abos</CardTitle>
                  <CardDescription>
                    {subscriptions.length} Abonnement{subscriptions.length !== 1 ? 's' : ''} &middot; Monatlich: <span className="font-semibold text-foreground">{formatCurrency(totalSubscriptionsMonthly)}</span>
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {subscriptions
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
                        <span className="text-base">{item.expense.category?.icon || '💳'}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{item.expense.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.expense.category?.name ?? 'Ohne Kategorie'} &middot; {getRecurrenceLabel(item.expense.recurrenceType, item.expense.recurrenceInterval)}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{formatCurrency(item.monthlyAmount)}<span className="text-xs text-muted-foreground font-normal">/Mo</span></span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                .map((item) => {
                  const nextPayment = formatNextPayment(item.expense);
                  return (
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
                            {nextPayment && <span className="text-emerald-600 dark:text-emerald-400 ml-2">• Nächste: {nextPayment}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold tabular-nums">{formatCurrency(item.monthlyAmount)}<span className="text-xs text-muted-foreground font-normal">/Mo</span></span>
                        <p className="text-xs text-muted-foreground">Rücklage</p>
                      </div>
                    </div>
                  );
                })}
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
