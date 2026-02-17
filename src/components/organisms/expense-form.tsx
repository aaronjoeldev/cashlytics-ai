'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Check } from 'lucide-react';
import { expenseSchema, dailyExpenseSchema, type ExpenseInput, type DailyExpenseInput, recurrenceTypes } from '@/lib/validations/transaction';
import { createExpense, createDailyExpense, updateExpense, updateDailyExpense } from '@/actions/expense-actions';
import { createCategory } from '@/actions/category-actions';
import type { CategoryInput } from '@/lib/validations/category';
import { EmojiPicker } from '@/components/molecules/emoji-picker';
import { FileUpload } from '@/components/molecules/file-upload';
import { DocumentList, type DocumentListRef } from '@/components/molecules/document-list';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Account, Category, Expense, DailyExpense } from '@/types/database';

interface ExpenseFormProps {
  accounts: Account[];
  categories: Category[];
  onSuccess?: (data: { type: 'periodic' | 'daily'; item: any }) => void;
  onCategoryCreated?: (category: Category) => void;
  editExpense?: Expense | null;
  editDailyExpense?: DailyExpense | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const recurrenceLabels: Record<string, string> = {
  once: 'Einmalig',
  daily: 'Täglich',
  weekly: 'Wöchentlich',
  monthly: 'Monatlich',
  quarterly: 'Quartalsweise',
  yearly: 'Jährlich',
  custom: 'Benutzerdefiniert',
};

export function ExpenseForm({ accounts, categories: initialCategories, onSuccess, onCategoryCreated, editExpense, editDailyExpense, open: controlledOpen, onOpenChange }: ExpenseFormProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'periodic' | 'daily'>('periodic');
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('');
  const [newCatColor, setNewCatColor] = useState('#fbbf24');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [createdExpenseId, setCreatedExpenseId] = useState<string | null>(null);
  const [createdDailyExpenseId, setCreatedDailyExpenseId] = useState<string | null>(null);
  const documentListRef = useRef<DocumentListRef>(null);
  
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const isEditMode = !!editExpense || !!editDailyExpense;
  const showDocuments = isEditMode || createdExpenseId || createdDailyExpenseId;

  const handleUploadComplete = () => {
    documentListRef.current?.refresh();
  };

  const periodicForm = useForm<ExpenseInput>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      accountId: '',
      categoryId: '',
      name: '',
      amount: '',
      recurrenceType: 'monthly',
      startDate: new Date(),
      endDate: null,
      isSubscription: false,
      info: '',
    },
  });

  const dailyForm = useForm<DailyExpenseInput>({
    resolver: zodResolver(dailyExpenseSchema),
    defaultValues: {
      accountId: '',
      categoryId: '',
      description: '',
      amount: '',
      date: new Date(),
      info: '',
    },
  });

  useEffect(() => {
    if (editExpense) {
      setActiveTab('periodic');
      periodicForm.reset({
        accountId: editExpense.accountId || '',
        categoryId: editExpense.categoryId || '',
        name: editExpense.name,
        amount: editExpense.amount,
        recurrenceType: editExpense.recurrenceType as ExpenseInput['recurrenceType'],
        recurrenceInterval: editExpense.recurrenceInterval || undefined,
        startDate: new Date(editExpense.startDate),
        endDate: editExpense.endDate ? new Date(editExpense.endDate) : null,
        isSubscription: editExpense.isSubscription ?? false,
        info: editExpense.info || '',
      });
    } else if (editDailyExpense) {
      setActiveTab('daily');
      dailyForm.reset({
        accountId: editDailyExpense.accountId || '',
        categoryId: editDailyExpense.categoryId || '',
        description: editDailyExpense.description,
        amount: editDailyExpense.amount,
        date: new Date(editDailyExpense.date),
        info: editDailyExpense.info || '',
      });
    } else {
      periodicForm.reset({
        accountId: '',
        categoryId: '',
        name: '',
        amount: '',
        recurrenceType: 'monthly',
        startDate: new Date(),
        endDate: null,
        isSubscription: false,
        info: '',
      });
      dailyForm.reset({
        accountId: '',
        categoryId: '',
        description: '',
        amount: '',
        date: new Date(),
        info: '',
      });
      setCreatedExpenseId(null);
      setCreatedDailyExpenseId(null);
    }
  }, [editExpense, editDailyExpense, periodicForm, dailyForm]);

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    setIsCreatingCategory(true);
    try {
      const input: CategoryInput = {
        name: newCatName.trim(),
        icon: newCatIcon || undefined,
        color: newCatColor || undefined,
      };
      const result = await createCategory(input);
      if (result.success) {
        setCategories(prev => [...prev, result.data]);
        onCategoryCreated?.(result.data);
        // Auto-select the new category in whichever tab is active
        if (activeTab === 'periodic') {
          periodicForm.setValue('categoryId', result.data.id);
        } else {
          dailyForm.setValue('categoryId', result.data.id);
        }
        setNewCatName('');
        setNewCatIcon('');
        setNewCatColor('#fbbf24');
        setShowNewCategory(false);
      }
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handlePeriodicSubmit = async (data: ExpenseInput) => {
    setIsSubmitting(true);
    try {
      const endDate = data.endDate && data.endDate !== '' 
        ? (typeof data.endDate === 'string' ? new Date(data.endDate) : data.endDate)
        : null;
      
      if (editExpense) {
        const result = await updateExpense(editExpense.id, {
          accountId: data.accountId,
          categoryId: data.categoryId || undefined,
          name: data.name,
          amount: data.amount,
          recurrenceType: data.recurrenceType,
          recurrenceInterval: data.recurrenceInterval,
          startDate: data.startDate,
          endDate,
          isSubscription: data.isSubscription,
          info: data.info,
        });
        if (result.success) {
          periodicForm.reset();
          setOpen(false);
          onSuccess?.({ type: 'periodic', item: result.data });
        }
      } else {
        const result = await createExpense({
          accountId: data.accountId,
          categoryId: data.categoryId || undefined,
          name: data.name,
          amount: data.amount,
          recurrenceType: data.recurrenceType,
          recurrenceInterval: data.recurrenceInterval,
          startDate: data.startDate,
          endDate,
          isSubscription: data.isSubscription,
          info: data.info,
        });
        if (result.success) {
          setCreatedExpenseId(result.data.id);
          onSuccess?.({ type: 'periodic', item: result.data });
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDailySubmit = async (data: DailyExpenseInput) => {
    setIsSubmitting(true);
    try {
      if (editDailyExpense) {
        const result = await updateDailyExpense(editDailyExpense.id, {
          accountId: data.accountId,
          categoryId: data.categoryId || undefined,
          description: data.description,
          amount: data.amount,
          date: data.date,
          info: data.info,
        });
        if (result.success) {
          dailyForm.reset();
          setOpen(false);
          onSuccess?.({ type: 'daily', item: result.data });
        }
      } else {
        const result = await createDailyExpense({
          accountId: data.accountId,
          categoryId: data.categoryId || undefined,
          description: data.description,
          amount: data.amount,
          date: data.date,
          info: data.info,
        });
        if (result.success) {
          setCreatedDailyExpenseId(result.data.id);
          onSuccess?.({ type: 'daily', item: result.data });
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
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Ausgabe hinzufügen
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[500px]" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Ausgabe bearbeiten' : 'Neue Ausgabe'}</DialogTitle>
          <DialogDescription>{isEditMode ? 'Bearbeite die Ausgabe' : 'Wähle zwischen periodischen oder täglichen Ausgaben'}</DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'periodic' | 'daily')}>
          {!isEditMode && (
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="periodic">Periodisch</TabsTrigger>
              <TabsTrigger value="daily">Täglich</TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="periodic" className="space-y-4 mt-4">
            <form onSubmit={periodicForm.handleSubmit(handlePeriodicSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input {...periodicForm.register('name')} placeholder="z.B. Miete" />
                {periodicForm.formState.errors.name && (
                  <p className="text-sm text-destructive">{periodicForm.formState.errors.name.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Betrag (€)</Label>
                  <Input {...periodicForm.register('amount')} placeholder="0.00" type="number" step="0.01" />
                </div>
                <div className="space-y-2">
                  <Label>Wiederholung</Label>
                  <Select
                    value={periodicForm.watch('recurrenceType')}
                    onValueChange={(v) => periodicForm.setValue('recurrenceType', v as ExpenseInput['recurrenceType'])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {recurrenceTypes.map(type => (
                        <SelectItem key={type} value={type}>{recurrenceLabels[type]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant={periodicForm.watch('isSubscription') ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => periodicForm.setValue('isSubscription', !periodicForm.watch('isSubscription'))}
                  className="gap-2"
                >
                  <Check className={`w-4 h-4 ${periodicForm.watch('isSubscription') ? 'opacity-100' : 'opacity-50'}`} />
                  Ist ein Abo
                </Button>
                <span className="text-xs text-muted-foreground">Markiere wiederkehrende Abonnements</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Konto</Label>
                  <Select value={periodicForm.watch('accountId')} onValueChange={(v) => periodicForm.setValue('accountId', v)}>
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
                  <Label>Kategorie</Label>
                  {categories.length === 0 && !showNewCategory ? (
                    <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setShowNewCategory(true)}>
                      <Plus className="w-3 h-3 mr-1" /> Kategorie erstellen
                    </Button>
                  ) : (
                    <div className="flex gap-1.5">
                      <Select value={periodicForm.watch('categoryId')} onValueChange={(v) => periodicForm.setValue('categoryId', v)}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Optional" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.icon} {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => setShowNewCategory(!showNewCategory)} title="Neue Kategorie">
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {showNewCategory && (
                <div className="p-3 rounded-xl border border-border/50 dark:border-white/[0.08] bg-accent/20 dark:bg-white/[0.03] space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">Neue Kategorie erstellen</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Name" />
                    <EmojiPicker value={newCatIcon} onChange={setNewCatIcon} />
                  </div>
                  <div className="flex gap-2">
                    <Input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} className="w-12 h-9 p-0.5 cursor-pointer rounded-lg" />
                    <Button type="button" size="sm" onClick={handleCreateCategory} disabled={isCreatingCategory || !newCatName.trim()} className="flex-1">
                      {isCreatingCategory ? '...' : 'Anlegen'}
                    </Button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Startdatum</Label>
                  <Input type="date" {...periodicForm.register('startDate', { valueAsDate: true })} />
                </div>
                <div className="space-y-2">
                  <Label>Enddatum (optional)</Label>
                  <Input type="date" {...periodicForm.register('endDate', { valueAsDate: true })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Info / Notizen (optional)</Label>
                <Input {...periodicForm.register('info')} placeholder="z.B. Policennummer, Vertragsdetails..." />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Speichern...' : isEditMode ? 'Änderungen speichern' : createdExpenseId ? 'Aktualisieren' : 'Ausgabe erstellen'}
              </Button>

              {showDocuments && (editExpense || createdExpenseId) && (
                <div className="pt-4 border-t border-border/50 space-y-3">
                  <Label className="text-muted-foreground">Dokumente</Label>
                  <DocumentList ref={documentListRef} expenseId={editExpense?.id || createdExpenseId!} />
                  <FileUpload 
                    expenseId={editExpense?.id || createdExpenseId!} 
                    onUploadComplete={handleUploadComplete} 
                  />
                </div>
              )}
            </form>
          </TabsContent>

          <TabsContent value="daily" className="space-y-4 mt-4">
            <form onSubmit={dailyForm.handleSubmit(handleDailySubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label>Beschreibung</Label>
                <Input {...dailyForm.register('description')} placeholder="z.B. Mittagessen" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Betrag (€)</Label>
                  <Input {...dailyForm.register('amount')} placeholder="0.00" type="number" step="0.01" />
                </div>
                <div className="space-y-2">
                  <Label>Datum</Label>
                  <Input type="date" {...dailyForm.register('date', { valueAsDate: true })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Konto</Label>
                  <Select value={dailyForm.watch('accountId')} onValueChange={(v) => dailyForm.setValue('accountId', v)}>
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
                  <Label>Kategorie</Label>
                  {categories.length === 0 && !showNewCategory ? (
                    <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setShowNewCategory(true)}>
                      <Plus className="w-3 h-3 mr-1" /> Kategorie erstellen
                    </Button>
                  ) : (
                    <div className="flex gap-1.5">
                      <Select value={dailyForm.watch('categoryId')} onValueChange={(v) => dailyForm.setValue('categoryId', v)}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Optional" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.icon} {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => setShowNewCategory(!showNewCategory)} title="Neue Kategorie">
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {showNewCategory && (
                <div className="p-3 rounded-xl border border-border/50 dark:border-white/[0.08] bg-accent/20 dark:bg-white/[0.03] space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">Neue Kategorie erstellen</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Name" />
                    <EmojiPicker value={newCatIcon} onChange={setNewCatIcon} />
                  </div>
                  <div className="flex gap-2">
                    <Input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} className="w-12 h-9 p-0.5 cursor-pointer rounded-lg" />
                    <Button type="button" size="sm" onClick={handleCreateCategory} disabled={isCreatingCategory || !newCatName.trim()} className="flex-1">
                      {isCreatingCategory ? '...' : 'Anlegen'}
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Info / Notizen (optional)</Label>
                <Input {...dailyForm.register('info')} placeholder="z.B. Quittungsnr., Händler..." />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Speichern...' : isEditMode ? 'Änderungen speichern' : createdDailyExpenseId ? 'Aktualisieren' : 'Ausgabe erstellen'}
              </Button>

              {showDocuments && (editDailyExpense || createdDailyExpenseId) && (
                <div className="pt-4 border-t border-border/50 space-y-3">
                  <Label className="text-muted-foreground">Dokumente</Label>
                  <DocumentList ref={documentListRef} dailyExpenseId={editDailyExpense?.id || createdDailyExpenseId!} />
                  <FileUpload 
                    dailyExpenseId={editDailyExpense?.id || createdDailyExpenseId!} 
                    onUploadComplete={handleUploadComplete} 
                  />
                </div>
              )}
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}