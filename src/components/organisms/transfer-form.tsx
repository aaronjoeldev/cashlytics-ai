'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, ArrowRight } from 'lucide-react';
import { transferSchema, transferRecurrenceTypes, type TransferInput } from '@/lib/validations/transaction';
import { createTransfer } from '@/actions/transfer-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import type { Account } from '@/types/database';

interface TransferFormProps {
  accounts: Account[];
  onSuccess?: (data: any) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const recurrenceLabels: Record<string, string> = {
  once: 'Einmalig',
  monthly: 'Monatlich',
  quarterly: 'Quartalsweise',
  yearly: 'Jährlich',
};

export function TransferForm({ accounts, onSuccess, open: controlledOpen, onOpenChange }: TransferFormProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (value: boolean) => {
    setUncontrolledOpen(value);
    onOpenChange?.(value);
  };
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<TransferInput>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      sourceAccountId: '',
      targetAccountId: '',
      amount: '',
      description: '',
      recurrenceType: 'once',
      startDate: new Date(),
      endDate: null,
    },
  });

  const handleSubmit = async (data: TransferInput) => {
    setIsSubmitting(true);
    try {
      const endDate = data.endDate && data.endDate !== ''
        ? (typeof data.endDate === 'string' ? new Date(data.endDate) : data.endDate)
        : null;

      const result = await createTransfer({
        sourceAccountId: data.sourceAccountId,
        targetAccountId: data.targetAccountId,
        amount: data.amount,
        description: data.description || undefined,
        recurrenceType: data.recurrenceType,
        startDate: data.startDate,
        endDate,
      });

      if (result.success) {
        form.reset();
        setOpen(false);
        onSuccess?.(result.data);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Transfer hinzufügen
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Neuer Transfer</DialogTitle>
          <DialogDescription>Transfer zwischen Konten planen</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 mt-4">
          <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-end">
            <div className="space-y-2">
              <Label>Von Konto</Label>
              <Select value={form.watch('sourceAccountId')} onValueChange={(v) => form.setValue('sourceAccountId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Quellkonto" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground mb-2.5" />
            <div className="space-y-2">
              <Label>Nach Konto</Label>
              <Select value={form.watch('targetAccountId')} onValueChange={(v) => form.setValue('targetAccountId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Zielkonto" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.filter(a => a.id !== form.watch('sourceAccountId')).map(account => (
                    <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.formState.errors.targetAccountId && (
            <p className="text-sm text-destructive">{form.formState.errors.targetAccountId.message}</p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Betrag (€)</Label>
              <Input {...form.register('amount')} placeholder="0.00" type="number" step="0.01" />
              {form.formState.errors.amount && (
                <p className="text-sm text-destructive">{form.formState.errors.amount.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Wiederholung</Label>
              <Select
                value={form.watch('recurrenceType')}
                onValueChange={(v) => form.setValue('recurrenceType', v as TransferInput['recurrenceType'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {transferRecurrenceTypes.map(type => (
                    <SelectItem key={type} value={type}>{recurrenceLabels[type]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Beschreibung (optional)</Label>
            <Input {...form.register('description')} placeholder="z.B. Sparplan" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Startdatum</Label>
              <Input type="date" {...form.register('startDate', { valueAsDate: true })} />
            </div>
            <div className="space-y-2">
              <Label>Enddatum (optional)</Label>
              <Input type="date" {...form.register('endDate', { valueAsDate: true })} />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Speichern...' : 'Transfer erstellen'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
