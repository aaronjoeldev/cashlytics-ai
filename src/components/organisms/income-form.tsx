'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { incomeSchema, type IncomeInput, incomeRecurrenceTypes } from '@/lib/validations/transaction';
import { createIncome, updateIncome } from '@/actions/income-actions';
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
import type { Account, Income } from '@/types/database';

interface IncomeFormProps {
  accounts: Account[];
  onSuccess?: (data: any) => void;
  editIncome?: Income | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const recurrenceLabels: Record<string, string> = {
  once: 'Einmalig',
  monthly: 'Monatlich',
  yearly: 'Jährlich',
};

export function IncomeForm({ accounts, onSuccess, editIncome, open: controlledOpen, onOpenChange }: IncomeFormProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const isEditMode = !!editIncome;

  const form = useForm<IncomeInput>({
    resolver: zodResolver(incomeSchema),
    defaultValues: {
      accountId: '',
      source: '',
      amount: '',
      recurrenceType: 'monthly',
      startDate: new Date(),
      endDate: null,
    },
  });

  useEffect(() => {
    if (editIncome) {
      form.reset({
        accountId: editIncome.accountId || '',
        source: editIncome.source,
        amount: editIncome.amount,
        recurrenceType: editIncome.recurrenceType as IncomeInput['recurrenceType'],
        startDate: new Date(editIncome.startDate),
        endDate: editIncome.endDate ? new Date(editIncome.endDate) : null,
      });
    } else {
      form.reset({
        accountId: '',
        source: '',
        amount: '',
        recurrenceType: 'monthly',
        startDate: new Date(),
        endDate: null,
      });
    }
  }, [editIncome, form]);

  const handleSubmit = async (data: IncomeInput) => {
    setIsSubmitting(true);
    try {
      const endDate = data.endDate && data.endDate !== '' 
        ? (typeof data.endDate === 'string' ? new Date(data.endDate) : data.endDate)
        : null;
      
      if (isEditMode && editIncome) {
        const result = await updateIncome(editIncome.id, {
          accountId: data.accountId,
          source: data.source,
          amount: data.amount,
          recurrenceType: data.recurrenceType,
          startDate: data.startDate,
          endDate,
        });
        if (result.success) {
          form.reset();
          setOpen(false);
          onSuccess?.(result.data);
        }
      } else {
        const result = await createIncome({
          accountId: data.accountId,
          source: data.source,
          amount: data.amount,
          recurrenceType: data.recurrenceType,
          startDate: data.startDate,
          endDate,
        });
        if (result.success) {
          form.reset();
          setOpen(false);
          onSuccess?.(result.data);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isEditMode && controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button variant="secondary">
            <Plus className="w-4 h-4 mr-2" />
            Einnahme hinzufügen
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Einnahme bearbeiten' : 'Neue Einnahme'}</DialogTitle>
          <DialogDescription>{isEditMode ? 'Bearbeite die Einnahmequelle' : 'Erfasse eine neue Einnahmequelle'}</DialogDescription>
        </DialogHeader>
        
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Quelle</Label>
            <Input {...form.register('source')} placeholder="z.B. Gehalt, Nebenjob" />
            {form.formState.errors.source && (
              <p className="text-sm text-destructive">{form.formState.errors.source.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Betrag (€)</Label>
              <Input {...form.register('amount')} placeholder="0.00" type="number" step="0.01" />
            </div>
            <div className="space-y-2">
              <Label>Wiederholung</Label>
              <Select
                value={form.watch('recurrenceType')}
                onValueChange={(v) => form.setValue('recurrenceType', v as IncomeInput['recurrenceType'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {incomeRecurrenceTypes.map(type => (
                    <SelectItem key={type} value={type}>{recurrenceLabels[type]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Konto</Label>
              <Select value={form.watch('accountId')} onValueChange={(v) => form.setValue('accountId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Konto wählen" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Startdatum</Label>
              <Input type="date" {...form.register('startDate', { valueAsDate: true })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Enddatum (optional)</Label>
            <Input type="date" {...form.register('endDate', { valueAsDate: true })} />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Speichern...' : isEditMode ? 'Änderungen speichern' : 'Einnahme erstellen'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}