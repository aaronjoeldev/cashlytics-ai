"use client";

import { useMemo, useState } from "react";
import {
  confirmImportSession,
  getImportSessionSnapshot,
  removeStagedImportRow,
  runImportReconciliation,
  saveImportConflictDecisions,
  stageCsvImportUpload,
  type ImportSessionSnapshot,
} from "@/actions/import-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DialogClose,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/lib/settings-context";
import { CircleHelp, Download } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Account } from "@/types/database";
import {
  buildDecisionPayload,
  getImportFlowStep,
  getUnresolvedConflictCount,
  type ImportConflictItem,
} from "./flow";

type DecisionValue = "keep_both" | "replace_existing" | "skip_import_row";
type UploadProcessingStage =
  "idle" | "staging" | "reconciling" | "loadingSnapshot" | "done" | "error";

interface ImportClientProps {
  accounts: Account[];
}

const requiredFieldKeys = ["bookingDate", "amount"] as const;
// Without a currency column the rows get the currency of the selected account
const optionalFieldKeys = [
  "currency",
  "description",
  "counterparty",
  "senderAccount",
  "receiverAccount",
  "balanceAfterBooking",
  "reference",
] as const;

const canonicalFieldByKey: Record<
  (typeof requiredFieldKeys)[number] | (typeof optionalFieldKeys)[number],
  string
> = {
  bookingDate: "booking_date",
  amount: "amount",
  currency: "currency",
  description: "description",
  counterparty: "counterparty",
  senderAccount: "sender_account",
  receiverAccount: "receiver_account",
  balanceAfterBooking: "balance_after_booking",
  reference: "reference",
};

function buildConflictItems(snapshot: ImportSessionSnapshot | null): ImportConflictItem[] {
  if (!snapshot) {
    return [];
  }

  return snapshot.conflicts.map((conflict) => ({
    id: conflict.id,
    decision: conflict.decision,
  }));
}

function getUploadProcessingMeta(stage: UploadProcessingStage): {
  value: number;
  titleKey: "stagingTitle" | "reconcilingTitle" | "loadingTitle" | "doneTitle" | "errorTitle";
  descriptionKey:
    | "stagingDescription"
    | "reconcilingDescription"
    | "loadingDescription"
    | "doneDescription"
    | "errorDescription";
} | null {
  switch (stage) {
    case "staging":
      return { value: 30, titleKey: "stagingTitle", descriptionKey: "stagingDescription" };
    case "reconciling":
      return { value: 70, titleKey: "reconcilingTitle", descriptionKey: "reconcilingDescription" };
    case "loadingSnapshot":
      return { value: 90, titleKey: "loadingTitle", descriptionKey: "loadingDescription" };
    case "done":
      return { value: 100, titleKey: "doneTitle", descriptionKey: "doneDescription" };
    case "error":
      return { value: 100, titleKey: "errorTitle", descriptionKey: "errorDescription" };
    case "idle":
      return null;
    default:
      return null;
  }
}

export function ImportClient({ accounts }: ImportClientProps) {
  const { toast } = useToast();
  const { formatAmount } = useSettings();
  const t = useTranslations("csvImport");

  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [headerMappingText, setHeaderMappingText] = useState("{}");
  const [showHeaderMapping, setShowHeaderMapping] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [snapshot, setSnapshot] = useState<ImportSessionSnapshot | null>(null);
  const [uploadProcessingStage, setUploadProcessingStage] = useState<UploadProcessingStage>("idle");
  // Shown in the review card; a toast would be replaced by the next one
  const [alreadyImportedAt, setAlreadyImportedAt] = useState<Date | null>(null);

  const isMissingHeaderMappingError = (errorMessage: string): boolean => {
    const normalized = errorMessage.toLowerCase();
    return (
      normalized.includes("header mapping missing required fields") ||
      normalized.includes("required csv headers are missing")
    );
  };

  const rowById = useMemo(() => {
    return new Map(snapshot?.rows.map((row) => [row.id, row]) ?? []);
  }, [snapshot]);

  const conflictItems = useMemo(() => buildConflictItems(snapshot), [snapshot]);
  const unresolvedConflictCount = getUnresolvedConflictCount(conflictItems);
  const currentStep = getImportFlowStep({
    hasSession: snapshot !== null,
    rowCount: snapshot?.rows.length ?? 0,
    conflictCount: snapshot?.conflicts.length ?? 0,
    unresolvedConflictCount,
  });

  const uploadProcessingMeta = getUploadProcessingMeta(uploadProcessingStage);

  const refreshSnapshot = async (sessionId: string) => {
    const response = await getImportSessionSnapshot(sessionId);
    if (!response.success) {
      toast({ title: t("errors.unknown"), description: response.error, variant: "destructive" });
      return false;
    }

    setSnapshot(response.data);
    return true;
  };

  const handleUpload = async () => {
    if (!selectedAccountId) {
      toast({ title: t("errors.accountRequired"), variant: "destructive" });
      return;
    }

    if (!file) {
      toast({ title: t("errors.fileRequired"), variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    setUploadProcessingStage("staging");
    try {
      const formData = new FormData();
      formData.append("accountId", selectedAccountId);
      formData.append("file", file);
      if (showHeaderMapping && headerMappingText.trim().length > 0) {
        formData.append("headerMapping", headerMappingText);
      }

      const stageResult = await stageCsvImportUpload(formData);
      if (!stageResult.success) {
        setUploadProcessingStage("error");
        if (isMissingHeaderMappingError(stageResult.error)) {
          setShowHeaderMapping(true);
          toast({
            title: t("errors.mappingRequired"),
            description: t("form.autoMappingFailedHint"),
            variant: "destructive",
          });
          return;
        }
        toast({
          title: t("errors.parseFailed"),
          description: stageResult.error,
          variant: "destructive",
        });
        return;
      }

      toast({ title: t("toasts.stagedSuccess") });
      setAlreadyImportedAt(
        stageResult.data.alreadyImportedAt ? new Date(stageResult.data.alreadyImportedAt) : null
      );

      await reconcileAndLoad(stageResult.data.sessionId);
    } catch {
      setUploadProcessingStage("error");
      toast({ title: t("errors.unknown"), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Runs the duplicate check and loads the review data; a failed check keeps the import blocked */
  const reconcileAndLoad = async (sessionId: string) => {
    setUploadProcessingStage("reconciling");
    const reconciliationResult = await runImportReconciliation(sessionId);
    if (!reconciliationResult.success) {
      toast({
        title: t("errors.reconciliationFailed"),
        description: reconciliationResult.error,
        variant: "destructive",
      });
    } else if (reconciliationResult.data.uncheckedRowCount > 0) {
      toast({
        title: t("toasts.reconciliationPartial", {
          count: reconciliationResult.data.uncheckedRowCount,
        }),
        variant: "destructive",
      });
    } else {
      toast({ title: t("toasts.reconciliationSuccess") });
    }

    setUploadProcessingStage("loadingSnapshot");
    const loaded = await refreshSnapshot(sessionId);
    setUploadProcessingStage(loaded && reconciliationResult.success ? "done" : "error");
  };

  const handleRetryReconciliation = async () => {
    if (!snapshot) {
      return;
    }

    setIsSubmitting(true);
    try {
      await reconcileAndLoad(snapshot.session.id);
    } catch {
      setUploadProcessingStage("error");
      toast({ title: t("errors.unknown"), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDecisions = async () => {
    if (!snapshot) {
      return;
    }

    const payload = buildDecisionPayload(conflictItems);
    if (payload.length === 0) {
      toast({ title: t("errors.decisionSaveFailed"), variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await saveImportConflictDecisions(snapshot.session.id, payload);
      if (!result.success) {
        toast({
          title: t("errors.decisionSaveFailed"),
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      toast({ title: t("toasts.decisionsSaved") });
      await refreshSnapshot(snapshot.session.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecisionChange = (conflictId: string, decision: DecisionValue) => {
    if (!snapshot) {
      return;
    }

    const nextSnapshot: ImportSessionSnapshot = {
      ...snapshot,
      conflicts: snapshot.conflicts.map((conflict) =>
        conflict.id === conflictId ? { ...conflict, decision } : conflict
      ),
    };
    setSnapshot(nextSnapshot);
  };

  const handleRemoveRow = async (rowId: string) => {
    if (!snapshot) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await removeStagedImportRow(snapshot.session.id, rowId);
      if (!result.success) {
        toast({
          title: t("errors.removeRowFailed"),
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      toast({ title: t("toasts.rowRemoved") });
      await refreshSnapshot(snapshot.session.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!snapshot) {
      return;
    }

    const decisions = buildDecisionPayload(conflictItems);
    if (snapshot.conflicts.length > 0 && decisions.length !== snapshot.conflicts.length) {
      toast({ title: t("conflict.unresolvedWarning"), variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await confirmImportSession(snapshot.session.id, decisions);
      if (!result.success) {
        toast({
          title: t("errors.commitFailed"),
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      toast({ title: t("toasts.importConfirmed") });
      setSnapshot(null);
      setFile(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="from-foreground to-foreground/60 bg-gradient-to-br bg-clip-text text-[2rem] leading-none font-bold tracking-[-0.03em] text-transparent">
          {t("title")}
        </h2>
        <p className="text-muted-foreground/60 mt-1.5 text-sm">{t("description")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={currentStep === "upload" ? "default" : "secondary"}>
          {t("steps.upload")}
        </Badge>
        <Badge variant={currentStep === "resolveConflicts" ? "default" : "secondary"}>
          {t("steps.resolveConflicts")}
        </Badge>
        <Badge variant={currentStep === "reviewRows" ? "default" : "secondary"}>
          {t("steps.reviewRows")}
        </Badge>
        <Badge variant={currentStep === "confirm" ? "default" : "secondary"}>
          {t("steps.confirm")}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("steps.upload")}</CardTitle>
          <CardDescription>{t("form.fileHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {uploadProcessingMeta && (
            <div className="space-y-2 rounded-xl border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  {t(`processing.${uploadProcessingMeta.titleKey}`)}
                </p>
                <span className="text-muted-foreground text-xs">{uploadProcessingMeta.value}%</span>
              </div>
              <Progress value={uploadProcessingMeta.value} />
              <p className="text-muted-foreground text-xs">
                {t(`processing.${uploadProcessingMeta.descriptionKey}`)}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>{t("form.accountLabel")}</Label>
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger>
                <SelectValue placeholder={t("form.accountPlaceholder")} />
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
            <Label>{t("form.fileLabel")}</Label>
            <Input
              type="file"
              accept=".csv,.txt,text/csv"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href="/examples/csv-import-template.csv" download>
                <Download className="size-4" />
                {t("form.downloadTemplate")}
              </a>
            </Button>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <CircleHelp className="size-4" />
                  {t("form.showStructureHelp")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("infoModal.title")}</DialogTitle>
                  <DialogDescription>{t("infoModal.description")}</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 text-sm">
                  <div>
                    <p className="font-medium">{t("infoModal.requiredFieldsTitle")}</p>
                    <ul className="mt-2 space-y-1">
                      {requiredFieldKeys.map((field) => (
                        <li key={field} className="text-muted-foreground flex items-center gap-2">
                          <code className="text-foreground bg-muted rounded px-1.5 py-0.5 text-xs">
                            {canonicalFieldByKey[field]}
                          </code>
                          <span>{t(`headerFields.${field}`)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="font-medium">{t("infoModal.optionalFieldsTitle")}</p>
                    <ul className="mt-2 space-y-1">
                      {optionalFieldKeys.map((field) => (
                        <li key={field} className="text-muted-foreground flex items-center gap-2">
                          <code className="text-foreground bg-muted rounded px-1.5 py-0.5 text-xs">
                            {canonicalFieldByKey[field]}
                          </code>
                          <span>{t(`headerFields.${field}`)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <p className="text-muted-foreground">{t("infoModal.exampleHint")}</p>
                </div>

                <div className="flex justify-end">
                  <DialogClose asChild>
                    <Button variant="outline">{t("infoModal.closeButton")}</Button>
                  </DialogClose>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {showHeaderMapping && (
            <div className="space-y-2">
              <Label>{t("form.headerMappingTitle")}</Label>
              <Input
                value={headerMappingText}
                onChange={(event) => setHeaderMappingText(event.target.value)}
              />
              <p className="text-muted-foreground text-xs">{t("form.manualMappingHint")}</p>
            </div>
          )}

          <Button onClick={handleUpload} disabled={isSubmitting}>
            {t("actions.uploadFile")}
          </Button>
        </CardContent>
      </Card>

      {snapshot && (
        <Card>
          <CardHeader>
            <CardTitle>{t("review.title")}</CardTitle>
            <CardDescription>{snapshot.session.sourceFileName}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <p>
                {t("summary.totalRows")}: <strong>{snapshot.session.totalRows}</strong>
              </p>
              <p>
                {t("summary.stagedRows")}: <strong>{snapshot.rows.length}</strong>
              </p>
              <p>
                {t("summary.conflictRows")}: <strong>{snapshot.conflicts.length}</strong>
              </p>
            </div>
            {alreadyImportedAt && (
              <p className="text-destructive mt-3 text-sm">
                {t("toasts.alreadyImported", { date: alreadyImportedAt.toLocaleDateString() })}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {snapshot && snapshot.conflicts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("conflict.title")}</CardTitle>
            <CardDescription>{t("conflict.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {snapshot.conflicts.map((conflict) => {
              const importRow = rowById.get(conflict.importRowId);
              const confidenceValue = conflict.confidence
                ? Math.round(Number.parseFloat(conflict.confidence) * 100)
                : null;

              return (
                <div key={conflict.id} className="space-y-2 rounded-xl border p-4">
                  <p className="font-medium">{t("conflict.importedRecord")}</p>
                  <p className="text-sm">{importRow?.description ?? "-"}</p>
                  <p className="text-sm">
                    {importRow ? formatAmount(importRow.amount, importRow.currency) : "-"}
                  </p>
                  {conflict.existingRecord && (
                    <>
                      <p className="font-medium">{t("conflict.existingRecord")}</p>
                      <p className="text-sm">{conflict.existingRecord.description}</p>
                      <p className="text-sm">
                        {formatAmount(
                          conflict.existingRecord.amount,
                          conflict.existingRecord.currency
                        )}
                      </p>
                    </>
                  )}
                  {confidenceValue !== null && (
                    <p className="text-muted-foreground text-sm">
                      {t("conflict.confidence", { value: confidenceValue })}
                    </p>
                  )}
                  {conflict.explanation && (
                    <p className="text-muted-foreground text-sm">
                      {t("conflict.explanation")}: {conflict.explanation}
                    </p>
                  )}
                  <Select
                    value={conflict.decision ?? undefined}
                    onValueChange={(value) =>
                      handleDecisionChange(conflict.id, value as DecisionValue)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("conflict.chooseDecision")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keep_both">{t("decisions.keepBoth")}</SelectItem>
                      <SelectItem value="replace_existing">
                        {t("decisions.replaceExisting")}
                      </SelectItem>
                      <SelectItem value="skip_import_row">
                        {t("decisions.skipImportRow")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              );
            })}

            {unresolvedConflictCount > 0 && (
              <p className="text-destructive text-sm">{t("conflict.unresolvedWarning")}</p>
            )}

            <Button onClick={handleSaveDecisions} disabled={isSubmitting}>
              {t("actions.saveDecisions")}
            </Button>
          </CardContent>
        </Card>
      )}

      {snapshot && (
        <Card>
          <CardHeader>
            <CardTitle>{t("review.title")}</CardTitle>
            <CardDescription>{t("review.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.rows.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("review.noRowsRemaining")}</p>
            ) : (
              snapshot.rows.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-3 rounded-xl border p-3"
                >
                  <div>
                    <p className="font-medium">{row.description}</p>
                    <p className="text-muted-foreground text-sm">
                      {formatAmount(row.amount, row.currency)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleRemoveRow(row.id)}
                  >
                    {t("review.removeRow")}
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {snapshot && (
        <Card>
          <CardHeader>
            <CardTitle>{t("confirm.title")}</CardTitle>
            <CardDescription>{t("confirm.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!snapshot.session.reconciled && (
              <div className="space-y-2">
                <p className="text-destructive text-sm">{t("confirm.reconciliationMissing")}</p>
                <Button
                  variant="outline"
                  onClick={handleRetryReconciliation}
                  disabled={isSubmitting}
                >
                  {t("actions.runReconciliation")}
                </Button>
              </div>
            )}
            <p className="text-muted-foreground text-sm">{t("confirm.irreversibleWarning")}</p>
            <Button
              onClick={handleConfirmImport}
              disabled={
                isSubmitting ||
                !snapshot.session.reconciled ||
                snapshot.rows.length === 0 ||
                unresolvedConflictCount > 0
              }
            >
              {t("confirm.confirmButton")}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
