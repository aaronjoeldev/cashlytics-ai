"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { createAccount } from "@/actions/account-actions";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/lib/settings-context";
import type { Account } from "@/types/database";

interface AccountFormProps {
  onSuccess?: (data: Account) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AccountForm({ onSuccess, open: controlledOpen, onOpenChange }: AccountFormProps) {
  const t = useTranslations("accounts");
  const { toast } = useToast();
  const { currency } = useSettings();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (value: boolean) => {
    setUncontrolledOpen(value);
    onOpenChange?.(value);
  };
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"checking" | "savings" | "etf">("checking");
  const [balance, setBalance] = useState("");

  const accountTypes = [
    { value: "checking", label: t("types.checking"), icon: "🏦" },
    { value: "savings", label: t("types.savings"), icon: "piggy" },
    { value: "etf", label: t("types.etf"), icon: "📈" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({
        title: t("errorTitle"),
        description: t("errors.nameRequired"),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    const result = await createAccount({
      name: name.trim(),
      type,
      balance: balance || "0",
      currency,
    });

    setIsLoading(false);

    if (result.success) {
      toast({
        title: t("success.created"),
        description: t("createdDesc", { name }),
      });
      setName("");
      setType("checking");
      setBalance("");
      setOpen(false);
      onSuccess?.(result.data);
    } else {
      toast({
        title: t("errorTitle"),
        description: result.error || t("errors.createFailed"),
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {t("addAccount")}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("newAccount")}</DialogTitle>
            <DialogDescription>{t("newAccountDesc")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">{t("name")}</Label>
              <Input
                id="name"
                placeholder={t("namePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type">{t("type")}</Label>
              <Select
                value={type}
                onValueChange={(value) => setType(value as "checking" | "savings" | "etf")}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("typePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {accountTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.icon} {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="balance">{t("initialBalanceLabel")}</Label>
              <Input
                id="balance"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? t("creating") : t("createAccount")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
