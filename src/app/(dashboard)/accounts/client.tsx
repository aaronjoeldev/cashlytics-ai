"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AccountForm } from "@/components/organisms/account-form";
import { deleteAccount, updateAccount } from "@/actions/account-actions";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/lib/settings-context";
import { convertCurrency, currencies, type Currency } from "@/lib/currency";
import { Trash2, Pencil, Building2, PiggyBank, TrendingUp, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type {
  Account,
  ExpenseWithDetails,
  IncomeWithAccount,
  TransferWithDetails,
} from "@/types/database";

interface AccountsClientProps {
  initialAccounts: Account[];
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

export function AccountsClient({
  initialAccounts,
  initialExpenses,
  initialIncomes,
  initialTransfers,
}: AccountsClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { formatCurrency: fmt, currency: baseCurrency } = useSettings();
  const formatCurrency = (amount: string | number) =>
    fmt(typeof amount === "string" ? parseFloat(amount) : amount);

  const toBase = (amount: number, entryCurrency?: string | null): number => {
    const from = (entryCurrency && currencies.includes(entryCurrency as Currency))
      ? (entryCurrency as Currency)
      : baseCurrency;
    return convertCurrency(amount, from, baseCurrency);
  };
  const [accounts, setAccounts] = useState(initialAccounts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBalance, setEditBalance] = useState("");
  const t = useTranslations("accounts");

  const accountTypeConfig = {
    checking: { label: t("types.checking"), icon: Building2, color: "text-blue-600" },
    savings: { label: t("types.savings"), icon: PiggyBank, color: "text-emerald-500" },
    etf: { label: t("types.etf"), icon: TrendingUp, color: "text-purple-600" },
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("deleteConfirm"))) {
      return;
    }

    const result = await deleteAccount(id);
    if (result.success) {
      setAccounts(accounts.filter((a) => a.id !== id));
      toast({
        title: t("success.deleted"),
        description: t("success.deleted"),
      });
      router.refresh();
    } else {
      toast({
        title: t("error"),
        description: result.error || t("errors.deleteFailed"),
        variant: "destructive",
      });
    }
  };

  const handleUpdateBalance = async (account: Account) => {
    if (!editBalance) {
      setEditingId(null);
      return;
    }

    const result = await updateAccount(account.id, { balance: editBalance });
    if (result.success) {
      setAccounts(accounts.map((a) => (a.id === account.id ? { ...a, balance: editBalance } : a)));
      toast({
        title: t("success.updated"),
        description: t("success.updated"),
      });
      router.refresh();
    } else {
      toast({
        title: t("error"),
        description: result.error || t("errors.updateFailed"),
        variant: "destructive",
      });
    }
    setEditingId(null);
    setEditBalance("");
  };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const monthlyBalances = new Map<string, number>();

  for (const account of accounts) {
    const incomeTotal = initialIncomes
      .filter((income) => income.accountId === account.id)
      .filter((income) => isTransactionInMonth(income, monthStart, monthEnd))
      .reduce((sum, income) => sum + toBase(parseFloat(income.amount), income.currency), 0);

    const expenseTotal = initialExpenses
      .filter((expense) => expense.accountId === account.id)
      .filter((expense) => isTransactionInMonth(expense, monthStart, monthEnd))
      .reduce((sum, expense) => sum + toBase(parseFloat(expense.amount), expense.currency), 0);

    const transferDelta = initialTransfers
      .filter(
        (transfer) =>
          (transfer.sourceAccountId === account.id || transfer.targetAccountId === account.id) &&
          isTransactionInMonth(transfer, monthStart, monthEnd)
      )
      .reduce((sum, transfer) => {
        const amount = toBase(parseFloat(transfer.amount), transfer.sourceCurrency);
        if (transfer.targetAccountId === account.id) return sum + amount;
        if (transfer.sourceAccountId === account.id) return sum - amount;
        return sum;
      }, 0);

    monthlyBalances.set(account.id, incomeTotal - expenseTotal + transferDelta);
  }

  const totalBalance = accounts.reduce((sum, a) => sum + (monthlyBalances.get(a.id) ?? 0), 0);
  const accountCount = accounts.length;
  const accountLabel = accountCount === 1 ? t("types.checking").split(" ")[0] : t("title");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="from-foreground to-foreground/60 bg-gradient-to-br bg-clip-text text-[2rem] leading-none font-bold tracking-[-0.03em] text-transparent">
            {t("title")}
          </h2>
          <p className="text-muted-foreground/60 mt-1.5 text-sm">{t("description")}</p>
        </div>
        <AccountForm onSuccess={(data) => setAccounts((prev) => [...prev, data])} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-muted-foreground text-sm font-medium">
            {t("monthlyBalance")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{formatCurrency(totalBalance)}</div>
          <p className="text-muted-foreground mt-1 text-xs">
            {accountCount} {accountLabel}
          </p>
        </CardContent>
      </Card>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-muted-foreground text-center">{t("noAccounts")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => {
            const config = accountTypeConfig[account.type];
            const Icon = config.icon;
            const isEditing = editingId === account.id;

            return isEditing ? (
              <Card
                key={account.id}
                className="relative border border-white/[0.08] bg-white/5 backdrop-blur-xl"
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${config.color}`} />
                    <CardTitle className="text-sm font-medium">{account.name}</CardTitle>
                  </div>
                  <span className="text-muted-foreground bg-secondary/50 rounded-lg px-2 py-1 text-xs dark:bg-white/5">
                    {config.label}
                  </span>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={account.balance}
                      onChange={(e) => setEditBalance(e.target.value)}
                      className="border-input focus-visible:ring-primary/10 focus-visible:border-primary/40 flex h-9 w-full rounded-xl border bg-transparent px-3 py-1 text-sm shadow-sm transition-all focus-visible:ring-[3px] focus-visible:outline-none dark:border-white/[0.08] dark:bg-white/5"
                      autoFocus
                    />
                    <Button size="sm" onClick={() => handleUpdateBalance(account)}>
                      OK
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      ✕
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Link key={account.id} href={`/accounts/${account.id}`}>
                <Card className="relative cursor-pointer border border-white/[0.08] bg-white/5 backdrop-blur-xl transition-all duration-300 hover:border-white/15 hover:bg-white/10">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-5 w-5 ${config.color}`} />
                      <CardTitle className="text-sm font-medium">{account.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground bg-secondary/50 rounded-lg px-2 py-1 text-xs dark:bg-white/5">
                        {config.label}
                      </span>
                      <ChevronRight className="text-muted-foreground h-4 w-4" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div
                      className={`text-2xl font-bold ${(monthlyBalances.get(account.id) ?? 0) >= 0 ? "text-emerald-500" : "text-red-500"}`}
                    >
                      {formatCurrency(monthlyBalances.get(account.id) ?? 0)}
                    </div>
                    <div
                      className="mt-4 flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEditingId(account.id);
                          setEditBalance(account.balance);
                        }}
                      >
                        <Pencil className="mr-1 h-3 w-3" />
                        {t("balance")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDelete(account.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
