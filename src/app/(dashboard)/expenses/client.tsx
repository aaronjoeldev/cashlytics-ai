"use client";

import { useState, useSyncExternalStore } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Wallet, PiggyBank, Repeat, CalendarDays, Pencil } from "lucide-react";
import { ExpenseForm } from "@/components/organisms/expense-form";
import { deleteExpense, deleteDailyExpense } from "@/actions/expense-actions";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/lib/settings-context";
import { currencySymbols, convertCurrency, type Currency } from "@/lib/currency";
import { useTranslations } from "next-intl";
import type {
  Account,
  Category,
  Expense,
  DailyExpense,
  ExpenseWithDetails,
  DailyExpenseWithDetails,
} from "@/types/database";

interface ExpensesClientProps {
  accounts: Account[];
  categories: Category[];
  initialExpenses: ExpenseWithDetails[];
  initialDailyExpenses: DailyExpenseWithDetails[];
}

function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat().format(new Date(date));
}

function getNextPaymentDate(expense: {
  recurrenceType: string;
  startDate: Date | string;
  recurrenceInterval: number | null;
  endDate?: Date | string | null;
}): Date | null {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = new Date(expense.startDate);

  const buildDateWithStartDay = (year: number, month: number): Date => {
    const maxDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(start.getDate(), maxDay));
  };

  if (expense.endDate) {
    const endDate = new Date(expense.endDate);
    if (endDate < now) return null;
  }

  switch (expense.recurrenceType) {
    case "daily": {
      const next = new Date(now);
      next.setDate(next.getDate() + 1);
      return next;
    }
    case "weekly": {
      const daysUntilNext = (7 - ((now.getDay() - start.getDay() + 7) % 7)) % 7 || 7;
      const next = new Date(now);
      next.setDate(next.getDate() + daysUntilNext);
      return next;
    }
    case "monthly": {
      let next = buildDateWithStartDay(now.getFullYear(), now.getMonth());
      if (next <= now) {
        next = buildDateWithStartDay(now.getFullYear(), now.getMonth() + 1);
      }
      return next;
    }
    case "quarterly": {
      const monthsSinceStart =
        (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
      const remainder = ((monthsSinceStart % 3) + 3) % 3;
      const monthsUntilNext = remainder === 0 ? 0 : 3 - remainder;
      let next = buildDateWithStartDay(now.getFullYear(), now.getMonth() + monthsUntilNext);
      if (next <= now) {
        next = buildDateWithStartDay(now.getFullYear(), now.getMonth() + monthsUntilNext + 3);
      }
      return next;
    }
    case "semiannual": {
      const monthsSinceStart =
        (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
      const remainder = ((monthsSinceStart % 6) + 6) % 6;
      const monthsUntilNext = remainder === 0 ? 0 : 6 - remainder;
      let next = buildDateWithStartDay(now.getFullYear(), now.getMonth() + monthsUntilNext);
      if (next <= now) {
        next = buildDateWithStartDay(now.getFullYear(), now.getMonth() + monthsUntilNext + 6);
      }
      return next;
    }
    case "yearly": {
      let next = buildDateWithStartDay(now.getFullYear(), start.getMonth());
      if (next <= now) {
        next = buildDateWithStartDay(now.getFullYear() + 1, start.getMonth());
      }
      return next;
    }
    case "custom": {
      if (!expense.recurrenceInterval) return start;
      const monthsSinceStart =
        (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
      const remainder =
        ((monthsSinceStart % expense.recurrenceInterval) + expense.recurrenceInterval) %
        expense.recurrenceInterval;
      const monthsUntilNext = remainder === 0 ? 0 : expense.recurrenceInterval - remainder;
      let next = buildDateWithStartDay(now.getFullYear(), now.getMonth() + monthsUntilNext);
      if (next <= now) {
        next = buildDateWithStartDay(
          now.getFullYear(),
          now.getMonth() + monthsUntilNext + expense.recurrenceInterval
        );
      }
      return next;
    }
    default:
      return null;
  }
}

function formatNextPayment(
  expense: {
    recurrenceType: string;
    startDate: Date | string;
    recurrenceInterval: number | null;
    endDate?: Date | string | null;
  },
  t: (key: string, params?: Record<string, number>) => string
): string | null {
  const nextDate = getNextPaymentDate(expense);
  if (!nextDate) return null;

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffTime = nextDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return t("today");
  if (diffDays === 1) return t("tomorrow");
  if (diffDays <= 7) return t("inDays", { count: diffDays });

  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(nextDate);
}

function normalizeToMonthly(
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
      return 0;
  }
}

export function ExpensesClient({
  accounts,
  categories: initialCategories,
  initialExpenses,
  initialDailyExpenses,
}: ExpensesClientProps) {
  const { toast } = useToast();
  const { formatCurrency: fmt, currency: baseCurrency } = useSettings();
  const t = useTranslations("expenses");
  const tCommon = useTranslations("common");
  const tRecurrence = useTranslations("recurrence");
  const formatCurrency = (amount: string | number) =>
    fmt(typeof amount === "string" ? parseFloat(amount) : amount);
  const formatEntryAmount = (amount: string | number, entryCurrency?: string | null) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    if (entryCurrency && entryCurrency !== baseCurrency) {
      const symbol = currencySymbols[entryCurrency as keyof typeof currencySymbols] ?? entryCurrency;
      return `${num.toFixed(2)} ${symbol}`;
    }
    return formatCurrency(num);
  };
  const [categories, setCategories] = useState(initialCategories);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [dailyExpenses, setDailyExpenses] = useState(initialDailyExpenses);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingDailyExpense, setEditingDailyExpense] = useState<DailyExpense | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");
  const isMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const filteredExpenses =
    selectedAccountId === "all"
      ? expenses
      : expenses.filter((e) => e.accountId === selectedAccountId);
  const filteredDailyExpenses =
    selectedAccountId === "all"
      ? dailyExpenses
      : dailyExpenses.filter((e) => e.accountId === selectedAccountId);

  const monthlyFixed = filteredExpenses.filter((e) => e.recurrenceType === "monthly");
  const periodicReserves = filteredExpenses.filter(
    (e) => e.recurrenceType !== "monthly" && e.recurrenceType !== "once"
  );
  const oneTimeExpenses = filteredExpenses.filter((e) => e.recurrenceType === "once");

  const toBase = (amount: number, entryCurrency?: string | null) =>
    entryCurrency && entryCurrency !== baseCurrency
      ? convertCurrency(amount, entryCurrency as Currency, baseCurrency)
      : amount;

  const totalMonthlyFixed = monthlyFixed.reduce(
    (sum, e) => sum + toBase(parseFloat(e.amount), e.currency),
    0
  );
  const totalReserves = periodicReserves.reduce(
    (sum, e) =>
      sum + toBase(
        normalizeToMonthly(parseFloat(e.amount), e.recurrenceType, e.recurrenceInterval),
        e.currency
      ),
    0
  );
  const totalNormalized = totalMonthlyFixed + totalReserves;

  const getDebitLabel = (expense: {
    recurrenceType: string;
    startDate: Date | string;
    recurrenceInterval: number | null;
  }): string => {
    const date = new Date(expense.startDate);
    const day = date.getDate();
    const month = date.toLocaleDateString(undefined, { month: "short" });

    switch (expense.recurrenceType) {
      case "monthly":
        return tRecurrence("monthly");
      case "quarterly":
        return `${day}. ${month} (${tRecurrence("quarterly")})`;
      case "semiannual":
        return `${day}. ${month} (${tRecurrence("semiannual")})`;
      case "yearly":
        return `${day}. ${month} (${tRecurrence("yearly")})`;
      case "weekly": {
        const weekday = date.toLocaleDateString(undefined, { weekday: "long" });
        return tRecurrence("weekly");
      }
      case "custom":
        return tRecurrence("everyMonths", { count: expense.recurrenceInterval ?? 1 });
      default:
        return formatDate(expense.startDate);
    }
  };

  const handleCategoryCreated = (category: Category) => {
    setCategories((prev) => [...prev, category]);
    toast({
      title: t("categoryCreated"),
      description: t("categoryCreatedDesc", { name: category.name }),
    });
  };

  const handleSuccess = (data: {
    type: "periodic" | "daily";
    item: { id: string; categoryId?: string; accountId?: string; [key: string]: unknown };
  }) => {
    if (data.type === "periodic") {
      const newExpense = {
        ...data.item,
        category: categories.find((c) => c.id === data.item.categoryId) || null,
        account: accounts.find((a) => a.id === data.item.accountId) || null,
      } as ExpenseWithDetails;
      setExpenses((prev) => [newExpense, ...prev]);
    } else {
      const newDailyExpense = {
        ...data.item,
        category: categories.find((c) => c.id === data.item.categoryId) || null,
        account: accounts.find((a) => a.id === data.item.accountId) || null,
      } as DailyExpenseWithDetails;
      setDailyExpenses((prev) => [newDailyExpense, ...prev]);
    }
  };

  const handleEditSuccess = (data: {
    type: "periodic" | "daily";
    item: { id: string; categoryId?: string; accountId?: string; [key: string]: unknown };
  }) => {
    if (data.type === "periodic") {
      const updatedExpense = {
        ...data.item,
        category: categories.find((c) => c.id === data.item.categoryId) || null,
        account: accounts.find((a) => a.id === data.item.accountId) || null,
      } as ExpenseWithDetails;
      setExpenses((prev) => prev.map((e) => (e.id === data.item.id ? updatedExpense : e)));
    } else {
      const updatedDailyExpense = {
        ...data.item,
        category: categories.find((c) => c.id === data.item.categoryId) || null,
        account: accounts.find((a) => a.id === data.item.accountId) || null,
      } as DailyExpenseWithDetails;
      setDailyExpenses((prev) =>
        prev.map((e) => (e.id === data.item.id ? updatedDailyExpense : e))
      );
    }
    setEditingExpense(null);
    setEditingDailyExpense(null);
    setEditDialogOpen(false);
    toast({ title: t("updated"), description: t("updatedDesc") });
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
    if (!confirm(t("deleteConfirm", { name }))) return;

    const result = await deleteExpense(id);
    if (result.success) {
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      toast({ title: tCommon("delete"), description: `"${name}" wurde entfernt.` });
    } else {
      toast({ title: t("deleteFailed"), variant: "destructive" });
    }
  };

  const handleDeleteDailyExpense = async (id: string, description: string) => {
    if (!confirm(t("deleteConfirm", { name: description }))) return;

    const result = await deleteDailyExpense(id);
    if (result.success) {
      setDailyExpenses((prev) => prev.filter((e) => e.id !== id));
      toast({ title: tCommon("delete"), description: `"${description}" wurde entfernt.` });
    } else {
      toast({ title: t("deleteFailed"), variant: "destructive" });
    }
  };

  const ExpenseRow = ({
    expense,
    onEdit,
    onDelete,
  }: {
    expense: ExpenseWithDetails;
    onEdit: () => void;
    onDelete: () => void;
  }) => {
    const amount = parseFloat(expense.amount);
    const monthly = normalizeToMonthly(amount, expense.recurrenceType, expense.recurrenceInterval);
    const isMonthly = expense.recurrenceType === "monthly";
    const isOnce = expense.recurrenceType === "once";
    const debitLabel = !isOnce ? getDebitLabel(expense) : null;
    const nextPaymentLabel = !isOnce ? formatNextPayment(expense, tCommon) : null;

    return (
      <div className="hover:bg-accent/30 flex items-start gap-3 rounded-xl p-4 transition-colors duration-200 dark:hover:bg-white/5">
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-lg"
          style={{
            background: expense.category?.color
              ? `linear-gradient(135deg, ${expense.category.color}33, ${expense.category.color}11)`
              : undefined,
          }}
        >
          {expense.category?.icon ?? "📄"}
        </div>
        <div className="min-w-0 flex-1">
          {/* Zeile 1: Name + Buttons */}
          <div className="flex items-start justify-between gap-1">
            <p className="font-medium">{expense.name}</p>
            <div className="-mt-1 -mr-2 flex flex-shrink-0 items-center gap-0.5">
              <Button variant="ghost" size="icon" onClick={onEdit}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {/* Zeile 2: Kategorie + Intervall (+ Rücklage-Badge) */}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-muted-foreground text-sm">
              {expense.category?.name ?? tCommon("withoutCategory")} •{" "}
              {tRecurrence(expense.recurrenceType)}
            </span>
            {!isMonthly && !isOnce && (
              <span className="text-xs font-medium whitespace-nowrap text-violet-500 dark:text-violet-400">
                {formatCurrency(monthly)}/Mo {t("reserve") || "Rücklage"}
              </span>
            )}
          </div>
          {/* Zeile 3: Datum-Info links + Betrag rechts */}
          <div className="mt-1.5 flex items-end justify-between gap-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {debitLabel && (
                <div className="flex items-center gap-1">
                  <CalendarDays className="text-primary h-3 w-3 flex-shrink-0" />
                  <span className="text-primary text-xs font-medium">{debitLabel}</span>
                </div>
              )}
              {nextPaymentLabel && (
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  {t("nextPayment")} {nextPaymentLabel}
                </span>
              )}
              {expense.endDate ? (
                <span className="text-muted-foreground text-xs">
                  {t("until")} {formatDate(expense.endDate)}
                </span>
              ) : (
                <span className="text-muted-foreground text-xs">
                  {t("since")} {formatDate(expense.startDate)}
                </span>
              )}
            </div>
            <p className="flex-shrink-0 font-semibold whitespace-nowrap">
              {formatEntryAmount(amount, expense.currency)}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="from-foreground to-foreground/60 bg-gradient-to-br bg-clip-text text-[2rem] leading-none font-bold tracking-[-0.03em] text-transparent">
            {t("title")}
          </h2>
          <p className="text-muted-foreground/60 mt-1.5 text-sm">{t("description")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isMounted && accounts.length > 1 && (
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
          <ExpenseForm
            accounts={accounts}
            categories={categories}
            onSuccess={handleSuccess}
            onCategoryCreated={handleCategoryCreated}
          />
        </div>
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

      {filteredExpenses.length > 0 && (
        <div className="stagger-children grid gap-4 md:grid-cols-3">
          <Card className="hover:bg-card/80 transition-all duration-300 hover:-translate-y-0.5 dark:hover:bg-white/[0.08]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("monthlyFixedCosts")}</CardTitle>
              <div className="rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 p-2">
                <Wallet className="h-4 w-4 text-amber-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalMonthlyFixed)}</div>
              <p className="text-muted-foreground mt-1 text-xs">
                {monthlyFixed.length} {t("monthlyDebits")}
              </p>
            </CardContent>
          </Card>

          <Card className="hover:bg-card/80 transition-all duration-300 hover:-translate-y-0.5 dark:hover:bg-white/[0.08]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("monthlyReserve")}</CardTitle>
              <div className="rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 p-2">
                <PiggyBank className="h-4 w-4 text-violet-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-violet-500">
                {formatCurrency(totalReserves)}
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                {periodicReserves.length} {t("periodicExpenses")}
              </p>
            </CardContent>
          </Card>

          <Card className="hover:bg-card/80 transition-all duration-300 hover:-translate-y-0.5 dark:hover:bg-white/[0.08]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("totalPerMonth")}</CardTitle>
              <div className="rounded-xl bg-gradient-to-br from-red-500/20 to-red-500/5 p-2">
                <Repeat className="h-4 w-4 text-red-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">
                {formatCurrency(totalNormalized)}
              </div>
              <p className="text-muted-foreground mt-1 text-xs">{t("fixedCostsPlusReserves")}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="fixed" className="space-y-4">
        <TabsList className="!flex !h-auto !w-full flex-col gap-1 sm:flex-row sm:gap-0">
          <TabsTrigger value="fixed" className="w-full justify-start sm:w-auto sm:justify-center">
            <Wallet className="mr-1.5 h-3.5 w-3.5" />
            {t("fixedCosts")} ({monthlyFixed.length})
          </TabsTrigger>
          <TabsTrigger
            value="periodic"
            className="w-full justify-start sm:w-auto sm:justify-center"
          >
            <PiggyBank className="mr-1.5 h-3.5 w-3.5" />
            {t("reserves")} ({periodicReserves.length})
          </TabsTrigger>
          {oneTimeExpenses.length > 0 && (
            <TabsTrigger value="once" className="w-full justify-start sm:w-auto sm:justify-center">
              {tRecurrence("once")} ({oneTimeExpenses.length})
            </TabsTrigger>
          )}
          <TabsTrigger value="daily" className="w-full justify-start sm:w-auto sm:justify-center">
            <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
            {t("daily")} ({filteredDailyExpenses.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fixed">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 p-2">
                  <Wallet className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <CardTitle>{t("monthlyFixedCosts")}</CardTitle>
                  <CardDescription>{t("monthlyFixedCostsDesc")}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {monthlyFixed.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">{t("noMonthlyFixedCosts")}</p>
              ) : (
                <div className="space-y-2">
                  {monthlyFixed.map((expense) => (
                    <ExpenseRow
                      key={expense.id}
                      expense={expense}
                      onEdit={() => handleEditExpense(expense)}
                      onDelete={() => handleDeleteExpense(expense.id, expense.name)}
                    />
                  ))}
                  <div className="mt-3 rounded-xl border border-amber-500/10 bg-amber-500/5 p-3 dark:border-amber-500/15 dark:bg-amber-500/10">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">
                        {t("totalMonthlyFixedCosts")}
                      </span>
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
                <div className="rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 p-2">
                  <PiggyBank className="h-4 w-4 text-violet-500" />
                </div>
                <div>
                  <CardTitle>{t("periodicReserves")}</CardTitle>
                  <CardDescription>{t("periodicReservesDesc")}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {periodicReserves.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">{t("noPeriodicExpenses")}</p>
              ) : (
                <div className="space-y-2">
                  {periodicReserves.map((expense) => (
                    <ExpenseRow
                      key={expense.id}
                      expense={expense}
                      onEdit={() => handleEditExpense(expense)}
                      onDelete={() => handleDeleteExpense(expense.id, expense.name)}
                    />
                  ))}
                  <div className="mt-3 rounded-xl border border-violet-500/10 bg-violet-500/5 p-3 dark:border-violet-500/15 dark:bg-violet-500/10">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">
                        {t("monthlyReserveLabel")}
                      </span>
                      <span className="text-sm font-bold text-violet-500">
                        {formatCurrency(totalReserves)}
                      </span>
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
                <CardTitle>{tRecurrence("once")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {oneTimeExpenses.map((expense) => (
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
                <div className="rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 p-2">
                  <CalendarDays className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <CardTitle>{t("dailyExpenses")}</CardTitle>
                  <CardDescription>{t("dailyExpensesDesc")}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredDailyExpenses.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">{t("noDailyExpenses")}</p>
              ) : (
                <div className="space-y-2">
                  {filteredDailyExpenses.map((expense) => (
                    <div
                      key={expense.id}
                      className="hover:bg-accent/30 flex items-start gap-3 rounded-xl p-4 transition-colors duration-200 dark:hover:bg-white/5"
                    >
                      <div
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-lg"
                        style={{
                          background: expense.category?.color
                            ? `linear-gradient(135deg, ${expense.category.color}33, ${expense.category.color}11)`
                            : undefined,
                        }}
                      >
                        {expense.category?.icon ?? "📄"}
                      </div>
                      <div className="min-w-0 flex-1">
                        {/* Zeile 1: Beschreibung + Buttons */}
                        <div className="flex items-start justify-between gap-1">
                          <p className="font-medium">{expense.description}</p>
                          <div className="-mt-1 -mr-2 flex flex-shrink-0 items-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditDailyExpense(expense)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() =>
                                handleDeleteDailyExpense(expense.id, expense.description)
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        {/* Zeile 2: Kategorie + Datum */}
                        <p className="text-muted-foreground mt-0.5 text-sm">
                          {expense.category?.name ?? tCommon("withoutCategory")} •{" "}
                          {formatDate(expense.date)}
                        </p>
                        {/* Zeile 3: Konto links + Betrag rechts */}
                        <div className="mt-1.5 flex items-end justify-between gap-2">
                          <p className="text-muted-foreground text-xs">
                            {expense.account?.name ?? t("unknownAccount")}
                          </p>
                          <p className="flex-shrink-0 font-semibold whitespace-nowrap">
                            {formatEntryAmount(expense.amount, expense.currency)}
                          </p>
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
