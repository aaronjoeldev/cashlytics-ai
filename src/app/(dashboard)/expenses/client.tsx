'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Trash2, Wallet, PiggyBank, Repeat, CalendarDays, Pencil } from 'lucide-react';
import { ExpenseForm } from '@/components/organisms/expense-form';
import { deleteExpense, deleteDailyExpense } from '@/actions/expense-actions';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/lib/settings-context';
import { useTranslations } from 'next-intl';
import type { Account, Category, Expense, DailyExpense, ExpenseWithDetails, DailyExpenseWithDetails } from '@/types/database';

interface ExpensesClientProps {
  accounts: Account[];
  categories: Category[];
  initialExpenses: ExpenseWithDetails[];
  initialDailyExpenses: DailyExpenseWithDetails[];
}

function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat().format(new Date(date));
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

function formatNextPayment(expense: { recurrenceType: string; startDate: Date | string; recurrenceInterval: number | null; endDate?: Date | string | null }, t: (key: string, params?: Record<string, number>) => string): string | null {
  const nextDate = getNextPaymentDate(expense);
  if (!nextDate) return null;
  
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffTime = nextDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return t('today');
  if (diffDays === 1) return t('tomorrow');
  if (diffDays <= 7) return t('inDays', { count: diffDays });
  
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(nextDate);
}

function normalizeToMonthly(amount: number, recurrenceType: string, recurrenceInterval: number | null): number {
  switch (recurrenceType) {
    case 'daily': return amount * 30;
    case 'weekly': return amount * 4.33;
    case 'monthly': return amount;
    case 'quarterly': return amount / 3;
    case 'yearly': return amount / 12;
    case 'custom': return recurrenceInterval ? amount / recurrenceInterval : amount;
    default: return 0;
  }
}

export function ExpensesClient({
  accounts,
  categories: initialCategories,
  initialExpenses,
  initialDailyExpenses,
}: ExpensesClientProps) {
  const { toast } = useToast();
  const { formatCurrency: fmt } = useSettings();
  const t = useTranslations('expenses');
  const tCommon = useTranslations('common');
  const tRecurrence = useTranslations('recurrence');
  const formatCurrency = (amount: string | number) => fmt(typeof amount === 'string' ? parseFloat(amount) : amount);
  const [categories, setCategories] = useState(initialCategories);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [dailyExpenses, setDailyExpenses] = useState(initialDailyExpenses);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingDailyExpense, setEditingDailyExpense] = useState<DailyExpense | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const monthlyFixed = expenses.filter(e => e.recurrenceType === 'monthly');
  const periodicReserves = expenses.filter(e => e.recurrenceType !== 'monthly' && e.recurrenceType !== 'once');
  const oneTimeExpenses = expenses.filter(e => e.recurrenceType === 'once');

  const totalMonthlyFixed = monthlyFixed.reduce((sum, e) => sum + parseFloat(e.amount), 0);
  const totalReserves = periodicReserves.reduce((sum, e) => sum + normalizeToMonthly(parseFloat(e.amount), e.recurrenceType, e.recurrenceInterval), 0);
  const totalNormalized = totalMonthlyFixed + totalReserves;

  const getDebitLabel = (expense: { recurrenceType: string; startDate: Date | string; recurrenceInterval: number | null }): string => {
    const date = new Date(expense.startDate);
    const day = date.getDate();
    const month = date.toLocaleDateString(undefined, { month: 'short' });

    switch (expense.recurrenceType) {
      case 'monthly':
        return tRecurrence('monthly');
      case 'quarterly':
        return `${day}. ${month} (${tRecurrence('quarterly')})`;
      case 'yearly':
        return `${day}. ${month} (${tRecurrence('yearly')})`;
      case 'weekly': {
        const weekday = date.toLocaleDateString(undefined, { weekday: 'long' });
        return tRecurrence('weekly');
      }
      case 'custom':
        return tRecurrence('everyMonths', { count: expense.recurrenceInterval ?? 1 });
      default:
        return formatDate(expense.startDate);
    }
  };

  const handleCategoryCreated = (category: Category) => {
    setCategories(prev => [...prev, category]);
    toast({ title: t('categoryCreated'), description: t('categoryCreatedDesc', { name: category.name }) });
  };

  const handleSuccess = (data: { type: 'periodic' | 'daily'; item: { id: string; categoryId?: string; accountId?: string; [key: string]: unknown } }) => {
    if (data.type === 'periodic') {
      const newExpense = {
        ...data.item,
        category: categories.find(c => c.id === data.item.categoryId) || null,
        account: accounts.find(a => a.id === data.item.accountId) || null,
      } as ExpenseWithDetails;
      setExpenses(prev => [newExpense, ...prev]);
    } else {
      const newDailyExpense = {
        ...data.item,
        category: categories.find(c => c.id === data.item.categoryId) || null,
        account: accounts.find(a => a.id === data.item.accountId) || null,
      } as DailyExpenseWithDetails;
      setDailyExpenses(prev => [newDailyExpense, ...prev]);
    }
  };

  const handleEditSuccess = (data: { type: 'periodic' | 'daily'; item: { id: string; categoryId?: string; accountId?: string; [key: string]: unknown } }) => {
    if (data.type === 'periodic') {
      const updatedExpense = {
        ...data.item,
        category: categories.find(c => c.id === data.item.categoryId) || null,
        account: accounts.find(a => a.id === data.item.accountId) || null,
      } as ExpenseWithDetails;
      setExpenses(prev => prev.map(e => e.id === data.item.id ? updatedExpense : e));
    } else {
      const updatedDailyExpense = {
        ...data.item,
        category: categories.find(c => c.id === data.item.categoryId) || null,
        account: accounts.find(a => a.id === data.item.accountId) || null,
      } as DailyExpenseWithDetails;
      setDailyExpenses(prev => prev.map(e => e.id === data.item.id ? updatedDailyExpense : e));
    }
    setEditingExpense(null);
    setEditingDailyExpense(null);
    setEditDialogOpen(false);
    toast({ title: t('updated'), description: t('updatedDesc') });
  };

  const handleEditExpense = (expense: ExpenseWithDetails) => {
    setEditingExpense(expense);
    setEditingDailyExpense(null);
    setEditDialogOpen(true);
  };

  const handleEditDailyExpense = (expense: DailyExpenseWithDetails) => {
    setEditingDailyExpense(expense);
    setEditingExpense(null);
    setEditDialogOpen(true);
  };

  const handleDeleteExpense = async (id: string, name: string) => {
    if (!confirm(t('deleteConfirm', { name }))) return;

    const result = await deleteExpense(id);
    if (result.success) {
      setExpenses(prev => prev.filter(e => e.id !== id));
      toast({ title: tCommon('delete'), description: `"${name}" wurde entfernt.` });
    } else {
      toast({ title: t('deleteFailed'), variant: 'destructive' });
    }
  };

  const handleDeleteDailyExpense = async (id: string, description: string) => {
    if (!confirm(t('deleteConfirm', { name: description }))) return;

    const result = await deleteDailyExpense(id);
    if (result.success) {
      setDailyExpenses(prev => prev.filter(e => e.id !== id));
      toast({ title: tCommon('delete'), description: `"${description}" wurde entfernt.` });
    } else {
      toast({ title: t('deleteFailed'), variant: 'destructive' });
    }
  };

  const ExpenseRow = ({ expense, onEdit, onDelete }: { expense: ExpenseWithDetails; onEdit: () => void; onDelete: () => void }) => {
    const amount = parseFloat(expense.amount);
    const monthly = normalizeToMonthly(amount, expense.recurrenceType, expense.recurrenceInterval);
    const isMonthly = expense.recurrenceType === 'monthly';
    const isOnce = expense.recurrenceType === 'once';
    const debitLabel = !isOnce ? getDebitLabel(expense) : null;
    const nextPaymentLabel = !isOnce ? formatNextPayment(expense, tCommon) : null;

    return (
      <div className="flex items-center justify-between p-4 rounded-xl hover:bg-accent/30 dark:hover:bg-white/5 transition-colors duration-200">
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
            style={{
              background: expense.category?.color
                ? `linear-gradient(135deg, ${expense.category.color}33, ${expense.category.color}11)`
                : undefined,
            }}
          >
            {expense.category?.icon ?? '📄'}
          </div>
          <div>
            <p className="font-medium">{expense.name}</p>
            <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-0.5">
              <span className="text-sm text-muted-foreground">
                {expense.category?.name ?? tCommon('withoutCategory')} • {tRecurrence(expense.recurrenceType)}
              </span>
              {!isMonthly && !isOnce && (
                <span className="text-xs text-violet-500 dark:text-violet-400 font-medium">
                  {formatCurrency(monthly)}/Mo {t('reserve') || 'Rücklage'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1">
              {debitLabel && (
                <div className="flex items-center gap-1">
                  <CalendarDays className="w-3 h-3 text-primary flex-shrink-0" />
                  <span className="text-xs font-medium text-primary">
                    {debitLabel}
                  </span>
                </div>
              )}
              {nextPaymentLabel && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  {t('nextPayment')} {nextPaymentLabel}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-semibold">{formatCurrency(amount)}</p>
            {expense.endDate ? (
              <p className="text-xs text-muted-foreground">{t('until')} {formatDate(expense.endDate)}</p>
            ) : (
              <p className="text-xs text-muted-foreground">{t('since')} {formatDate(expense.startDate)}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onEdit}
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[2rem] font-bold tracking-[-0.03em] leading-none bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">{t('title')}</h2>
          <p className="text-sm text-muted-foreground/60 mt-1.5">{t('description')}</p>
        </div>
        <ExpenseForm accounts={accounts} categories={categories} onSuccess={handleSuccess} onCategoryCreated={handleCategoryCreated} />
      </div>

      <ExpenseForm
        accounts={accounts}
        categories={categories}
        editExpense={editingExpense}
        editDailyExpense={editingDailyExpense}
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setEditingExpense(null);
            setEditingDailyExpense(null);
          }
        }}
        onSuccess={handleEditSuccess}
        onCategoryCreated={handleCategoryCreated}
      />

      {expenses.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3 stagger-children">
          <Card className="hover:bg-card/80 dark:hover:bg-white/[0.08] hover:-translate-y-0.5 transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('monthlyFixedCosts')}</CardTitle>
              <div className="bg-gradient-to-br from-amber-500/20 to-amber-500/5 rounded-xl p-2">
                <Wallet className="h-4 w-4 text-amber-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalMonthlyFixed)}</div>
              <p className="text-xs text-muted-foreground mt-1">{monthlyFixed.length} {t('monthlyDebits')}</p>
            </CardContent>
          </Card>

          <Card className="hover:bg-card/80 dark:hover:bg-white/[0.08] hover:-translate-y-0.5 transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('monthlyReserve')}</CardTitle>
              <div className="bg-gradient-to-br from-violet-500/20 to-violet-500/5 rounded-xl p-2">
                <PiggyBank className="h-4 w-4 text-violet-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-violet-500">{formatCurrency(totalReserves)}</div>
              <p className="text-xs text-muted-foreground mt-1">{periodicReserves.length} {t('periodicExpenses')}</p>
            </CardContent>
          </Card>

          <Card className="hover:bg-card/80 dark:hover:bg-white/[0.08] hover:-translate-y-0.5 transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('totalPerMonth')}</CardTitle>
              <div className="bg-gradient-to-br from-red-500/20 to-red-500/5 rounded-xl p-2">
                <Repeat className="h-4 w-4 text-red-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{formatCurrency(totalNormalized)}</div>
              <p className="text-xs text-muted-foreground mt-1">{t('fixedCostsPlusReserves')}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="fixed" className="space-y-4">
        <TabsList>
          <TabsTrigger value="fixed">
            <Wallet className="w-3.5 h-3.5 mr-1.5" />
            {t('fixedCosts')} ({monthlyFixed.length})
          </TabsTrigger>
          <TabsTrigger value="periodic">
            <PiggyBank className="w-3.5 h-3.5 mr-1.5" />
            {t('reserves')} ({periodicReserves.length})
          </TabsTrigger>
          {oneTimeExpenses.length > 0 && (
            <TabsTrigger value="once">
              {tRecurrence('once')} ({oneTimeExpenses.length})
            </TabsTrigger>
          )}
          <TabsTrigger value="daily">
            <CalendarDays className="w-3.5 h-3.5 mr-1.5" />
            {t('daily')} ({dailyExpenses.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fixed">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-amber-500/20 to-amber-500/5 rounded-xl p-2">
                  <Wallet className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <CardTitle>{t('monthlyFixedCosts')}</CardTitle>
                  <CardDescription>
                    {t('monthlyFixedCostsDesc')}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {monthlyFixed.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {t('noMonthlyFixedCosts')}
                </p>
              ) : (
                <div className="space-y-2">
                  {monthlyFixed.map(expense => (
                    <ExpenseRow
                      key={expense.id}
                      expense={expense}
                      onEdit={() => handleEditExpense(expense)}
                      onDelete={() => handleDeleteExpense(expense.id, expense.name)}
                    />
                  ))}
                  <div className="mt-3 p-3 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/10 dark:border-amber-500/15">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{t('totalMonthlyFixedCosts')}</span>
                      <span className="text-sm font-bold">{formatCurrency(totalMonthlyFixed)}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="periodic">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-violet-500/20 to-violet-500/5 rounded-xl p-2">
                  <PiggyBank className="h-4 w-4 text-violet-500" />
                </div>
                <div>
                  <CardTitle>{t('periodicReserves')}</CardTitle>
                  <CardDescription>
                    {t('periodicReservesDesc')}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {periodicReserves.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {t('noPeriodicExpenses')}
                </p>
              ) : (
                <div className="space-y-2">
                  {periodicReserves.map(expense => (
                    <ExpenseRow
                      key={expense.id}
                      expense={expense}
                      onEdit={() => handleEditExpense(expense)}
                      onDelete={() => handleDeleteExpense(expense.id, expense.name)}
                    />
                  ))}
                  <div className="mt-3 p-3 rounded-xl bg-violet-500/5 dark:bg-violet-500/10 border border-violet-500/10 dark:border-violet-500/15">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{t('monthlyReserveLabel')}</span>
                      <span className="text-sm font-bold text-violet-500">{formatCurrency(totalReserves)}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {oneTimeExpenses.length > 0 && (
          <TabsContent value="once">
            <Card>
              <CardHeader>
                <CardTitle>{tRecurrence('once')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {oneTimeExpenses.map(expense => (
                    <ExpenseRow
                      key={expense.id}
                      expense={expense}
                      onEdit={() => handleEditExpense(expense)}
                      onDelete={() => handleDeleteExpense(expense.id, expense.name)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="daily">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-blue-500/20 to-blue-500/5 rounded-xl p-2">
                  <CalendarDays className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <CardTitle>{t('dailyExpenses')}</CardTitle>
                  <CardDescription>{t('dailyExpensesDesc')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {dailyExpenses.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {t('noDailyExpenses')}
                </p>
              ) : (
                <div className="space-y-2">
                  {dailyExpenses.map(expense => (
                    <div
                      key={expense.id}
                      className="flex items-center justify-between p-4 rounded-xl hover:bg-accent/30 dark:hover:bg-white/5 transition-colors duration-200"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                          style={{
                            background: expense.category?.color
                              ? `linear-gradient(135deg, ${expense.category.color}33, ${expense.category.color}11)`
                              : undefined,
                          }}
                        >
                          {expense.category?.icon ?? '📄'}
                        </div>
                        <div>
                          <p className="font-medium">{expense.description}</p>
                          <p className="text-sm text-muted-foreground">
                            {expense.category?.name ?? tCommon('withoutCategory')} • {formatDate(expense.date)}
                          </p>
                        </div>
                      </div>
                       <div className="flex items-center gap-4">
                         <div className="text-right">
                           <p className="font-semibold">{formatCurrency(expense.amount)}</p>
                           <p className="text-sm text-muted-foreground">{expense.account?.name ?? t('unknownAccount')}</p>
                         </div>
                         <div className="flex items-center gap-1">
                           <Button
                             variant="ghost"
                             size="icon"
                             onClick={() => handleEditDailyExpense(expense)}
                           >
                             <Pencil className="w-4 h-4" />
                           </Button>
                           <Button
                             variant="ghost"
                             size="icon"
                             className="text-destructive hover:text-destructive"
                             onClick={() => handleDeleteDailyExpense(expense.id, expense.description)}
                           >
                             <Trash2 className="w-4 h-4" />
                           </Button>
                         </div>
                       </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
