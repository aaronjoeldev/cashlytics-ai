'use client';

import { Check, X, AlertTriangle, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ToolConfirmationCardProps {
  toolName: string;
  args: Record<string, unknown>;
  approvalId: string;
  onApprove?: (approvalId: string) => void;
  onDeny?: (approvalId: string) => void;
}

type OperationKind = 'create' | 'update' | 'delete';

interface OperationInfo {
  title: string;
  details: { label: string; value: string }[];
  kind: OperationKind;
}

const RECURRENCE_LABELS: Record<string, string> = {
  once: 'Einmalig',
  daily: 'Täglich',
  weekly: 'Wöchentlich',
  monthly: 'Monatlich',
  quarterly: 'Quartalsweise',
  yearly: 'Jährlich',
  custom: 'Benutzerdefiniert',
};

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: 'Girokonto',
  savings: 'Sparkonto',
  etf: 'ETF-Portfolio',
};

function formatAmount(amount: unknown): string {
  if (amount == null) return '–';
  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
  return isNaN(num) ? String(amount) : `${num.toFixed(2)} €`;
}

function formatDate(dateStr: unknown): string {
  if (!dateStr || typeof dateStr !== 'string') return '–';
  try {
    return new Date(dateStr).toLocaleDateString('de-DE');
  } catch {
    return dateStr;
  }
}

function getOperationInfo(toolName: string, args: Record<string, unknown>): OperationInfo {
  switch (toolName) {
    case 'createAccount':
      return {
        title: 'Neues Konto erstellen',
        kind: 'create',
        details: [
          { label: 'Name', value: String(args.name ?? '–') },
          { label: 'Typ', value: ACCOUNT_TYPE_LABELS[String(args.type)] ?? String(args.type ?? '–') },
          { label: 'Startguthaben', value: formatAmount(args.balance ?? 0) },
          { label: 'Währung', value: String(args.currency ?? 'EUR') },
        ],
      };

    case 'updateAccount':
      return {
        title: 'Konto aktualisieren',
        kind: 'update',
        details: [
          ...(args.name != null ? [{ label: 'Neuer Name', value: String(args.name) }] : []),
          ...(args.type != null ? [{ label: 'Neuer Typ', value: ACCOUNT_TYPE_LABELS[String(args.type)] ?? String(args.type) }] : []),
          ...(args.balance != null ? [{ label: 'Neuer Kontostand', value: formatAmount(args.balance) }] : []),
        ],
      };

    case 'deleteAccount':
      return {
        title: 'Konto löschen',
        kind: 'delete',
        details: [
          { label: 'Achtung', value: 'Alle zugehörigen Transaktionen werden ebenfalls gelöscht.' },
        ],
      };

    case 'createExpense':
      return {
        title: 'Wiederkehrende Ausgabe erstellen',
        kind: 'create',
        details: [
          { label: 'Name', value: String(args.name ?? '–') },
          { label: 'Betrag', value: formatAmount(args.amount) },
          { label: 'Turnus', value: RECURRENCE_LABELS[String(args.recurrenceType)] ?? String(args.recurrenceType ?? '–') },
          { label: 'Ab', value: formatDate(args.startDate) },
          ...(args.endDate ? [{ label: 'Bis', value: formatDate(args.endDate) }] : []),
        ],
      };

    case 'updateExpense':
      return {
        title: 'Ausgabe aktualisieren',
        kind: 'update',
        details: [
          ...(args.name != null ? [{ label: 'Neuer Name', value: String(args.name) }] : []),
          ...(args.amount != null ? [{ label: 'Neuer Betrag', value: formatAmount(args.amount) }] : []),
          ...(args.recurrenceType != null ? [{ label: 'Neuer Turnus', value: RECURRENCE_LABELS[String(args.recurrenceType)] ?? String(args.recurrenceType) }] : []),
          ...(args.endDate != null ? [{ label: 'Neues Enddatum', value: formatDate(args.endDate) }] : []),
        ],
      };

    case 'deleteExpense':
      return {
        title: 'Wiederkehrende Ausgabe löschen',
        kind: 'delete',
        details: [
          { label: 'Achtung', value: 'Diese Ausgabe wird dauerhaft entfernt.' },
        ],
      };

    case 'createDailyExpense':
      return {
        title: 'Ausgabe erfassen',
        kind: 'create',
        details: [
          { label: 'Beschreibung', value: String(args.description ?? '–') },
          { label: 'Betrag', value: formatAmount(args.amount) },
          { label: 'Datum', value: formatDate(args.date) },
        ],
      };

    case 'deleteDailyExpense':
      return {
        title: 'Ausgabe löschen',
        kind: 'delete',
        details: [
          { label: 'Achtung', value: 'Diese Ausgabe wird dauerhaft gelöscht.' },
        ],
      };

    case 'createIncome':
      return {
        title: 'Einnahme erfassen',
        kind: 'create',
        details: [
          { label: 'Quelle', value: String(args.source ?? '–') },
          { label: 'Betrag', value: formatAmount(args.amount) },
          { label: 'Turnus', value: RECURRENCE_LABELS[String(args.recurrenceType)] ?? String(args.recurrenceType ?? '–') },
          { label: 'Ab', value: formatDate(args.startDate) },
        ],
      };

    case 'updateIncome':
      return {
        title: 'Einnahme aktualisieren',
        kind: 'update',
        details: [
          ...(args.source != null ? [{ label: 'Neue Quelle', value: String(args.source) }] : []),
          ...(args.amount != null ? [{ label: 'Neuer Betrag', value: formatAmount(args.amount) }] : []),
          ...(args.recurrenceType != null ? [{ label: 'Neuer Turnus', value: RECURRENCE_LABELS[String(args.recurrenceType)] ?? String(args.recurrenceType) }] : []),
        ],
      };

    case 'deleteIncome':
      return {
        title: 'Einnahme löschen',
        kind: 'delete',
        details: [
          { label: 'Achtung', value: 'Diese Einnahme wird dauerhaft entfernt.' },
        ],
      };

    case 'createCategory':
      return {
        title: 'Kategorie erstellen',
        kind: 'create',
        details: [
          { label: 'Name', value: String(args.name ?? '–') },
          ...(args.icon ? [{ label: 'Icon', value: String(args.icon) }] : []),
          ...(args.color ? [{ label: 'Farbe', value: String(args.color) }] : []),
        ],
      };

    default:
      return {
        title: toolName,
        kind: 'create',
        details: Object.entries(args).map(([k, v]) => ({ label: k, value: String(v ?? '–') })),
      };
  }
}

const KIND_ICON = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
};

const KIND_ICON_STYLE = {
  create: 'bg-emerald-500/10 text-emerald-500',
  update: 'bg-amber-500/10 text-amber-500',
  delete: 'bg-red-500/10 text-red-500',
};

export function ToolConfirmationCard({
  toolName,
  args,
  approvalId,
  onApprove,
  onDeny,
}: ToolConfirmationCardProps) {
  const { title, details, kind } = getOperationInfo(toolName, args);
  const Icon = KIND_ICON[kind];
  const isDelete = kind === 'delete';

  return (
    <Card className="border border-border/60 shadow-md overflow-hidden">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center gap-3">
          <div className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg', KIND_ICON_STYLE[kind])}>
            <Icon className="h-4 w-4" />
          </div>
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        </div>
      </CardHeader>

      {details.length > 0 && (
        <CardContent className="px-4 pb-3">
          {isDelete && (
            <div className="mb-3 flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
              <p className="text-xs text-red-600 dark:text-red-400">{details[0]?.value}</p>
            </div>
          )}
          {(!isDelete || details.length > 1) && (
            <dl className="space-y-1.5">
              {(isDelete ? details.slice(1) : details).map(({ label, value }) => (
                <div key={label} className="flex items-baseline gap-2">
                  <dt className="min-w-[90px] flex-shrink-0 text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-xs font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      )}

      <CardFooter className="flex justify-end gap-2 border-t border-border/40 px-4 py-3">
        <Button
          variant="outline"
          size="sm"
          disabled={!onDeny}
          onClick={() => onDeny?.(approvalId)}
        >
          <X className="h-3.5 w-3.5" />
          Ablehnen
        </Button>
        <Button
          variant={isDelete ? 'destructive' : 'default'}
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
