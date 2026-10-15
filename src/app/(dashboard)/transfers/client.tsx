"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, ArrowRightLeft, Repeat, CalendarDays } from "lucide-react";
import { TransferForm } from "@/components/organisms/transfer-form";
import { deleteTransfer } from "@/actions/transfer-actions";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/lib/settings-context";
import { formatCalendarDate } from "@/lib/format-date";
import { currencies, type Currency } from "@/lib/currency";
import { useTranslations } from "next-intl";
import type { Account, TransferWithDetails } from "@/types/database";

interface TransfersClientProps {
  accounts: Account[];
  initialTransfers: TransferWithDetails[];
}

export function TransfersClient({ accounts, initialTransfers }: TransfersClientProps) {
  const { toast } = useToast();
  const {
    formatCurrency: fmt,
    formatAmount,
    currency: baseCurrency,
    locale,
    convert,
  } = useSettings();
  const formatDate = (date: Date | string) => formatCalendarDate(date, locale);
  const t = useTranslations("transfers");
  const tRecurrence = useTranslations("recurrence");
  const formatCurrency = (amount: string | number) =>
    fmt(typeof amount === "string" ? parseFloat(amount) : amount);

  const toBase = (amount: number, entryCurrency?: string | null): number => {
    const from =
      entryCurrency && currencies.includes(entryCurrency as Currency)
        ? (entryCurrency as Currency)
        : baseCurrency;
    return convert(amount, from, baseCurrency);
  };
  const [transfers, setTransfers] = useState(initialTransfers);

  const getDebitLabel = (transfer: {
    recurrenceType: string;
    startDate: Date | string;
  }): string => {
    const date = new Date(transfer.startDate);
    const day = date.getUTCDate();
    const month = formatCalendarDate(date, locale, { month: "short" });

    switch (transfer.recurrenceType) {
      case "monthly":
        return tRecurrence("everyMonths", { count: 1 });
      case "quarterly":
        return `${day}. ${month} (${tRecurrence("quarterly")})`;
      case "yearly":
        return `${day}. ${month} (${tRecurrence("yearly")})`;
      default:
        return formatDate(transfer.startDate);
    }
  };

  const recurringTransfers = transfers.filter((t) => t.recurrenceType !== "once");
  const oneTimeTransfers = transfers.filter((t) => t.recurrenceType === "once");

  const totalMonthlyRecurring = recurringTransfers
    .filter((t) => t.recurrenceType === "monthly")
    .reduce((sum, t) => sum + toBase(parseFloat(t.amount), t.sourceCurrency), 0);

  const handleSuccess = (data: {
    sourceAccountId: string;
    targetAccountId: string;
    [key: string]: unknown;
  }) => {
    const newTransfer: TransferWithDetails = {
      ...data,
      sourceAccount: accounts.find((a) => a.id === data.sourceAccountId) || null,
      targetAccount: accounts.find((a) => a.id === data.targetAccountId) || null,
    } as TransferWithDetails;
    setTransfers((prev) => [newTransfer, ...prev]);
  };

  const handleDeleteTransfer = async (id: string, description: string) => {
    if (!confirm(t("deleteConfirm", { name: description || t("noDescription") }))) return;

    const result = await deleteTransfer(id);
    if (result.success) {
      setTransfers((prev) => prev.filter((t) => t.id !== id));
      toast({ title: t("deleted"), description: t("deletedDesc") });
    } else {
      toast({ title: t("deleteFailed"), description: "", variant: "destructive" });
    }
  };

  const TransferRow = ({
    transfer,
    onDelete,
  }: {
    transfer: TransferWithDetails;
    onDelete: () => void;
  }) => {
    const amount = parseFloat(transfer.amount);
    const isRecurring = transfer.recurrenceType !== "once";
    const debitLabel = isRecurring ? getDebitLabel(transfer) : null;

    return (
      <div className="hover:bg-accent/30 flex items-start gap-3 rounded-xl p-4 transition-colors duration-200 dark:hover:bg-white/5">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5">
          <ArrowRightLeft className="h-5 w-5 text-emerald-500" />
        </div>
        <div className="min-w-0 flex-1">
          {/* Zeile 1: Beschreibung links, Betrag rechts */}
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium">{transfer.description || t("title")}</p>
            <div className="flex-shrink-0 text-right">
              <p className="font-semibold whitespace-nowrap">
                {formatAmount(amount, transfer.sourceCurrency)}
              </p>
              {transfer.targetAmount && transfer.targetCurrency !== transfer.sourceCurrency && (
                <p className="text-muted-foreground text-xs whitespace-nowrap">
                  → {formatAmount(transfer.targetAmount, transfer.targetCurrency)}
                </p>
              )}
            </div>
          </div>
          {/* Zeile 2: Konten & Intervall links, Löschen rechts */}
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="text-muted-foreground min-w-0 truncate text-sm">
              {transfer.sourceAccount?.name ?? t("unknown")} →{" "}
              {transfer.targetAccount?.name ?? t("unknown")} •{" "}
              {tRecurrence(transfer.recurrenceType)}
            </p>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive flex-shrink-0"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          {/* Zeile 3: Fälligkeits- & Datumsinfo */}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {debitLabel && (
              <div className="flex items-center gap-1">
                <CalendarDays className="text-primary h-3 w-3 flex-shrink-0" />
                <span className="text-primary text-xs font-medium">
                  {t("execution")} {debitLabel}
                </span>
              </div>
            )}
            {transfer.endDate ? (
              <span className="text-muted-foreground text-xs">
                {t("until")} {formatDate(transfer.endDate)}
              </span>
            ) : (
              <span className="text-muted-foreground text-xs">
                {t("since")} {formatDate(transfer.startDate)}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="from-foreground to-foreground/60 bg-gradient-to-br bg-clip-text text-[2rem] leading-none font-bold tracking-[-0.03em] text-transparent">
            {t("title")}
          </h2>
          <p className="text-muted-foreground/60 mt-1.5 text-sm">{t("description")}</p>
        </div>
        <TransferForm accounts={accounts} onSuccess={handleSuccess} />
      </div>

      {transfers.length > 0 && (
        <Card className="hover:bg-card/80 transition-all duration-300 hover:-translate-y-0.5 dark:hover:bg-white/[0.08]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("monthlyTransfers")}</CardTitle>
            <div className="rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 p-2">
              <Repeat className="h-4 w-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">
              {formatCurrency(totalMonthlyRecurring)}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              {t("recurringCount", { count: recurringTransfers.length })}
            </p>
          </CardContent>
        </Card>
      )}

      {recurringTransfers.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 p-2">
                <Repeat className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <CardTitle>{t("recurringTransfers")}</CardTitle>
                <CardDescription>{t("recurringTransfersDesc")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recurringTransfers.map((transfer) => (
                <TransferRow
                  key={transfer.id}
                  transfer={transfer}
                  onDelete={() => handleDeleteTransfer(transfer.id, transfer.description || "")}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {oneTimeTransfers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("oneTimeTransfers")}</CardTitle>
            <CardDescription>{t("oneTimeTransfersDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {oneTimeTransfers.map((transfer) => (
                <TransferRow
                  key={transfer.id}
                  transfer={transfer}
                  onDelete={() => handleDeleteTransfer(transfer.id, transfer.description || "")}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {transfers.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <ArrowRightLeft className="text-muted-foreground/40 mx-auto mb-4 h-12 w-12" />
            <h3 className="mb-2 text-lg font-medium">{t("noTransfers")}</h3>
            <p className="text-muted-foreground mb-4 text-sm">{t("noTransfersDesc")}</p>
            <TransferForm accounts={accounts} onSuccess={handleSuccess} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
