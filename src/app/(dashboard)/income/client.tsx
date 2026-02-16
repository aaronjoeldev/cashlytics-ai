'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, CalendarDays, Pencil } from 'lucide-react';
import { IncomeForm } from '@/components/organisms/income-form';
import { deleteIncome } from '@/actions/income-actions';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/lib/settings-context';
import type { Account, IncomeWithAccount, Income } from '@/types/database';

interface IncomeClientProps {
  accounts: Account[];
  initialIncomes: IncomeWithAccount[];
}

const recurrenceLabels: Record<string, string> = {
  once: 'Einmalig',
  monthly: 'Monatlich',
  yearly: 'Jährlich',
};

function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat('de-DE').format(new Date(date));
}

function getDebitLabel(recurrenceType: string, startDate: Date | string): string {
  const date = new Date(startDate);
  const day = date.getDate();
  const month = date.toLocaleDateString('de-DE', { month: 'short' });
  switch (recurrenceType) {
    case 'monthly': return `jeden ${day}.`;
    case 'yearly': return `${day}. ${month} (jährlich)`;
    default: return formatDate(startDate);
  }
}

export function IncomeClient({
  accounts,
  initialIncomes,
}: IncomeClientProps) {
  const { toast } = useToast();
  const { formatCurrency: fmt } = useSettings();
  const formatCurrency = (amount: string | number) => fmt(typeof amount === 'string' ? parseFloat(amount) : amount);
  const [incomes, setIncomes] = useState(initialIncomes);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const handleSuccess = (data: any) => {
    const newIncome = {
      ...data,
      account: accounts.find(a => a.id === data.accountId) || null,
    };
    setIncomes(prev => [newIncome, ...prev]);
  };

  const handleEditSuccess = (data: any) => {
    const updatedIncome = {
      ...data,
      account: accounts.find(a => a.id === data.accountId) || null,
    };
    setIncomes(prev => prev.map(i => i.id === data.id ? updatedIncome : i));
    setEditingIncome(null);
    setEditDialogOpen(false);
    toast({ title: 'Aktualisiert', description: 'Einnahme wurde bearbeitet.' });
  };

  const handleDelete = async (id: string, source: string) => {
    if (!confirm(`Einnahme "${source}" wirklich löschen?`)) return;
    
    const result = await deleteIncome(id);
    if (result.success) {
      setIncomes(prev => prev.filter(i => i.id !== id));
      toast({ title: 'Gelöscht', description: `"${source}" wurde entfernt.` });
    } else {
      toast({ title: 'Fehler', description: 'Löschen fehlgeschlagen.', variant: 'destructive' });
    }
  };

  const handleEdit = (income: IncomeWithAccount) => {
    setEditingIncome(income);
    setEditDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[2rem] font-bold tracking-[-0.03em] leading-none bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">Einnahmen</h2>
          <p className="text-sm text-muted-foreground/60 mt-1.5">Verwalte deine Einnahmequellen</p>
        </div>
        <IncomeForm accounts={accounts} onSuccess={handleSuccess} />
      </div>

      <IncomeForm
        accounts={accounts}
        editIncome={editingIncome}
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setEditingIncome(null);
        }}
        onSuccess={handleEditSuccess}
      />

      <Card>
        <CardHeader>
          <CardTitle>Alle Einnahmen ({incomes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {incomes.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Noch keine Einnahmen vorhanden. Füge deine erste Einnahmequelle hinzu.
            </p>
          ) : (
            <div className="space-y-2">
              {incomes.map(income => (
                <div
                  key={income.id}
                  className="flex items-center justify-between p-4 rounded-xl hover:bg-accent/30 dark:hover:bg-white/5 transition-colors duration-200"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg bg-gradient-to-br from-emerald-500/20 to-emerald-500/5">
                      💰
                    </div>
                    <div>
                      <p className="font-medium">{income.source}</p>
                      <p className="text-sm text-muted-foreground">
                        {income.account?.name ?? 'Unbekanntes Konto'} • {recurrenceLabels[income.recurrenceType]}
                      </p>
                      {income.recurrenceType !== 'once' && (
                        <div className="flex items-center gap-1 mt-1">
                          <CalendarDays className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                          <span className="text-xs font-medium text-emerald-500">
                            Gutschrift: {getDebitLabel(income.recurrenceType, income.startDate)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold text-emerald-500">{formatCurrency(income.amount)}</p>
                      <p className="text-sm text-muted-foreground">seit {formatDate(income.startDate)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(income)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(income.id, income.source)}
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
    </div>
  );
}