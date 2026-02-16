'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Building2, PiggyBank, TrendingUp, ArrowUpRight, ArrowDownRight, Receipt, TrendingUp as ForecastIcon, ArrowRightLeft } from 'lucide-react';
import { useSettings } from '@/lib/settings-context';
import type { Account, ExpenseWithDetails, IncomeWithAccount, TransferWithDetails } from '@/types/database';
import { ForecastClient } from './forecast-client';

interface AccountDetailClientProps {
  account: Account;
  initialExpenses: ExpenseWithDetails[];
  initialIncomes: IncomeWithAccount[];
  initialTransfers: TransferWithDetails[];
}

const accountTypeConfig = {
  checking: { label: 'Girokonto', icon: Building2, color: 'text-blue-600' },
  savings: { label: 'Sparkonto', icon: PiggyBank, color: 'text-emerald-500' },
  etf: { label: 'ETF-Konto', icon: TrendingUp, color: 'text-purple-600' },
};

function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}

function getMonthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    options.push({ value, label });
  }
  
  return options;
}

type Transaction = {
  id: string;
  type: 'income' | 'expense' | 'transfer_in' | 'transfer_out';
  name: string;
  amount: string;
  date: Date | string;
  category?: { name: string } | null;
  description?: string | null;
};

export function AccountDetailClient({
  account,
  initialExpenses,
  initialIncomes,
  initialTransfers,
}: AccountDetailClientProps) {
  const router = useRouter();
  const { formatCurrency: fmt } = useSettings();
  const formatCurrency = (amount: string | number) => fmt(typeof amount === 'string' ? parseFloat(amount) : amount);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const monthOptions = getMonthOptions();

  const transactions = useMemo<Transaction[]>(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const filteredExpenses = initialExpenses.filter((e) => {
      const expenseDate = new Date(e.startDate);
      return expenseDate >= startDate && expenseDate <= endDate;
    });

    const filteredIncomes = initialIncomes.filter((i) => {
      const incomeDate = new Date(i.startDate);
      return incomeDate >= startDate && incomeDate <= endDate;
    });

    const filteredTransfers = initialTransfers.filter((t) => {
      const transferDate = new Date(t.startDate);
      return transferDate >= startDate && transferDate <= endDate;
    });

    const expenseTransactions: Transaction[] = filteredExpenses.map((e) => ({
      id: e.id,
      type: 'expense' as const,
      name: e.name,
      amount: e.amount,
      date: e.startDate,
      category: e.category,
    }));

    const incomeTransactions: Transaction[] = filteredIncomes.map((i) => ({
      id: i.id,
      type: 'income' as const,
      name: i.source,
      amount: i.amount,
      date: i.startDate,
    }));

    const transferTransactions: Transaction[] = filteredTransfers.map((t) => ({
      id: t.id,
      type: t.targetAccountId === account.id ? 'transfer_in' as const : 'transfer_out' as const,
      name: t.description || 'Transfer',
      amount: t.amount,
      date: t.startDate,
      description: t.targetAccountId === account.id 
        ? `von ${t.sourceAccount?.name || 'Unbekannt'}`
        : `nach ${t.targetAccount?.name || 'Unbekannt'}`,
    }));

    return [...expenseTransactions, ...incomeTransactions, ...transferTransactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [selectedMonth, initialExpenses, initialIncomes, initialTransfers, account.id]);

  const summary = useMemo(() => {
    const income = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const expenses = transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const transfersIn = transactions
      .filter((t) => t.type === 'transfer_in')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const transfersOut = transactions
      .filter((t) => t.type === 'transfer_out')
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
          onClick={() => router.push('/accounts')}
          className="backdrop-blur-sm bg-white/5 hover:bg-white/10 border border-white/[0.08] rounded-xl"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück
        </Button>
      </div>

      <Card className="backdrop-blur-xl bg-white/5 border border-white/[0.08]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/[0.08]">
                <Icon className={`h-6 w-6 ${config.color}`} />
              </div>
              <div>
                <CardTitle className="text-2xl">{account.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{config.label}</p>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-3xl font-bold ${parseFloat(account.balance) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {formatCurrency(account.balance)}
              </div>
              <p className="text-xs text-muted-foreground">Aktueller Kontostand</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="transactions" className="space-y-6">
        <TabsList className="bg-white/5 backdrop-blur-sm border border-white/[0.08]">
          <TabsTrigger value="transactions" className="gap-2">
            <Receipt className="h-4 w-4" />
            Transaktionen
          </TabsTrigger>
          <TabsTrigger value="forecast" className="gap-2">
            <ForecastIcon className="h-4 w-4" />
            Vorschau
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h3 className="text-xl font-semibold">Transaktionen</h3>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[180px] bg-white/5 backdrop-blur-sm border-white/[0.08] rounded-xl">
                <SelectValue placeholder="Monat wählen" />
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

          <div className="grid gap-4 md:grid-cols-4">
            <Card className="backdrop-blur-xl bg-white/5 border border-white/[0.08]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                  Einnahmen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-500">
                  {formatCurrency(summary.income)}
                </div>
              </CardContent>
            </Card>

            <Card className="backdrop-blur-xl bg-white/5 border border-white/[0.08]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <ArrowDownRight className="h-4 w-4 text-red-500" />
                  Ausgaben
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">
                  {formatCurrency(summary.expenses)}
                </div>
              </CardContent>
            </Card>

            <Card className="backdrop-blur-xl bg-white/5 border border-white/[0.08]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4 text-blue-500" />
                  Transfers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {summary.transfersIn > 0 && (
                    <span className="text-sm text-emerald-500">+{formatCurrency(summary.transfersIn)}</span>
                  )}
                  {summary.transfersIn > 0 && summary.transfersOut > 0 && (
                    <span className="text-muted-foreground">/</span>
                  )}
                  {summary.transfersOut > 0 && (
                    <span className="text-sm text-red-500">-{formatCurrency(summary.transfersOut)}</span>
                  )}
                  {summary.transfersIn === 0 && summary.transfersOut === 0 && (
                    <span className="text-sm text-muted-foreground">0,00 €</span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="backdrop-blur-xl bg-white/5 border border-white/[0.08]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Saldo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${summary.balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {formatCurrency(summary.balance)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="backdrop-blur-xl bg-white/5 border border-white/[0.08]">
            <CardHeader>
              <CardTitle>Transaktionsliste</CardTitle>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Keine Transaktionen in diesem Monat.
                </p>
              ) : (
                <div className="space-y-2">
                  {transactions.map((transaction) => {
                    const isTransfer = transaction.type === 'transfer_in' || transaction.type === 'transfer_out';
                    const isPositive = transaction.type === 'income' || transaction.type === 'transfer_in';
                    
                    return (
                      <div
                        key={`${transaction.type}-${transaction.id}`}
                        className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/[0.08] hover:bg-white/10 hover:border-white/15 transition-all duration-300"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-lg ${
                              isTransfer
                                ? 'bg-blue-500/10 text-blue-500'
                                : isPositive
                                  ? 'bg-emerald-500/10 text-emerald-500'
                                  : 'bg-red-500/10 text-red-500'
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
                          <div>
                            <p className="font-medium">{transaction.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {isTransfer
                                ? transaction.description
                                : transaction.category?.name || (isPositive ? 'Einnahme' : 'Ausgabe')}
                              {' • '}
                              {formatDate(transaction.date)}
                            </p>
                          </div>
                        </div>
                        <div
                          className={`font-semibold ${
                            isTransfer
                              ? 'text-blue-500'
                              : isPositive
                                ? 'text-emerald-500'
                                : 'text-red-500'
                          }`}
                        >
                          {isPositive ? '+' : '-'}
                          {formatCurrency(transaction.amount)}
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
          <ForecastClient
            accountId={account.id}
            currentBalance={account.balance}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
