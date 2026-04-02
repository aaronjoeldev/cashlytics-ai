"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import {
  incomeSchema,
  type IncomeInput,
  incomeRecurrenceTypes,
} from "@/lib/validations/transaction";
import { createIncome, updateIncome } from "@/actions/income-actions";
import { currencies, type Currency, currencySymbols, defaultCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import type { Account, Income } from "@/types/database";

interface IncomeFormProps {
  accounts: Account[];
  onSuccess?: (data: Income) => void;
  editIncome?: Income | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function IncomeForm({
  accounts,
  onSuccess,
  editIncome,
  open: controlledOpen,
  onOpenChange,
}: IncomeFormProps) {
  const t = useTranslations("income");
  const tRecurrence = useTranslations("recurrence");
  const [internalOpen, setInternalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const isEditMode = !!editIncome;

  const form = useForm<IncomeInput>({
    resolver: zodResolver(incomeSchema),
    defaultValues: {
      accountId: "",
      source: "",
      amount: "",
      currency: defaultCurrency,
      recurrenceType: "monthly",
      startDate: new Date(),
      endDate: null,
      info: "",
    },
  });

  const selectedAccountId = form.watch("accountId");
  const selectedCurrency = (form.watch("currency") as Currency) ?? defaultCurrency;

  useEffect(() => {
    const current = form.getValues("currency");
    if (current && current !== defaultCurrency) return;
    const account = accounts.find((a) => a.id === selectedAccountId);
    if (account?.currency && currencies.includes(account.currency as Currency)) {
      form.setValue("currency", account.currency as Currency);
    }
  }, [selectedAccountId, accounts]);

  useEffect(() => {
    if (editIncome) {
      form.reset({
        accountId: editIncome.accountId || "",
        source: editIncome.source,
        amount: editIncome.amount,
        currency: (editIncome.currency as Currency) ?? defaultCurrency,
        recurrenceType: editIncome.recurrenceType as IncomeInput["recurrenceType"],
        startDate: new Date(editIncome.startDate),
        endDate: editIncome.endDate ? new Date(editIncome.endDate) : null,
        info: editIncome.info || "",
      });
    } else {
      form.reset({
        accountId: "",
        source: "",
        amount: "",
        currency: defaultCurrency,
        recurrenceType: "monthly",
        startDate: new Date(),
        endDate: null,
        info: "",
      });
    }
  }, [editIncome, form]);

  const handleSubmit = async (data: IncomeInput) => {
    setIsSubmitting(true);
    try {
      const endDate =
        data.endDate && data.endDate !== ""
          ? typeof data.endDate === "string"
            ? new Date(data.endDate)
            : data.endDate
          : null;

      if (isEditMode && editIncome) {
        const result = await updateIncome(editIncome.id, {
          accountId: data.accountId,
          source: data.source,
          amount: data.amount,
          currency: data.currency,
          recurrenceType: data.recurrenceType,
          startDate: data.startDate,
          endDate,
          info: data.info,
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
          currency: data.currency,
          recurrenceType: data.recurrenceType,
          startDate: data.startDate,
          endDate,
          info: data.info,
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
            <Plus className="mr-2 h-4 w-4" />
            {t("addIncome")}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? t("editIncome") : t("newIncome")}</DialogTitle>
          <DialogDescription>
            {isEditMode ? t("editIncomeDesc") : t("newIncomeDesc")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label>{t("source")}</Label>
            <Input {...form.register("source")} placeholder={t("sourcePlaceholder")} />
            {form.formState.errors.source && (
              <p className="text-destructive text-sm">{form.formState.errors.source.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("amount")}</Label>
              <div className="flex gap-1.5">
                <Input {...form.register("amount")} placeholder="0.00" type="number" step="0.01" className="flex-1" />
                <Select value={selectedCurrency} onValueChange={(v) => form.setValue("currency", v as Currency)}>
                  <SelectTrigger className="w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => (
                      <SelectItem key={c} value={c}>{c} {currencySymbols[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("recurrence")}</Label>
              <Select
                value={form.watch("recurrenceType")}
                onValueChange={(v) =>
                  form.setValue("recurrenceType", v as IncomeInput["recurrenceType"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {incomeRecurrenceTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {tRecurrence(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("account")}</Label>
              <Select
                value={form.watch("accountId")}
                onValueChange={(v) => form.setValue("accountId", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectAccount")} />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("startDate")}</Label>
              <Input type="date" {...form.register("startDate", { valueAsDate: true })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("endDate")}</Label>
            <Input type="date" {...form.register("endDate", { valueAsDate: true })} />
          </div>

          <div className="space-y-2">
            <Label>{t("info")}</Label>
            <Input {...form.register("info")} placeholder={t("infoPlaceholder")} />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? t("saving") : isEditMode ? t("saveChanges") : t("createIncome")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
