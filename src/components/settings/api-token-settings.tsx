"use client";

import { useEffect, useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Check, Copy, KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  createApiToken,
  deleteApiToken,
  getApiTokens,
  type ApiTokenSummary,
} from "@/actions/api-token-actions";

const EXPIRY_OPTIONS = ["30", "90", "365", "never"] as const;
type ExpiryOption = (typeof EXPIRY_OPTIONS)[number];

export function ApiTokenSettings() {
  const t = useTranslations("settings.apiTokens");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const [tokens, setTokens] = useState<ApiTokenSummary[] | null>(null);
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState<ExpiryOption>("never");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ApiTokenSummary | null>(null);
  const [pending, startTransition] = useTransition();
  // Read once per mount; expiry is shown with day precision
  const [now] = useState(() => Date.now());

  useEffect(() => {
    getApiTokens().then((result) => {
      if (result.success) setTokens(result.data);
      else toast.error(result.error);
    });
  }, []);

  function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createApiToken({
        name,
        expiresInDays: expiry === "never" ? null : Number(expiry),
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setTokens((current) => [result.data.summary, ...(current ?? [])]);
      setCreatedToken(result.data.token);
      setCopied(false);
      setName("");
      toast.success(t("toasts.created"));
    });
  }

  function handleDelete() {
    const target = deleteTarget;
    if (!target) return;
    setDeleteTarget(null);
    startTransition(async () => {
      const result = await deleteApiToken(target.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setTokens((current) => (current ?? []).filter((token) => token.id !== target.id));
      toast.success(t("toasts.deleted"));
    });
  }

  async function handleCopy() {
    if (!createdToken) return;
    try {
      await navigator.clipboard.writeText(createdToken);
      setCopied(true);
    } catch {
      toast.error(t("toasts.copyFailed"));
    }
  }

  const formatDate = (date: Date) => format.dateTime(new Date(date), { dateStyle: "medium" });
  const isExpired = (token: ApiTokenSummary) =>
    token.expiresAt !== null && new Date(token.expiresAt).getTime() <= now;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="from-primary/20 to-primary/5 flex size-8 items-center justify-center rounded-xl bg-gradient-to-br">
            <KeyRound className="text-primary h-4 w-4" />
          </span>
          {t("title")}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm leading-relaxed">{t("description")}</p>

        <form onSubmit={handleCreate} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="grid flex-1 gap-2">
            <Label htmlFor="api-token-name">{t("nameLabel")}</Label>
            <Input
              id="api-token-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("namePlaceholder")}
              maxLength={100}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="api-token-expiry">{t("expiryLabel")}</Label>
            <Select value={expiry} onValueChange={(value) => setExpiry(value as ExpiryOption)}>
              <SelectTrigger id="api-token-expiry" className="w-full sm:w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPIRY_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(`expiry.${option}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={pending || name.trim() === ""}>
            {t("create")}
          </Button>
        </form>

        {createdToken && (
          <div className="border-primary/30 bg-primary/5 space-y-2 rounded-xl border px-4 py-3">
            <p className="text-sm font-medium">{t("createdTitle")}</p>
            <p className="text-muted-foreground text-xs leading-relaxed">{t("createdHint")}</p>
            <div className="flex items-center gap-2">
              <code className="bg-background flex-1 overflow-x-auto rounded-lg px-3 py-2 font-mono text-xs break-all">
                {createdToken}
              </code>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopy}
                aria-label={t("copy")}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        {tokens === null ? null : tokens.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("empty")}</p>
        ) : (
          <ul className="space-y-2">
            {tokens.map((token) => (
              <li
                key={token.id}
                className="border-border/60 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 dark:border-white/[0.06]"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate text-sm font-medium">
                    {token.name}{" "}
                    <span className="text-muted-foreground font-mono text-xs">
                      {token.tokenPrefix}…
                    </span>
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {t("createdAt", { date: formatDate(token.createdAt) })}
                    {" · "}
                    {token.lastUsedAt
                      ? t("lastUsedAt", { date: formatDate(token.lastUsedAt) })
                      : t("neverUsed")}
                    {" · "}
                    {token.expiresAt ? (
                      <span className={isExpired(token) ? "text-destructive" : undefined}>
                        {t(isExpired(token) ? "expiredAt" : "expiresAt", {
                          date: formatDate(token.expiresAt),
                        })}
                      </span>
                    ) : (
                      t("noExpiry")
                    )}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteTarget(token)}
                  disabled={pending}
                  aria-label={t("delete")}
                >
                  <Trash2 className="text-destructive h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirmDesc", { name: deleteTarget?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
