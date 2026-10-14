"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Controller, useForm, type FieldErrors } from "react-hook-form";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, ArrowRight } from "lucide-react";
import {
  transferSchema,
  transferRecurrenceTypes,
  type TransferInput,
} from "@/lib/validations/transaction";
import { createTransfer } from "@/actions/transfer-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/molecules/date-input";
import { getLocalCalendarDay } from "@/lib/recurrence";
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
import type { Account, Transfer } from "@/types/database";

/** Shows the first client-side validation message; most fields have no inline error. */
function showFirstError(errors: FieldErrors) {
  const first = Object.values(errors)[0];
  if (first?.message) toast.error(String(first.message));
}

interface TransferFormProps {
  accounts: Account[];
  onSuccess?: (data: Transfer) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function TransferForm({
  accounts,
  onSuccess,
  open: controlledOpen,
  onOpenChange,
}: TransferFormProps) {
  const t = useTranslations("transfers");
  const tRecurrence = useTranslations("recurrence");
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
      sourceAccountId: "",
      targetAccountId: "",
      amount: "",
      description: "",
      recurrenceType: "once",
      startDate: getLocalCalendarDay(),
      endDate: null,
    },
  });

  const handleSubmit = async (data: TransferInput) => {
    setIsSubmitting(true);
    try {
      const endDate =
        data.endDate && data.endDate !== ""
          ? typeof data.endDate === "string"
            ? new Date(data.endDate)
            : data.endDate
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
      if (!result.success) toast.error(result.error);

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
            <Plus className="mr-2 h-4 w-4" />
            {t("addTransfer")}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("newTransfer")}</DialogTitle>
          <DialogDescription>{t("newTransferDesc")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit, showFirstError)} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr,auto,1fr] sm:items-end">
            <div className="space-y-2">
              <Label>{t("sourceAccount")}</Label>
              <Select
                value={form.watch("sourceAccountId")}
                onValueChange={(v) => form.setValue("sourceAccountId", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("sourceAccountPlaceholder")} />
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
            <ArrowRight className="text-muted-foreground mb-2.5 h-5 w-5" />
            <div className="space-y-2">
              <Label>{t("targetAccount")}</Label>
              <Select
                value={form.watch("targetAccountId")}
                onValueChange={(v) => form.setValue("targetAccountId", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("targetAccountPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {accounts
                    .filter((a) => a.id !== form.watch("sourceAccountId"))
                    .map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.formState.errors.targetAccountId && (
            <p className="text-destructive text-sm">
              {form.formState.errors.targetAccountId.message}
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("amount")}</Label>
              <Input {...form.register("amount")} placeholder="0.00" type="number" step="0.01" />
              {form.formState.errors.amount && (
                <p className="text-destructive text-sm">{form.formState.errors.amount.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t("recurrence")}</Label>
              <Select
                value={form.watch("recurrenceType")}
                onValueChange={(v) =>
                  form.setValue("recurrenceType", v as TransferInput["recurrenceType"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {transferRecurrenceTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {tRecurrence(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("descriptionField")}</Label>
            <Input {...form.register("description")} placeholder={t("descriptionPlaceholder")} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("startDate")}</Label>
              <Controller
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <DateInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("endDate")}</Label>
              <Controller
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <DateInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
                )}
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? t("saving") : t("createTransfer")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
