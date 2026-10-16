"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setEverydayBudget } from "@/actions/salary-plan-actions";
import { useSettings } from "@/lib/settings-context";

interface EverydayBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The fixed amount, if one is set. */
  custom?: number;
  average: number;
  onSaved: () => void;
}

/** Mount it only while open, so it starts from the current values each time. */
export function EverydayBudgetDialog({
  open,
  onOpenChange,
  custom,
  average,
  onSaved,
}: EverydayBudgetDialogProps) {
  const t = useTranslations("salaryPlan");
  const { currency, formatCurrency } = useSettings();
  const [amount, setAmount] = useState((custom ?? average).toFixed(2));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (value: string | null) => {
    setSaving(true);
    const result = await setEverydayBudget({ amount: value });
    setSaving(false);
    if (result.success) onSaved();
    else setError(result.error);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save(amount);
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("editEveryday")}</DialogTitle>
            <DialogDescription>
              {t("everydayDialogDescription", { average: formatCurrency(average) })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            <Label htmlFor="everyday-budget">{t("everydayLabel", { currency })}</Label>
            <Input
              id="everyday-budget"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={saving}
            />
            {error && <p className="text-destructive text-sm">{error}</p>}
          </div>
          <DialogFooter className="gap-2">
            {custom !== undefined && (
              <Button type="button" variant="outline" disabled={saving} onClick={() => save(null)}>
                {t("useAverage")}
              </Button>
            )}
            <Button type="submit" disabled={saving}>
              {saving ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
