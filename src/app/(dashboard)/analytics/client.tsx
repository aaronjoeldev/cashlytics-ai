'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from 'next-intl';
import { useSettings } from '@/lib/settings-context';
import { ArrowUpRight, ArrowDownRight, PiggyBank, TrendingUp, BarChart3, PieChart, LineChart } from 'lucide-react';
import dynamic from 'next/dynamic';

const BarChartComp = dynamic(() => import('recharts').then((m) => m.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then((m) => m.Bar), { ssr: false });
const LineChartComp = dynamic(() => import('recharts').then((m) => m.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then((m) => m.Line), { ssr: false });
const PieChartComp = dynamic(() => import('recharts').then((m) => m.PieChart), { ssr: false });
const Pie = dynamic(() => import('recharts').then((m) => m.Pie), { ssr: false });
const Cell = dynamic(() => import('recharts').then((m) => m.Cell), { ssr: false });
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then((m) => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false });
const Legend = dynamic(() => import('recharts').then((m) => m.Legend), { ssr: false });
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

export function AnalyticsClient({ monthlyTrend, categoryBreakdown, currentMonthIncome, currentMonthExpenses }: AnalyticsClientProps) {
  const t = useTranslations('analytics');
  const { formatCurrency: fmt, currency } = useSettings();

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

  const cardCls = 'bg-card/80 dark:bg-white/[0.03] backdrop-blur-xl border-border/50 dark:border-white/[0.08]';
  const iconWrapCls = 'bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl p-2';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[2rem] font-bold tracking-[-0.03em] leading-none bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">{t('title')}</h2>
        <p className="text-sm text-muted-foreground/60 mt-1.5">{t('description')}</p>
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
                <CardDescription>{t('incomeVsExpensesDescription')}</CardDescription>
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
                <CardDescription>{t('expensesByCategoryDescription')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!hasCategories ? <EmptyState icon={PieChart} label={noDataLabel} /> : (
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <ResponsiveContainer width={180} height={180}>
                    <PieChartComp>
                      <Pie data={categoryBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="amount" nameKey="name">
                        {categoryBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color ?? AMBER_PALETTE[index % AMBER_PALETTE.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={tooltipFormatter} />
                    </PieChartComp>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1 min-w-0 py-2">
                  {categoryBreakdown.slice(0, 7).map((item, index) => (
                    <div key={index} className="flex items-center justify-between gap-2 py-1 rounded-lg hover:bg-accent/20 dark:hover:bg-white/[0.03] px-2 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color ?? AMBER_PALETTE[index % AMBER_PALETTE.length] }} />
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
              <CardDescription>{t('monthlyTrendDescription')}</CardDescription>
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
