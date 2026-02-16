'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import { useSettings } from '@/lib/settings-context';
import type { DailyExpenseWithDetails } from '@/types/database';

interface DashboardStats {
  totalAssets: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  savingsRate: number;
  incomeTrend: number;
  expenseTrend: number;
}

interface CategoryBreakdown {
  categoryId: string | null;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  total: number;
  percentage: number;
}

interface DashboardClientProps {
  stats: DashboardStats;
  categoryBreakdown: CategoryBreakdown[];
  recentTransactions: DailyExpenseWithDetails[];
}

function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' }).format(new Date(date));
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

function KpiCard({ title, value, subtitle, icon, iconBg, valueColor, trend, accentLine }: KpiCardProps) {
  return (
    <Card className="relative overflow-hidden hover:-translate-y-0.5 hover:dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_32px_rgba(0,0,0,0.32)] cursor-default">
      {/* Top accent line */}
      {accentLine && (
        <div
          className="absolute top-0 left-6 right-6 h-px rounded-full opacity-60"
          style={{ background: accentLine }}
        />
      )}

      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle
            className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground/70"
            style={{ fontFamily: 'var(--font-jakarta)' }}
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
          className={`text-[1.75rem] leading-none tracking-[-0.04em] font-bold mb-2 ${valueColor || 'text-foreground'}`}
          style={{ fontFamily: 'var(--font-syne)' }}
        >
          {value}
        </div>
        <p className="text-xs text-muted-foreground/60 flex items-center gap-1">
          {trend !== undefined && trend !== 0 && (
            <span className={`inline-flex items-center gap-0.5 font-medium ${trend > 0 ? 'text-emerald-500' : 'text-red-400'}`}>
              {trend > 0
                ? <TrendingUp className="h-3 w-3" />
                : <TrendingDown className="h-3 w-3" />
              }
              {Math.abs(trend).toFixed(1)}%
            </span>
          )}
          {trend === 0 && (
            <span className="inline-flex items-center gap-0.5 text-muted-foreground/40">
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
}: DashboardClientProps) {
  const { formatCurrency } = useSettings();
  const hasExpenses = categoryBreakdown.length > 0;
  const hasTransactions = recentTransactions.length > 0;

  const today = new Date().toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-7 stagger-children">
      {/* Page header */}
      <div className="flex items-end justify-between">
        <div>
          <h2
            className="text-[2rem] font-bold tracking-[-0.03em] leading-none"
            style={{
              fontFamily: 'var(--font-syne)',
              background: 'linear-gradient(135deg, var(--foreground) 0%, color-mix(in srgb, var(--foreground) 55%, transparent) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Dashboard
          </h2>
          <p
            className="text-sm text-muted-foreground/60 mt-1.5 tracking-wide"
            style={{ fontFamily: 'var(--font-jakarta)' }}
          >
            {today}
          </p>
        </div>

        {/* Total assets badge */}
        <div className="hidden sm:flex flex-col items-end gap-0.5">
          <span
            className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50"
            style={{ fontFamily: 'var(--font-jakarta)' }}
          >
            Gesamtvermögen
          </span>
          <span
            className="text-xl font-bold tracking-[-0.03em] text-foreground"
            style={{ fontFamily: 'var(--font-syne)' }}
          >
            {formatCurrency(stats.totalAssets)}
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Gesamtvermögen"
          value={formatCurrency(stats.totalAssets)}
          subtitle="Alle Konten summiert"
          icon={<Wallet className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
          iconBg="linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.06))"
          accentLine="linear-gradient(90deg, transparent, rgba(245,158,11,0.5), transparent)"
        />

        <KpiCard
          title="Monatliche Einnahmen"
          value={formatCurrency(stats.monthlyIncome)}
          subtitle="vs. letzten Monat"
          icon={<ArrowUpRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
          iconBg="linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.06))"
          valueColor="text-emerald-600 dark:text-emerald-400"
          trend={stats.incomeTrend}
          accentLine="linear-gradient(90deg, transparent, rgba(16,185,129,0.45), transparent)"
        />

        <KpiCard
          title="Monatliche Ausgaben"
          value={formatCurrency(stats.monthlyExpenses)}
          subtitle="vs. letzten Monat"
          icon={<ArrowDownRight className="h-4 w-4 text-red-500 dark:text-red-400" />}
          iconBg="linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.06))"
          valueColor="text-red-500 dark:text-red-400"
          trend={stats.expenseTrend}
          accentLine="linear-gradient(90deg, transparent, rgba(239,68,68,0.4), transparent)"
        />

        <KpiCard
          title="Sparquote"
          value={formatCurrency(stats.savingsRate)}
          subtitle={stats.savingsRate >= 0 ? 'Überschuss diesen Monat' : 'Defizit diesen Monat'}
          icon={<PiggyBank className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
          iconBg="linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.06))"
          valueColor={stats.savingsRate >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}
          accentLine={stats.savingsRate >= 0
            ? 'linear-gradient(90deg, transparent, rgba(16,185,129,0.4), transparent)'
            : 'linear-gradient(90deg, transparent, rgba(239,68,68,0.4), transparent)'
          }
        />
      </div>

      {/* Bottom panels */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* Category Breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle
                  className="text-base"
                  style={{ fontFamily: 'var(--font-syne)' }}
                >
                  Ausgaben nach Kategorie
                </CardTitle>
                <CardDescription className="mt-1 text-xs">Dieser Monat</CardDescription>
              </div>
              {hasExpenses && (
                <span
                  className="text-xs font-medium text-muted-foreground/50 bg-white/5 dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-2 py-1"
                  style={{ fontFamily: 'var(--font-jakarta)' }}
                >
                  {categoryBreakdown.length} Kategorien
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!hasExpenses ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <div className="text-3xl opacity-20">📊</div>
                <p
                  className="text-sm text-muted-foreground/50 text-center"
                  style={{ fontFamily: 'var(--font-jakarta)' }}
                >
                  Noch keine Ausgaben diesen Monat
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {categoryBreakdown.slice(0, 6).map((category) => (
                  <div
                    key={category.categoryId || 'other'}
                    className="group space-y-2 p-3 rounded-xl hover:bg-white/4 dark:hover:bg-white/[0.04] transition-all duration-200 border border-transparent hover:border-border/40 dark:hover:border-white/[0.05]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0"
                          style={{
                            background: category.categoryColor
                              ? `linear-gradient(135deg, ${category.categoryColor}28, ${category.categoryColor}0e)`
                              : 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))',
                          }}
                        >
                          {category.categoryIcon || '📦'}
                        </div>
                        <span
                          className="text-sm font-medium text-foreground/80"
                          style={{ fontFamily: 'var(--font-jakarta)' }}
                        >
                          {category.categoryName}
                        </span>
                      </div>
                      <div className="text-right">
                        <span
                          className="text-sm font-semibold text-foreground"
                          style={{ fontFamily: 'var(--font-syne)' }}
                        >
                          {formatCurrency(category.total)}
                        </span>
                        <span
                          className="text-xs text-muted-foreground/50 ml-1.5 tabular-nums"
                          style={{ fontFamily: 'var(--font-jakarta)' }}
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

        {/* Recent Transactions */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle
                  className="text-base"
                  style={{ fontFamily: 'var(--font-syne)' }}
                >
                  Letzte Transaktionen
                </CardTitle>
                <CardDescription className="mt-1 text-xs">Deine letzten Ausgaben</CardDescription>
              </div>
              {hasTransactions && (
                <span
                  className="text-xs font-medium text-muted-foreground/50 bg-white/5 dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-2 py-1"
                  style={{ fontFamily: 'var(--font-jakarta)' }}
                >
                  {recentTransactions.length} Einträge
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!hasTransactions ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <div className="text-3xl opacity-20">💳</div>
                <p
                  className="text-sm text-muted-foreground/50 text-center"
                  style={{ fontFamily: 'var(--font-jakarta)' }}
                >
                  Noch keine Transaktionen vorhanden
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {recentTransactions.map((transaction, i) => (
                  <div
                    key={transaction.id}
                    className="group flex items-center justify-between p-3 rounded-xl hover:bg-white/4 dark:hover:bg-white/[0.04] transition-all duration-200 border border-transparent hover:border-border/40 dark:hover:border-white/[0.05]"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-red-500/[0.18] to-red-500/[0.06]">
                        <span className="text-base leading-none">
                          {transaction.category?.icon || '💸'}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p
                          className="text-sm font-medium text-foreground/90 truncate"
                          style={{ fontFamily: 'var(--font-jakarta)' }}
                        >
                          {transaction.description}
                        </p>
                        <p
                          className="text-xs text-muted-foreground/50 mt-0.5"
                          style={{ fontFamily: 'var(--font-jakarta)' }}
                        >
                          {transaction.category?.name || 'Ohne Kategorie'}
                          <span className="mx-1.5 opacity-40">·</span>
                          {formatDate(transaction.date)}
                        </p>
                      </div>
                    </div>
                    <span
                      className="font-semibold text-sm text-red-500 dark:text-red-400 shrink-0 ml-3"
                      style={{ fontFamily: 'var(--font-syne)' }}
                    >
                      −{formatCurrency(typeof transaction.amount === 'string' ? parseFloat(transaction.amount) : transaction.amount)}
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
