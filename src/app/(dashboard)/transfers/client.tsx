'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, ArrowRightLeft, Repeat, CalendarDays } from 'lucide-react';
import { TransferForm } from '@/components/organisms/transfer-form';
import { deleteTransfer } from '@/actions/transfer-actions';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/lib/settings-context';
import type { Account, TransferWithDetails } from '@/types/database';

interface TransfersClientProps {
  accounts: Account[];
  initialTransfers: TransferWithDetails[];
}

const recurrenceLabels: Record<string, string> = {
  once: 'Einmalig',
  monthly: 'Monatlich',
  quarterly: 'Quartalsweise',
  yearly: 'Jährlich',
};

function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat('de-DE').format(new Date(date));
}

function getDebitLabel(transfer: { recurrenceType: string; startDate: Date | string }): string {
  const date = new Date(transfer.startDate);
  const day = date.getDate();
  const month = date.toLocaleDateString('de-DE', { month: 'short' });

  switch (transfer.recurrenceType) {
    case 'monthly':
      return `jeden ${day}.`;
    case 'quarterly':
      return `${day}. ${month} (quartalsweise)`;
    case 'yearly':
      return `${day}. ${month} (jährlich)`;
    default:
      return formatDate(transfer.startDate);
  }
}

export function TransfersClient({
  accounts,
  initialTransfers,
}: TransfersClientProps) {
  const { toast } = useToast();
  const { formatCurrency: fmt } = useSettings();
  const formatCurrency = (amount: string | number) => fmt(typeof amount === 'string' ? parseFloat(amount) : amount);
  const [transfers, setTransfers] = useState(initialTransfers);

  const recurringTransfers = transfers.filter(t => t.recurrenceType !== 'once');
  const oneTimeTransfers = transfers.filter(t => t.recurrenceType === 'once');

  const totalMonthlyRecurring = recurringTransfers
    .filter(t => t.recurrenceType === 'monthly')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const handleSuccess = (data: any) => {
    const newTransfer: TransferWithDetails = {
      ...data,
      sourceAccount: accounts.find(a => a.id === data.sourceAccountId) || null,
      targetAccount: accounts.find(a => a.id === data.targetAccountId) || null,
    };
    setTransfers(prev => [newTransfer, ...prev]);
  };

  const handleDeleteTransfer = async (id: string, description: string) => {
    if (!confirm(`Transfer "${description || 'ohne Beschreibung'}" wirklich löschen?`)) return;

    const result = await deleteTransfer(id);
    if (result.success) {
      setTransfers(prev => prev.filter(t => t.id !== id));
      toast({ title: 'Gelöscht', description: 'Transfer wurde entfernt.' });
    } else {
      toast({ title: 'Fehler', description: 'Löschen fehlgeschlagen.', variant: 'destructive' });
    }
  };

  const TransferRow = ({ transfer, onDelete }: { transfer: TransferWithDetails; onDelete: () => void }) => {
    const amount = parseFloat(transfer.amount);
    const isRecurring = transfer.recurrenceType !== 'once';
    const debitLabel = isRecurring ? getDebitLabel(transfer) : null;

    return (
      <div className="flex items-center justify-between p-4 rounded-xl hover:bg-accent/30 dark:hover:bg-white/5 transition-colors duration-200">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5">
            <ArrowRightLeft className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <p className="font-medium">{transfer.description || 'Transfer'}</p>
            <p className="text-sm text-muted-foreground">
              {transfer.sourceAccount?.name ?? 'Unbekannt'} → {transfer.targetAccount?.name ?? 'Unbekannt'} • {recurrenceLabels[transfer.recurrenceType]}
            </p>
            {debitLabel && (
              <div className="flex items-center gap-1 mt-1">
                <CalendarDays className="w-3 h-3 text-primary flex-shrink-0" />
                <span className="text-xs font-medium text-primary">
                  Ausführung: {debitLabel}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-semibold">{formatCurrency(amount)}</p>
            {transfer.endDate ? (
              <p className="text-xs text-muted-foreground">bis {formatDate(transfer.endDate)}</p>
            ) : (
              <p className="text-xs text-muted-foreground">seit {formatDate(transfer.startDate)}</p>
            )}
          </div>
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
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[2rem] font-bold tracking-[-0.03em] leading-none bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">Transfers</h2>
          <p className="text-sm text-muted-foreground/60 mt-1.5">Verwalte Geldtransfers zwischen deinen Konten</p>
        </div>
        <TransferForm accounts={accounts} onSuccess={handleSuccess} />
      </div>

      {transfers.length > 0 && (
        <Card className="hover:bg-card/80 dark:hover:bg-white/[0.08] hover:-translate-y-0.5 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monatliche Transfers</CardTitle>
            <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 rounded-xl p-2">
              <Repeat className="h-4 w-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">{formatCurrency(totalMonthlyRecurring)}</div>
            <p className="text-xs text-muted-foreground mt-1">{recurringTransfers.length} wiederkehrende Transfers</p>
          </CardContent>
        </Card>
      )}

      {recurringTransfers.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 rounded-xl p-2">
                <Repeat className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <CardTitle>Wiederkehrende Transfers</CardTitle>
                <CardDescription>
                  Regelmäßige Geldtransfers zwischen Konten (z.B. Sparpläne)
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recurringTransfers.map(transfer => (
                <TransferRow
                  key={transfer.id}
                  transfer={transfer}
                  onDelete={() => handleDeleteTransfer(transfer.id, transfer.description || '')}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {oneTimeTransfers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Einmalige Transfers</CardTitle>
            <CardDescription>
              Geplante einmalige Transfers zwischen Konten
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {oneTimeTransfers.map(transfer => (
                <TransferRow
                  key={transfer.id}
                  transfer={transfer}
                  onDelete={() => handleDeleteTransfer(transfer.id, transfer.description || '')}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {transfers.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <ArrowRightLeft className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium mb-2">Keine Transfers vorhanden</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Erstelle deinen ersten Transfer, um Geld zwischen Konten zu verschieben.
            </p>
            <TransferForm accounts={accounts} onSuccess={handleSuccess} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
