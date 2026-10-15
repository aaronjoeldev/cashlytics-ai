"use client";

import { useEffect, useState } from "react";
import { Check, X, AlertTriangle, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useSettings } from "@/lib/settings-context";
import { MUTATING_TOOL_TITLES } from "@/lib/ai/tool-labels";
import { getToolPreview, type ToolPreview } from "@/actions/tool-preview-actions";

interface ToolConfirmationCardProps {
  toolName: string;
  args: Record<string, unknown>;
  approvalId: string;
  onApprove?: (approvalId: string) => void;
  onDeny?: (approvalId: string) => void;
}

type OperationKind = "create" | "update" | "delete";

interface OperationInfo {
  title: string;
  /** Shown in the red box on delete cards */
  warning?: string;
  details: { label: string; value: string }[];
  kind: OperationKind;
}

type FormatAmount = (amount: number | string, currency?: string | null) => string;

const RECURRENCE_LABELS: Record<string, string> = {
  once: "Einmalig",
  daily: "Täglich",
  weekly: "Wöchentlich",
  monthly: "Monatlich",
  quarterly: "Quartalsweise",
  semiannual: "Halbjährlich",
  yearly: "Jährlich",
  custom: "Benutzerdefiniert",
};

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: "Girokonto",
  savings: "Sparkonto",
  etf: "ETF-Portfolio",
};

const EMPTY_PREVIEW: ToolPreview = { accounts: {}, categories: {} };

function formatDate(value: unknown): string {
  if (!value || typeof value !== "string") return "–";
  const date = new Date(value);
  // Dates are calendar days; format in UTC so the day does not shift
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("de-DE", { timeZone: "UTC" });
}

function label(map: Record<string, string>, value: unknown): string {
  return value == null ? "–" : (map[String(value)] ?? String(value));
}

function text(value: unknown): string {
  return value == null || value === "" ? "–" : String(value);
}

function getOperationInfo(
  toolName: string,
  args: Record<string, unknown>,
  preview: ToolPreview,
  formatAmount: FormatAmount
): OperationInfo {
  const title = MUTATING_TOOL_TITLES[toolName] ?? toolName;
  const record = preview.record;
  const accountOf = (key: string) =>
    typeof args[key] === "string" ? preview.accounts[args[key] as string] : undefined;
  const accountName = (key: string) => accountOf(key)?.name ?? "–";
  const categoryName = (value: unknown) =>
    value == null ? "Keine" : (preview.categories[String(value)] ?? "–");
  // Amounts of new entries are in the given currency, otherwise in the account's currency
  const newAmount = (amount: unknown, accountKey = "accountId") =>
    amount == null
      ? "–"
      : formatAmount(
          amount as number | string,
          (args.currency as string | undefined) ?? accountOf(accountKey)?.currency
        );
  const recordAmount = (amount: unknown) =>
    amount == null ? "–" : formatAmount(amount as number | string, record?.currency);

  // "old → new" for the fields an update sets
  const change = (fieldLabel: string, before: string, after: string) => ({
    label: fieldLabel,
    value: record ? `${before} → ${after}` : after,
  });
  const target = record
    ? [{ label: "Eintrag", value: record.name }]
    : record === null
      ? [{ label: "Eintrag", value: "Nicht gefunden" }]
      : [];
  const deleteDetails = (warning: string): OperationInfo => ({
    title,
    kind: "delete",
    warning,
    details: [
      ...target,
      ...(record?.amount != null ? [{ label: "Betrag", value: recordAmount(record.amount) }] : []),
      ...(record?.date ? [{ label: "Datum", value: formatDate(record.date) }] : []),
      ...(record?.recurrenceType
        ? [{ label: "Turnus", value: label(RECURRENCE_LABELS, record.recurrenceType) }]
        : []),
    ],
  });

  switch (toolName) {
    case "createAccount":
      return {
        title,
        kind: "create",
        details: [
          { label: "Name", value: text(args.name) },
          { label: "Typ", value: label(ACCOUNT_TYPE_LABELS, args.type) },
          {
            label: "Kontostand",
            value: formatAmount((args.balance as string) ?? 0, (args.currency as string) ?? null),
          },
          { label: "Währung", value: text(args.currency ?? "Standard") },
        ],
      };

    case "updateAccount":
      return {
        title,
        kind: "update",
        details: [
          ...target,
          ...(args.name != null ? [change("Name", text(record?.name), text(args.name))] : []),
          ...(args.type != null
            ? [
                change(
                  "Typ",
                  label(ACCOUNT_TYPE_LABELS, record?.type),
                  label(ACCOUNT_TYPE_LABELS, args.type)
                ),
              ]
            : []),
          ...(args.balance != null
            ? [
                change(
                  "Kontostand",
                  recordAmount(record?.amount),
                  formatAmount(args.balance as string, record?.currency)
                ),
              ]
            : []),
        ],
      };

    case "deleteAccount":
      return deleteDetails("Alle Buchungen dieses Kontos werden ebenfalls gelöscht.");

    case "createExpense":
      return {
        title,
        kind: "create",
        details: [
          { label: "Name", value: text(args.name) },
          { label: "Betrag", value: newAmount(args.amount) },
          { label: "Turnus", value: label(RECURRENCE_LABELS, args.recurrenceType) },
          { label: "Konto", value: accountName("accountId") },
          { label: "Kategorie", value: categoryName(args.categoryId) },
          { label: "Ab", value: formatDate(args.startDate) },
          ...(args.endDate ? [{ label: "Bis", value: formatDate(args.endDate) }] : []),
        ],
      };

    case "updateExpense":
      return {
        title,
        kind: "update",
        details: [
          ...target,
          ...(args.name != null ? [change("Name", text(record?.name), text(args.name))] : []),
          ...(args.amount != null
            ? [
                change(
                  "Betrag",
                  recordAmount(record?.amount),
                  formatAmount(args.amount as number, record?.currency)
                ),
              ]
            : []),
          ...(args.recurrenceType != null
            ? [
                change(
                  "Turnus",
                  label(RECURRENCE_LABELS, record?.recurrenceType),
                  label(RECURRENCE_LABELS, args.recurrenceType)
                ),
              ]
            : []),
          ...(args.endDate !== undefined
            ? [
                change(
                  "Enddatum",
                  record?.endDate ? formatDate(record.endDate) : "Keins",
                  args.endDate ? formatDate(args.endDate) : "Keins"
                ),
              ]
            : []),
        ],
      };

    case "deleteExpense":
      return deleteDetails("Diese wiederkehrende Ausgabe wird dauerhaft entfernt.");

    case "createDailyExpense":
      return {
        title,
        kind: "create",
        details: [
          { label: "Beschreibung", value: text(args.description) },
          { label: "Betrag", value: newAmount(args.amount) },
          { label: "Datum", value: formatDate(args.date) },
          { label: "Konto", value: accountName("accountId") },
          { label: "Kategorie", value: categoryName(args.categoryId) },
        ],
      };

    case "updateDailyExpense":
      return {
        title,
        kind: "update",
        details: [
          ...target,
          ...(args.description != null
            ? [change("Beschreibung", text(record?.name), text(args.description))]
            : []),
          ...(args.amount != null
            ? [
                change(
                  "Betrag",
                  recordAmount(record?.amount),
                  formatAmount(args.amount as number, record?.currency)
                ),
              ]
            : []),
          ...(args.date != null
            ? [change("Datum", formatDate(record?.date), formatDate(args.date))]
            : []),
          ...(args.categoryId !== undefined
            ? [change("Kategorie", record?.categoryName ?? "Keine", categoryName(args.categoryId))]
            : []),
        ],
      };

    case "deleteDailyExpense":
      return deleteDetails("Diese Ausgabe wird dauerhaft gelöscht.");

    case "createIncome":
      return {
        title,
        kind: "create",
        details: [
          { label: "Quelle", value: text(args.source) },
          { label: "Betrag", value: newAmount(args.amount) },
          { label: "Turnus", value: label(RECURRENCE_LABELS, args.recurrenceType) },
          { label: "Konto", value: accountName("accountId") },
          { label: "Ab", value: formatDate(args.startDate) },
        ],
      };

    case "updateIncome":
      return {
        title,
        kind: "update",
        details: [
          ...target,
          ...(args.source != null ? [change("Quelle", text(record?.name), text(args.source))] : []),
          ...(args.amount != null
            ? [
                change(
                  "Betrag",
                  recordAmount(record?.amount),
                  formatAmount(args.amount as number, record?.currency)
                ),
              ]
            : []),
          ...(args.recurrenceType != null
            ? [
                change(
                  "Turnus",
                  label(RECURRENCE_LABELS, record?.recurrenceType),
                  label(RECURRENCE_LABELS, args.recurrenceType)
                ),
              ]
            : []),
        ],
      };

    case "deleteIncome":
      return deleteDetails("Diese Einnahme wird dauerhaft entfernt.");

    case "createCategory":
      return {
        title,
        kind: "create",
        details: [
          { label: "Name", value: text(args.name) },
          ...(args.icon ? [{ label: "Icon", value: String(args.icon) }] : []),
          ...(args.color ? [{ label: "Farbe", value: String(args.color) }] : []),
        ],
      };

    case "createTransfer":
      return {
        title,
        kind: "create",
        details: [
          { label: "Von", value: accountName("sourceAccountId") },
          { label: "An", value: accountName("targetAccountId") },
          { label: "Betrag", value: newAmount(args.amount, "sourceAccountId") },
          { label: "Turnus", value: label(RECURRENCE_LABELS, args.recurrenceType) },
          { label: "Ab", value: formatDate(args.startDate) },
          ...(args.endDate ? [{ label: "Bis", value: formatDate(args.endDate) }] : []),
          ...(args.description ? [{ label: "Beschreibung", value: String(args.description) }] : []),
        ],
      };

    case "markInsightRead":
      return { title, kind: "update", details: [...target] };

    default:
      return {
        title,
        kind: "create",
        details: Object.entries(args).map(([key, value]) => ({ label: key, value: text(value) })),
      };
  }
}

const KIND_ICON = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
};

const KIND_ICON_STYLE = {
  create: "bg-emerald-500/10 text-emerald-500",
  update: "bg-amber-500/10 text-amber-500",
  delete: "bg-red-500/10 text-red-500",
};

export function ToolConfirmationCard({
  toolName,
  args,
  approvalId,
  onApprove,
  onDeny,
}: ToolConfirmationCardProps) {
  const { formatAmount } = useSettings();
  const [preview, setPreview] = useState<ToolPreview>(EMPTY_PREVIEW);
  const argsKey = JSON.stringify(args);

  useEffect(() => {
    let cancelled = false;
    // Without the preview the card still shows the values from the tool input
    getToolPreview(toolName, JSON.parse(argsKey) as Record<string, unknown>)
      .then((result) => {
        if (!cancelled && result.success) setPreview(result.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [toolName, argsKey]);

  const { title, warning, details, kind } = getOperationInfo(toolName, args, preview, formatAmount);
  const Icon = KIND_ICON[kind];
  const isDelete = kind === "delete";

  return (
    <Card className="border-border/60 overflow-hidden border shadow-md">
      <CardHeader className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
              KIND_ICON_STYLE[kind]
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        </div>
      </CardHeader>

      {(warning || details.length > 0) && (
        <CardContent className="px-4 pb-3">
          {warning && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
              <p className="text-xs text-red-600 dark:text-red-400">{warning}</p>
            </div>
          )}
          {details.length > 0 && (
            <dl className="space-y-1.5">
              {details.map(({ label: detailLabel, value }) => (
                <div key={detailLabel} className="flex items-baseline gap-2">
                  <dt className="text-muted-foreground min-w-[90px] flex-shrink-0 text-xs">
                    {detailLabel}
                  </dt>
                  <dd className="text-xs font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      )}

      <CardFooter className="border-border/40 flex justify-end gap-2 border-t px-4 py-3">
        <Button variant="outline" size="sm" disabled={!onDeny} onClick={() => onDeny?.(approvalId)}>
          <X className="h-3.5 w-3.5" />
          Ablehnen
        </Button>
        <Button
          variant={isDelete ? "destructive" : "default"}
          size="sm"
          disabled={!onApprove}
          onClick={() => onApprove?.(approvalId)}
        >
          <Check className="h-3.5 w-3.5" />
          Annehmen
        </Button>
      </CardFooter>
    </Card>
  );
}
