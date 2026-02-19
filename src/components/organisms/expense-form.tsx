'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Check, Upload, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { expenseSchema, dailyExpenseSchema, type ExpenseInput, type DailyExpenseInput, recurrenceTypes } from '@/lib/validations/transaction';
import { createExpense, createDailyExpense, updateExpense, updateDailyExpense } from '@/actions/expense-actions';
import { createCategory } from '@/actions/category-actions';
import { uploadDocument } from '@/actions/document-actions';
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
import { cn } from '@/lib/utils';

const ALLOWED_FILE_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

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

export function ExpenseForm({ accounts, categories: initialCategories, onSuccess, onCategoryCreated, editExpense, editDailyExpense, open: controlledOpen, onOpenChange }: ExpenseFormProps) {
  const t = useTranslations('expenses');
  const tCommon = useTranslations('common');
  const tRecurrence = useTranslations('recurrence');
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
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isUploadingPending, setIsUploadingPending] = useState(false);
  const [pendingFileError, setPendingFileError] = useState<string | null>(null);
  
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const isEditMode = !!editExpense || !!editDailyExpense;
  const showDocuments = isEditMode || createdExpenseId || createdDailyExpenseId;

  const handleUploadComplete = () => {
    documentListRef.current?.refresh();
  };

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return t('onlyPdfPngJpg');
    }
    if (file.size > MAX_FILE_SIZE) {
      return t('fileTooLarge');
    }
    return null;
  };

  const handlePendingFileSelect = (file: File) => {
    const error = validateFile(file);
    if (error) {
      setPendingFileError(error);
      return;
    }
    setPendingFileError(null);
    setPendingFile(file);
  };

  const uploadPendingFile = useCallback(async (expenseId?: string, dailyExpenseId?: string) => {
    if (!pendingFile) return;
    
    setIsUploadingPending(true);
    try {
      const formData = new FormData();
      formData.append('file', pendingFile);
      if (expenseId) formData.append('expenseId', expenseId);
      if (dailyExpenseId) formData.append('dailyExpenseId', dailyExpenseId);

      const result = await uploadDocument(formData);
      if (result.success) {
        setPendingFile(null);
        documentListRef.current?.refresh();
      } else {
        setPendingFileError(result.error ?? t('uploadFailed'));
      }
    } catch {
      setPendingFileError(t('uploadFailed'));
    } finally {
      setIsUploadingPending(false);
    }
  }, [pendingFile]);

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
      setPendingFile(null);
      setPendingFileError(null);
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
          if (pendingFile) {
            await uploadPendingFile(result.data.id, undefined);
          }
          periodicForm.reset();
          setPendingFile(null);
          setOpen(false);
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
          if (pendingFile) {
            await uploadPendingFile(undefined, result.data.id);
          }
          dailyForm.reset();
          setPendingFile(null);
          setOpen(false);
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
            {t('addExpense')}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[500px]" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{isEditMode ? t('editExpense') : t('newExpense')}</DialogTitle>
          <DialogDescription>{isEditMode ? t('editExpense') : t('description')}</DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'periodic' | 'daily')}>
          {!isEditMode && (
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="periodic">{t('periodic')}</TabsTrigger>
              <TabsTrigger value="daily">{t('daily')}</TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="periodic" className="space-y-4 mt-4">
            <form onSubmit={periodicForm.handleSubmit(handlePeriodicSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label>{t('name')}</Label>
                <Input {...periodicForm.register('name')} placeholder={t('namePlaceholder')} />
                {periodicForm.formState.errors.name && (
                  <p className="text-sm text-destructive">{periodicForm.formState.errors.name.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('amount')}</Label>
                  <Input {...periodicForm.register('amount')} placeholder="0.00" type="number" step="0.01" />
                </div>
                <div className="space-y-2">
                  <Label>{t('recurrence')}</Label>
                  <Select
                    value={periodicForm.watch('recurrenceType')}
                    onValueChange={(v) => periodicForm.setValue('recurrenceType', v as ExpenseInput['recurrenceType'])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {recurrenceTypes.map(type => (
                        <SelectItem key={type} value={type}>{tRecurrence(type)}</SelectItem>
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
                  {t('isSubscription')}
                </Button>
                <span className="text-xs text-muted-foreground">{t('subscriptionHint')}</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('account')}</Label>
                  <Select value={periodicForm.watch('accountId')} onValueChange={(v) => periodicForm.setValue('accountId', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectAccount')} />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map(account => (
                        <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('category')}</Label>
                  {categories.length === 0 && !showNewCategory ? (
                    <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setShowNewCategory(true)}>
                      <Plus className="w-3 h-3 mr-1" /> {t('createCategory')}
                    </Button>
                  ) : (
                    <div className="flex gap-1.5">
                      <Select value={periodicForm.watch('categoryId')} onValueChange={(v) => periodicForm.setValue('categoryId', v)}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder={tCommon('all')} />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.icon} {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => setShowNewCategory(!showNewCategory)} title={t('newCategory')}>
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {showNewCategory && (
                <div className="p-3 rounded-xl border border-border/50 dark:border-white/[0.08] bg-accent/20 dark:bg-white/[0.03] space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">{t('newCategory')}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder={t('name')} />
                    <EmojiPicker value={newCatIcon} onChange={setNewCatIcon} />
                  </div>
                  <div className="flex gap-2">
                    <Input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} className="w-12 h-9 p-0.5 cursor-pointer rounded-lg" />
                    <Button type="button" size="sm" onClick={handleCreateCategory} disabled={isCreatingCategory || !newCatName.trim()} className="flex-1">
                      {isCreatingCategory ? '...' : t('createCategoryLabel')}
                    </Button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('startDate')}</Label>
                  <Input type="date" {...periodicForm.register('startDate', { valueAsDate: true })} />
                </div>
                <div className="space-y-2">
                  <Label>{t('endDate')}</Label>
                  <Input type="date" {...periodicForm.register('endDate', { valueAsDate: true })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('info')}</Label>
                <Input {...periodicForm.register('info')} placeholder={t('infoPlaceholder')} />
              </div>

              {!isEditMode && !createdExpenseId && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">{t('documents')}</Label>
                  <div className="space-y-2">
                    <div
                      className={cn(
                        "border-2 border-dashed rounded-xl p-4 text-center transition-colors cursor-pointer",
                        pendingFile 
                          ? "border-green-500/50 bg-green-500/10" 
                          : "border-border/50 hover:border-amber-500/50 hover:bg-accent/50"
                      )}
                    >
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handlePendingFileSelect(file);
                          e.target.value = '';
                        }}
                        className="hidden"
                        id="pending-file-periodic"
                        disabled={isSubmitting || isUploadingPending}
                      />
                      <label htmlFor="pending-file-periodic" className="cursor-pointer">
                        {isUploadingPending ? (
                          <Loader2 className="w-6 h-6 mx-auto mb-1 text-amber-500 animate-spin" />
                        ) : pendingFile ? (
                          <div className="flex items-center justify-center gap-2">
                            <Check className="w-5 h-5 text-green-500" />
                            <span className="text-sm font-medium truncate max-w-[200px]">{pendingFile.name}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                setPendingFile(null);
                              }}
                              className="text-xs text-muted-foreground hover:text-destructive"
                            >
                              {t('fileSelected')}
                            </button>
                          </div>
                        ) : (
                          <>
                            <Upload className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
                            <p className="text-sm">{t('selectFile')}</p>
                            <p className="text-xs text-muted-foreground mt-1">{t('fileTypes')}</p>
                          </>
                        )}
                      </label>
                    </div>
                    {pendingFileError && (
                      <p className="text-sm text-destructive">{pendingFileError}</p>
                    )}
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting || isUploadingPending}>
                {isSubmitting || isUploadingPending ? t('saving') : isEditMode ? t('saveChanges') : createdExpenseId ? tCommon('save') : t('createExpense')}
              </Button>

              {showDocuments && (editExpense || createdExpenseId) && (
                <div className="pt-4 border-t border-border/50 space-y-3">
                  <Label className="text-muted-foreground">{t('documents')}</Label>
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
                <Label>{t('description')}</Label>
                <Input {...dailyForm.register('description')} placeholder={t('descriptionPlaceholder')} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('amount')}</Label>
                  <Input {...dailyForm.register('amount')} placeholder="0.00" type="number" step="0.01" />
                </div>
                <div className="space-y-2">
                  <Label>{t('date')}</Label>
                  <Input type="date" {...dailyForm.register('date', { valueAsDate: true })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('account')}</Label>
                  <Select value={dailyForm.watch('accountId')} onValueChange={(v) => dailyForm.setValue('accountId', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectAccount')} />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map(account => (
                        <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('category')}</Label>
                  {categories.length === 0 && !showNewCategory ? (
                    <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setShowNewCategory(true)}>
                      <Plus className="w-3 h-3 mr-1" /> {t('createCategory')}
                    </Button>
                  ) : (
                    <div className="flex gap-1.5">
                      <Select value={dailyForm.watch('categoryId')} onValueChange={(v) => dailyForm.setValue('categoryId', v)}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder={tCommon('all')} />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.icon} {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => setShowNewCategory(!showNewCategory)} title={t('newCategory')}>
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {showNewCategory && (
                <div className="p-3 rounded-xl border border-border/50 dark:border-white/[0.08] bg-accent/20 dark:bg-white/[0.03] space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">{t('newCategory')}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder={t('name')} />
                    <EmojiPicker value={newCatIcon} onChange={setNewCatIcon} />
                  </div>
                  <div className="flex gap-2">
                    <Input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} className="w-12 h-9 p-0.5 cursor-pointer rounded-lg" />
                    <Button type="button" size="sm" onClick={handleCreateCategory} disabled={isCreatingCategory || !newCatName.trim()} className="flex-1">
                      {isCreatingCategory ? '...' : t('createCategoryLabel')}
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>{t('info')}</Label>
                <Input {...dailyForm.register('info')} placeholder={t('infoPlaceholder')} />
              </div>

              {!isEditMode && !createdDailyExpenseId && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">{t('documents')}</Label>
                  <div className="space-y-2">
                    <div
                      className={cn(
                        "border-2 border-dashed rounded-xl p-4 text-center transition-colors cursor-pointer",
                        pendingFile 
                          ? "border-green-500/50 bg-green-500/10" 
                          : "border-border/50 hover:border-amber-500/50 hover:bg-accent/50"
                      )}
                    >
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handlePendingFileSelect(file);
                          e.target.value = '';
                        }}
                        className="hidden"
                        id="pending-file-daily"
                        disabled={isSubmitting || isUploadingPending}
                      />
                      <label htmlFor="pending-file-daily" className="cursor-pointer">
                        {isUploadingPending ? (
                          <Loader2 className="w-6 h-6 mx-auto mb-1 text-amber-500 animate-spin" />
                        ) : pendingFile ? (
                          <div className="flex items-center justify-center gap-2">
                            <Check className="w-5 h-5 text-green-500" />
                            <span className="text-sm font-medium truncate max-w-[200px]">{pendingFile.name}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                setPendingFile(null);
                              }}
                              className="text-xs text-muted-foreground hover:text-destructive"
                            >
                              {t('fileSelected')}
                            </button>
                          </div>
                        ) : (
                          <>
                            <Upload className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
                            <p className="text-sm">{t('selectFile')}</p>
                            <p className="text-xs text-muted-foreground mt-1">{t('fileTypes')}</p>
                          </>
                        )}
                      </label>
                    </div>
                    {pendingFileError && (
                      <p className="text-sm text-destructive">{pendingFileError}</p>
                    )}
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting || isUploadingPending}>
                {isSubmitting || isUploadingPending ? t('saving') : isEditMode ? t('saveChanges') : createdDailyExpenseId ? tCommon('save') : t('createExpense')}
              </Button>

              {showDocuments && (editDailyExpense || createdDailyExpenseId) && (
                <div className="pt-4 border-t border-border/50 space-y-3">
                  <Label className="text-muted-foreground">{t('documents')}</Label>
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