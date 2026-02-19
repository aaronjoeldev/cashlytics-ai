'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AccountForm } from '@/components/organisms/account-form';
import { deleteAccount, updateAccount } from '@/actions/account-actions';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/lib/settings-context';
import { Trash2, Pencil, Building2, PiggyBank, TrendingUp, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Account } from '@/types/database';

interface AccountsClientProps {
  initialAccounts: Account[];
}

export function AccountsClient({ initialAccounts }: AccountsClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { formatCurrency: fmt } = useSettings();
  const formatCurrency = (amount: string | number) => fmt(typeof amount === 'string' ? parseFloat(amount) : amount);
  const [accounts, setAccounts] = useState(initialAccounts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBalance, setEditBalance] = useState('');
  const t = useTranslations('accounts');
  const tCommon = useTranslations('common');

  const accountTypeConfig = {
    checking: { label: t('types.checking'), icon: Building2, color: 'text-blue-600' },
    savings: { label: t('types.savings'), icon: PiggyBank, color: 'text-emerald-500' },
    etf: { label: t('types.etf'), icon: TrendingUp, color: 'text-purple-600' },
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(t('deleteConfirm'))) {
      return;
    }

    const result = await deleteAccount(id);
    if (result.success) {
      setAccounts(accounts.filter(a => a.id !== id));
      toast({
        title: t('success.deleted'),
        description: t('success.deleted'),
      });
      router.refresh();
    } else {
      toast({
        title: t('error'),
        description: result.error || t('errors.deleteFailed'),
        variant: 'destructive',
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
      setAccounts(accounts.map(a => 
        a.id === account.id ? { ...a, balance: editBalance } : a
      ));
      toast({
        title: t('success.updated'),
        description: t('success.updated'),
      });
      router.refresh();
    } else {
      toast({
        title: t('error'),
        description: result.error || t('errors.updateFailed'),
        variant: 'destructive',
      });
    }
    setEditingId(null);
    setEditBalance('');
  };

  const totalBalance = accounts.reduce((sum, a) => sum + parseFloat(a.balance), 0);
  const accountCount = accounts.length;
  const accountLabel = accountCount === 1 ? t('types.checking').split(' ')[0] : t('title');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[2rem] font-bold tracking-[-0.03em] leading-none bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">{t('title')}</h2>
          <p className="text-sm text-muted-foreground/60 mt-1.5">
            {t('description')}
          </p>
        </div>
        <AccountForm onSuccess={(data) => setAccounts(prev => [...prev, data])} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t('totalBalance')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{formatCurrency(totalBalance)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {accountCount} {accountLabel}
          </p>
        </CardContent>
      </Card>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-muted-foreground text-center">
              {t('noAccounts')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => {
            const config = accountTypeConfig[account.type];
            const Icon = config.icon;
            const isEditing = editingId === account.id;

            return isEditing ? (
              <Card key={account.id} className="relative backdrop-blur-xl bg-white/5 border border-white/[0.08]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${config.color}`} />
                    <CardTitle className="text-sm font-medium">
                      {account.name}
                    </CardTitle>
                  </div>
                  <span className="text-xs text-muted-foreground bg-secondary/50 dark:bg-white/5 px-2 py-1 rounded-lg">
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
                      className="flex h-9 w-full rounded-xl border border-input dark:border-white/[0.08] dark:bg-white/5 bg-transparent px-3 py-1 text-sm shadow-sm transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/10 focus-visible:border-primary/40"
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
                <Card className="relative cursor-pointer backdrop-blur-xl bg-white/5 border border-white/[0.08] hover:bg-white/10 hover:border-white/15 transition-all duration-300">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-5 w-5 ${config.color}`} />
                      <CardTitle className="text-sm font-medium">
                        {account.name}
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground bg-secondary/50 dark:bg-white/5 px-2 py-1 rounded-lg">
                        {config.label}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${parseFloat(account.balance) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {formatCurrency(account.balance)}
                    </div>
                    <div className="flex items-center gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
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
                         <Pencil className="h-3 w-3 mr-1" />
                         {t('balance')}
                       </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDelete(account.id, account.name);
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