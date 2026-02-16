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
import type { Account } from '@/types/database';

interface AccountsClientProps {
  initialAccounts: Account[];
}

const accountTypeConfig = {
  checking: { label: 'Girokonto', icon: Building2, color: 'text-blue-600' },
  savings: { label: 'Sparkonto', icon: PiggyBank, color: 'text-emerald-500' },
  etf: { label: 'ETF-Konto', icon: TrendingUp, color: 'text-purple-600' },
};

export function AccountsClient({ initialAccounts }: AccountsClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { formatCurrency: fmt } = useSettings();
  const formatCurrency = (amount: string | number) => fmt(typeof amount === 'string' ? parseFloat(amount) : amount);
  const [accounts, setAccounts] = useState(initialAccounts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBalance, setEditBalance] = useState('');

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Konto "${name}" wirklich löschen? Alle zugehörigen Transaktionen werden ebenfalls gelöscht.`)) {
      return;
    }

    const result = await deleteAccount(id);
    if (result.success) {
      setAccounts(accounts.filter(a => a.id !== id));
      toast({
        title: 'Konto gelöscht',
        description: `${name} wurde erfolgreich gelöscht.`,
      });
      router.refresh();
    } else {
      toast({
        title: 'Fehler',
        description: result.error || 'Konto konnte nicht gelöscht werden.',
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
        title: 'Kontostand aktualisiert',
        description: `${account.name} wurde aktualisiert.`,
      });
      router.refresh();
    } else {
      toast({
        title: 'Fehler',
        description: result.error || 'Konto konnte nicht aktualisiert werden.',
        variant: 'destructive',
      });
    }
    setEditingId(null);
    setEditBalance('');
  };

  const totalBalance = accounts.reduce((sum, a) => sum + parseFloat(a.balance), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[2rem] font-bold tracking-[-0.03em] leading-none bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">Konten</h2>
          <p className="text-sm text-muted-foreground/60 mt-1.5">
            Verwalte deine Bankkonten und Depots
          </p>
        </div>
        <AccountForm onSuccess={(data) => setAccounts(prev => [...prev, data])} />
      </div>

      {/* Gesamtübersicht */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Gesamtvermögen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{formatCurrency(totalBalance)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {accounts.length} {accounts.length === 1 ? 'Konto' : 'Konten'}
          </p>
        </CardContent>
      </Card>

      {/* Konten-Liste */}
      {accounts.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-muted-foreground text-center">
              Noch keine Konten vorhanden. Füge dein erstes Konto hinzu, um loszulegen.
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
                        Kontostand
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