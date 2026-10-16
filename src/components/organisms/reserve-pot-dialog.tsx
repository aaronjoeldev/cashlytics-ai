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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setReservePot } from "@/actions/reserve-actions";
import { useSettings } from "@/lib/settings-context";

interface ReservePotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Array<{ id: string; name: string }>;
  initialAccountId?: string;
  /** Current pot balance in the base currency; empty for a new pot. */
  initialBalance?: number;
  onSaved: () => void;
}

/** Mount it only while open, so it starts from the current values each time. */
export function ReservePotDialog({
  open,
  onOpenChange,
  accounts,
  initialAccountId,
  initialBalance,
  onSaved,
}: ReservePotDialogProps) {
  const t = useTranslations("reserves");
  const { currency } = useSettings();
  const [accountId, setAccountId] = useState(initialAccountId ?? "");
  const [balance, setBalance] = useState(initialBalance?.toFixed(2) ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!accountId) {
      setError(t("chooseAccount"));
      return;
    }
    setSaving(true);
    const result = await setReservePot({ accountId, balance });
    setSaving(false);
    if (result.success) onSaved();
    else setError(result.error);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{initialAccountId ? t("correctBalance") : t("setUpPot")}</DialogTitle>
            <DialogDescription>{t("dialogDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="reserve-account">{t("potAccountLabel")}</Label>
              <Select value={accountId} onValueChange={setAccountId} disabled={saving}>
                <SelectTrigger id="reserve-account">
                  <SelectValue placeholder={t("chooseAccount")} />
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
            <div className="grid gap-2">
              <Label htmlFor="reserve-balance">{t("balanceLabel", { currency })}</Label>
              <Input
                id="reserve-balance"
                type="number"
                step="0.01"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                disabled={saving}
              />
              <p className="text-muted-foreground text-xs">{t("balanceHint")}</p>
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
