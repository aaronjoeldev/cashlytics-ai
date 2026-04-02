"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ScanLine, ChevronLeft, Loader2, CheckCircle2, AlertTriangle, Info } from "lucide-react";
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
import { createDailyExpense } from "@/actions/daily-expenses-actions";
import { uploadDocument } from "@/actions/document-actions";
import { currencies, type Currency, currencySymbols, convertCurrency } from "@/lib/currency";
import type { Account, Category } from "@/types/database";
import type { ReceiptScanResult } from "@/types/receipt";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png"];

type ScanStep = "idle" | "processing" | "review" | "saving" | "success";

interface ScanClientProps {
  accounts: Account[];
  categories: Category[];
}

export function ScanClient({ accounts, categories }: ScanClientProps) {
  const router = useRouter();
  const t = useTranslations("receiptScan");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<ScanStep>("idle");
  const [scanResult, setScanResult] = useState<ReceiptScanResult | null>(null);
  const [scannedFile, setScannedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Form fields
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id ?? "");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("none");
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(
    (accounts[0]?.currency as Currency) ?? "EUR"
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function handleFileSelect(file: File) {
    setError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError(t("errors.invalidType"));
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(t("errors.fileTooLarge"));
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setScannedFile(file);
    setStep("processing");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/receipt-scan", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error ?? t("errors.scanFailed"));
      }

      const result: ReceiptScanResult = json.data;
      setScanResult(result);

      // Prefill form fields
      setDescription(result.merchant ?? result.description ?? "");
      setAmount(result.amount?.toString() ?? "");
      setDate(result.date ?? new Date().toISOString().split("T")[0]);

      // Pre-select scanned currency if recognized
      if (result.currency && currencies.includes(result.currency as Currency)) {
        setSelectedCurrency(result.currency as Currency);
      }

      // Match suggested category
      if (result.suggestedCategoryName) {
        const matched = categories.find(
          (c) => c.name.toLowerCase() === result.suggestedCategoryName!.toLowerCase()
        );
        setSelectedCategoryId(matched?.id ?? "none");
      }

      setStep("review");
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("errors.scanFailed");
      setError(msg);
      setStep("idle");
    }
  }

  async function handleSave() {
    if (!selectedAccountId || !description || !amount || !date) return;

    setStep("saving");

    const account = accounts.find((a) => a.id === selectedAccountId);
    const accountCurrency = (account?.currency as Currency) ?? "EUR";
    const parsedAmount = parseFloat(amount);
    const isForeignCurrency = selectedCurrency !== accountCurrency;

    const result = await createDailyExpense({
      accountId: selectedAccountId,
      categoryId: selectedCategoryId === "none" ? null : selectedCategoryId,
      description,
      amount: parsedAmount,
      date: new Date(date),
      currency: selectedCurrency,
      originalAmount: isForeignCurrency ? parsedAmount : undefined,
      exchangeRate: isForeignCurrency
        ? convertCurrency(1, selectedCurrency, accountCurrency)
        : undefined,
    });

    if (!result.success) {
      toast.error(result.error ?? t("errors.saveFailed"));
      setStep("review");
      return;
    }

    // Attach the receipt image as document
    if (scannedFile && result.data) {
      try {
        const docForm = new FormData();
        docForm.append("file", scannedFile);
        docForm.append("dailyExpenseId", result.data.id);
        await uploadDocument(docForm);
      } catch {
        // Document upload failure is non-critical
      }
    }

    setStep("success");
  }

  function resetToIdle() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setStep("idle");
    setScanResult(null);
    setScannedFile(null);
    setPreviewUrl(null);
    setError(null);
    setDescription("");
    setAmount("");
    setDate("");
    setSelectedAccountId(accounts[0]?.id ?? "");
    setSelectedCategoryId("none");
    setSelectedCurrency((accounts[0]?.currency as Currency) ?? "EUR");
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }

  return (
    <div className="flex min-h-screen items-start justify-center px-4 pt-8 pb-16">
      <div className="w-full max-w-[480px]">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => router.back()}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">{t("title")}</h1>
        </div>

        {/* ── Step: idle ── */}
        {step === "idle" && (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">{t("subtitle")}</p>

            <div
              className={`flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 transition-colors ${
                isDragging
                  ? "border-amber-500 bg-amber-500/5"
                  : "border-border hover:bg-muted/30 hover:border-amber-500/50"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDrop={onDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
            >
              <div className="bg-muted flex h-14 w-14 items-center justify-center rounded-xl">
                <ScanLine className="text-muted-foreground h-7 w-7" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">{t("dropzoneTitle")}</p>
                <p className="text-muted-foreground mt-1 text-xs">{t("dropzoneHint")}</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
              />
            </div>

            {error && (
              <div className="border-destructive/30 bg-destructive/10 flex items-start gap-2 rounded-xl border px-4 py-3">
                <AlertTriangle className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
                <p className="text-destructive text-sm">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Step: processing ── */}
        {step === "processing" && (
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            <p className="text-muted-foreground text-sm">{t("processing")}</p>
          </div>
        )}

        {/* ── Step: review ── */}
        {(step === "review" || step === "saving") && (
          <div className="space-y-5">
            {/* Preview + confidence */}
            {previewUrl && (
              <div className="space-y-2">
                <img
                  src={previewUrl}
                  alt={t("imageAlt")}
                  className="max-h-[140px] w-full rounded-xl object-contain"
                />
                {scanResult?.confidence === "medium" && (
                  <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-yellow-600 dark:text-yellow-400" />
                    <p className="text-xs font-medium text-yellow-700 dark:text-yellow-400">
                      {t("confidenceMedium")}
                    </p>
                  </div>
                )}
                {scanResult?.confidence === "low" && (
                  <div className="border-destructive/30 bg-destructive/10 flex items-center gap-2 rounded-lg border px-3 py-2">
                    <AlertTriangle className="text-destructive h-3.5 w-3.5 shrink-0" />
                    <p className="text-destructive text-xs font-medium">{t("confidenceLow")}</p>
                  </div>
                )}
              </div>
            )}

            {/* Form */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="description">{t("fields.description")}</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("fields.descriptionPlaceholder")}
                  disabled={step === "saving"}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="amount">{t("fields.amount")}</Label>
                  <div className="flex gap-1.5">
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      disabled={step === "saving"}
                      className="flex-1"
                    />
                    <Select
                      value={selectedCurrency}
                      onValueChange={(v) => setSelectedCurrency(v as Currency)}
                      disabled={step === "saving"}
                    >
                      <SelectTrigger className="w-[80px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c} {currencySymbols[c]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {(() => {
                    const account = accounts.find((a) => a.id === selectedAccountId);
                    const accountCurrency = (account?.currency as Currency) ?? "EUR";
                    const parsedAmt = parseFloat(amount || "0");
                    if (selectedCurrency !== accountCurrency && parsedAmt > 0) {
                      const converted = convertCurrency(parsedAmt, selectedCurrency, accountCurrency);
                      return (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Info className="h-3 w-3 shrink-0" />
                          <span>
                            ≈ {converted.toFixed(2)} {accountCurrency}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="date">{t("fields.date")}</Label>
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    disabled={step === "saving"}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{t("fields.account")}</Label>
                <Select
                  value={selectedAccountId}
                  onValueChange={setSelectedAccountId}
                  disabled={step === "saving"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("fields.accountPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>{t("fields.category")}</Label>
                <Select
                  value={selectedCategoryId}
                  onValueChange={setSelectedCategoryId}
                  disabled={step === "saving"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("fields.noCategory")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("fields.noCategory")}</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.icon ? `${cat.icon} ` : ""}
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <Button
                className="w-full"
                onClick={handleSave}
                disabled={
                  step === "saving" || !selectedAccountId || !description.trim() || !amount || !date
                }
              >
                {step === "saving" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("saving")}
                  </>
                ) : (
                  t("actions.save")
                )}
              </Button>

              <Button
                variant="ghost"
                className="w-full text-sm"
                onClick={resetToIdle}
                disabled={step === "saving"}
              >
                {t("actions.scanAnother")}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step: success ── */}
        {step === "success" && (
          <div className="flex min-h-[300px] flex-col items-center justify-center gap-5 text-center">
            <CheckCircle2 className="h-14 w-14 text-emerald-500" />
            <div>
              <h2 className="text-lg font-semibold">{t("success.title")}</h2>
              {description && amount && (
                <p className="text-muted-foreground mt-1 text-sm">
                  {parseFloat(amount).toLocaleString("de-DE", {
                    style: "currency",
                    currency: scanResult?.currency ?? "EUR",
                  })}{" "}
                  · {description}
                </p>
              )}
            </div>

            <div className="flex w-full flex-col gap-2">
              <Button onClick={resetToIdle} variant="outline" className="w-full">
                {t("actions.scanAnother")}
              </Button>
              <Button onClick={() => router.push("/expenses")} className="w-full">
                {t("actions.viewExpenses")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
