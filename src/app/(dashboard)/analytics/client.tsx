'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslations } from 'next-intl';
import { useSettings } from '@/lib/settings-context';
import { ArrowUpRight, ArrowDownRight, PiggyBank, TrendingUp, BarChart3, PieChart, LineChart, Loader2 } from 'lucide-react';
import { getMonthlyOverview, getCategoryBreakdown } from '@/actions/analytics-actions';
import type { Account } from '@/types/database';
import dynamic from 'next/dynamic';
import {
  Bar,
  Line,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

// Chart containers need ssr:false (use browser layout APIs)
const BarChartComp = dynamic(() => import('recharts').then((m) => m.BarChart), { ssr: false });
const LineChartComp = dynamic(() => import('recharts').then((m) => m.LineChart), { ssr: false });
const PieChartComp = dynamic(() => import('recharts').then((m) => m.PieChart), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then((m) => m.ResponsiveContainer), { ssr: false });

export interface MonthlyTrendItem {
  month: string;
  income: number;
  expenses: number;
  savings: number;
}

export interface CategoryItem {
  name: string;
  amount: number;
  percentage: number;
  color: string | null;
  icon: string | null;
}

export interface AnalyticsClientProps {
  monthlyTrend: MonthlyTrendItem[];
  categoryBreakdown: CategoryItem[];
  currentMonthIncome: number;
  currentMonthExpenses: number;
  accounts: Account[];
  currentMonth: number;
  currentYear: number;
}

const AMBER_PALETTE = ['#fbbf24', '#f59e0b', '#d97706', '#b45309', '#92400e', '#fcd34d', '#fde68a', '#78350f'];

function EmptyState({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-4">
        <Icon className="h-7 w-7 text-primary/40" />
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export function AnalyticsClient({
  monthlyTrend: initialMonthlyTrend,
  categoryBreakdown: initialCategoryBreakdown,
  currentMonthIncome: initialCurrentMonthIncome,
  currentMonthExpenses: initialCurrentMonthExpenses,
  accounts,
  currentMonth,
  currentYear,
}: AnalyticsClientProps) {
  const t = useTranslations('analytics');
  const tCommon = useTranslations('common');
  const { formatCurrency: fmt, currency } = useSettings();

  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [monthlyTrend, setMonthlyTrend] = useState(initialMonthlyTrend);
  const [categoryBreakdown, setCategoryBreakdown] = useState(initialCategoryBreakdown);
  const [currentMonthIncome, setCurrentMonthIncome] = useState(initialCurrentMonthIncome);
  const [currentMonthExpenses, setCurrentMonthExpenses] = useState(initialCurrentMonthExpenses);

  const fetchForAccount = useCallback(async (accountId: string | undefined) => {
    setLoading(true);
    try {
      const trendMonths: Array<{ month: number; year: number; label: string }> = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - 1 - i, 1);
        trendMonths.push({
          month: d.getMonth() + 1,
          year: d.getFullYear(),
          label: d.toLocaleDateString('de-DE', { month: 'short' }),
        });
      }

      const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
      const endOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59);

      const [overviewResults, breakdownResult] = await Promise.all([
        Promise.all(trendMonths.map(({ month, year }) => getMonthlyOverview(month, year, accountId))),
        getCategoryBreakdown(startOfMonth, endOfMonth, accountId),
      ]);

      const newTrend: MonthlyTrendItem[] = trendMonths.map(({ label }, i) => {
        const result = overviewResults[i];
        if (result.success && result.data) {
          return {
            month: label,
            income: result.data.totalIncome,
            expenses: result.data.totalExpenses,
            savings: result.data.totalIncome - result.data.totalExpenses,
          };
        }
        return { month: label, income: 0, expenses: 0, savings: 0 };
      });

      const currentOverview = overviewResults[5];
      setCurrentMonthIncome(currentOverview.success && currentOverview.data ? currentOverview.data.totalIncome : 0);
      setCurrentMonthExpenses(currentOverview.success && currentOverview.data ? currentOverview.data.totalExpenses : 0);

      setMonthlyTrend(newTrend);
      setCategoryBreakdown(
        breakdownResult.success && breakdownResult.data
          ? breakdownResult.data.map((item) => ({
              name: item.category.name,
              amount: item.amount,
              percentage: item.percentage,
              color: item.category.color,
              icon: item.category.icon,
            }))
          : []
      );
    } finally {
      setLoading(false);
    }
  }, [currentMonth, currentYear]);

  useEffect(() => {
    if (selectedAccountId === 'all') {
      setMonthlyTrend(initialMonthlyTrend);
      setCategoryBreakdown(initialCategoryBreakdown);
      setCurrentMonthIncome(initialCurrentMonthIncome);
      setCurrentMonthExpenses(initialCurrentMonthExpenses);
    } else {
      fetchForAccount(selectedAccountId);
    }
  }, [selectedAccountId, initialMonthlyTrend, initialCategoryBreakdown, initialCurrentMonthIncome, initialCurrentMonthExpenses, fetchForAccount]);

  const fmtShort = (amount: number) => {
    const locale = currency === 'USD' ? 'en-US' : currency === 'GBP' ? 'en-GB' : currency === 'DKK' ? 'da-DK' : 'de-DE';
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  };

  const tooltipFormatter = (value: unknown) => {
    if (value === undefined || value === null) return '';
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    if (isNaN(num)) return '';
    return fmt(num);
  };

  const savings = currentMonthIncome - currentMonthExpenses;
  const savingsRate = currentMonthIncome > 0 ? (savings / currentMonthIncome) * 100 : 0;
  const hasTrend = monthlyTrend.some(m => m.income > 0 || m.expenses > 0);
  const hasCategories = categoryBreakdown.length > 0;
  const noDataLabel = t('noDataChart');

  // Detect mixed account currencies — shown as hint in chart headers
  const uniqueAccountCurrencies = new Set(accounts.map(a => a.currency));
  const hasMultiCurrency = uniqueAccountCurrencies.size > 1;
  const baseCurrencyHint = hasMultiCurrency ? ` (≈ ${currency})` : '';

  const cardCls = 'bg-card/80 dark:bg-white/[0.03] backdrop-blur-xl border-border/50 dark:border-white/[0.08]';
  const iconWrapCls = 'bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl p-2';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-[2rem] font-bold tracking-[-0.03em] leading-none bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">{t('title')}</h2>
          <p className="text-sm text-muted-foreground/60 mt-1.5">{t('description')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {accounts.length > 1 && (
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId} disabled={loading}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tCommon('allAccounts')}</SelectItem>
                {accounts.map(account => (
                  <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className={`${cardCls} hover:-translate-y-0.5 transition-all duration-300`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('kpiIncome')}</CardTitle>
            <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 rounded-xl p-2">
              <ArrowUpRight className="h-4 w-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">{fmt(currentMonthIncome)}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('kpiIncomeDescription')}</p>
          </CardContent>
        </Card>

        <Card className={`${cardCls} hover:-translate-y-0.5 transition-all duration-300`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('kpiExpenses')}</CardTitle>
            <div className="bg-gradient-to-br from-red-500/20 to-red-500/5 rounded-xl p-2">
              <ArrowDownRight className="h-4 w-4 text-red-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{fmt(currentMonthExpenses)}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('kpiExpensesDescription')}</p>
          </CardContent>
        </Card>

        <Card className={`${cardCls} hover:-translate-y-0.5 transition-all duration-300`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('kpiSavings')}</CardTitle>
            <div className={`rounded-xl p-2 ${savings >= 0 ? 'bg-gradient-to-br from-primary/20 to-primary/5' : 'bg-gradient-to-br from-red-500/20 to-red-500/5'}`}>
              <PiggyBank className={`h-4 w-4 ${savings >= 0 ? 'text-primary' : 'text-red-500'}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${savings >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{fmt(savings)}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('kpiSavingsDescription')}</p>
          </CardContent>
        </Card>

        <Card className={`${cardCls} hover:-translate-y-0.5 transition-all duration-300`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('kpiSavingsRate')}</CardTitle>
            <div className={iconWrapCls}><TrendingUp className="h-4 w-4 text-primary" /></div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${savingsRate >= 0 ? 'text-primary' : 'text-red-500'}`}>{savingsRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">{t('kpiSavingsRateDescription')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1: BarChart + Donut */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className={cardCls}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className={iconWrapCls}><BarChart3 className="h-4 w-4 text-primary" /></div>
              <div>
                <CardTitle>{t('incomeVsExpenses')}</CardTitle>
                <CardDescription>{t('incomeVsExpensesDescription')}{baseCurrencyHint}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!hasTrend ? <EmptyState icon={BarChart3} label={noDataLabel} /> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChartComp data={monthlyTrend} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={fmtShort} />
                  <Tooltip formatter={tooltipFormatter} cursor={{ fill: 'rgba(128,128,128,0.05)' }} />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} formatter={(v: string) => <span style={{ color: 'hsl(var(--muted-foreground))' }}>{v}</span>} />
                  <Bar dataKey="income" name={t('income')} fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="expenses" name={t('expenses')} fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChartComp>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className={cardCls}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className={iconWrapCls}><PieChart className="h-4 w-4 text-primary" /></div>
              <div>
                <CardTitle>{t('expensesByCategory')}</CardTitle>
                <CardDescription>{t('expensesByCategoryDescription')}{baseCurrencyHint}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!hasCategories ? <EmptyState icon={PieChart} label={noDataLabel} /> : (
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                <div className="flex-shrink-0 w-full sm:w-[180px]">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChartComp>
                      <Pie data={categoryBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="amount" nameKey="name">
                        {categoryBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color || AMBER_PALETTE[index % AMBER_PALETTE.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={tooltipFormatter} />
                    </PieChartComp>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1 min-w-0 w-full py-2">
                  {categoryBreakdown.slice(0, 7).map((item, index) => (
                    <div key={index} className="flex items-center justify-between gap-2 py-1 rounded-lg hover:bg-accent/20 dark:hover:bg-white/[0.03] px-2 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color || AMBER_PALETTE[index % AMBER_PALETTE.length] }} />
                        <span className="text-xs font-medium truncate">{item.icon ? `${item.icon} ` : ''}{item.name}</span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-xs font-semibold tabular-nums">{fmtShort(item.amount)}</span>
                        <span className="text-xs text-muted-foreground ml-1">({item.percentage.toFixed(0)}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Line Chart: Monthly Trend */}
      <Card className={cardCls}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className={iconWrapCls}><LineChart className="h-4 w-4 text-primary" /></div>
            <div>
              <CardTitle>{t('monthlyTrend')}</CardTitle>
              <CardDescription>{t('monthlyTrendDescription')}{baseCurrencyHint}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!hasTrend ? <EmptyState icon={LineChart} label={noDataLabel} /> : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChartComp data={monthlyTrend} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={fmtShort} />
                <Tooltip formatter={tooltipFormatter} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} formatter={(v: string) => <span style={{ color: 'hsl(var(--muted-foreground))' }}>{v}</span>} />
                <Line type="monotone" dataKey="income" name={t('income')} stroke="#10b981" strokeWidth={2.5} dot={{ fill: '#10b981', r: 3, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
                <Line type="monotone" dataKey="expenses" name={t('expenses')} stroke="#ef4444" strokeWidth={2.5} dot={{ fill: '#ef4444', r: 3, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
                <Line type="monotone" dataKey="savings" name={t('savings')} stroke="#fbbf24" strokeWidth={2.5} strokeDasharray="5 3" dot={{ fill: '#fbbf24', r: 3, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
              </LineChartComp>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
