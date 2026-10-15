"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useSearchParams, useRouter } from "next/navigation";
import { resetPasswordAction, type ResetPasswordState } from "@/actions/auth-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

const initialState: ResetPasswordState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("auth.reset");
  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full bg-amber-500 font-semibold text-black transition-all hover:bg-amber-400"
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {t("submitting")}
        </>
      ) : (
        t("submit")
      )}
    </Button>
  );
}

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const router = useRouter();
  const [state, action] = useActionState(resetPasswordAction, initialState);
  const t = useTranslations("auth");

  useEffect(() => {
    if (state.success) {
      toast.success(t("login.resetSuccess"));
      router.push("/login");
    }
  }, [state.success, router, t]);

  // No token - show error state
  if (!token) {
    return (
      <div className="w-full max-w-sm">
        {/* Logo above card */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <Image
            src="/logo.svg"
            alt="Cashlytics"
            width={140}
            height={35}
            className="h-8 w-auto dark:brightness-0 dark:invert"
            priority
          />
        </div>

        {/* Glass card with error */}
        <div className="glass-elevated rounded-2xl p-8">
          <h1
            className="mb-1 text-2xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-syne)" }}
          >
            {t("reset.invalidTitle")}
          </h1>
          <p className="text-muted-foreground mb-6 text-sm">{t("reset.invalidDescription")}</p>
          <Link
            href="/forgot-password"
            className="text-amber-500 underline-offset-4 transition-colors hover:text-amber-400 hover:underline"
          >
            {t("reset.requestNew")}
          </Link>
        </div>
      </div>
    );
  }

  // Token exists - show form
  return (
    <div className="w-full max-w-sm">
      {/* Logo above card */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <Image
          src="/logo.svg"
          alt="Cashlytics"
          width={140}
          height={35}
          className="h-8 w-auto dark:brightness-0 dark:invert"
          priority
        />
      </div>

      {/* Glass card */}
      <div className="glass-elevated rounded-2xl p-8">
        <h1
          className="mb-1 text-2xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-syne)" }}
        >
          {t("reset.title")}
        </h1>
        <p className="text-muted-foreground/70 mb-6 text-sm">{t("reset.subtitle")}</p>

        {/* Global error with forgot-password link */}
        {state.error && (
          <div className="bg-destructive/10 border-destructive/20 mb-4 rounded-lg border px-4 py-3">
            <p className="text-destructive text-sm">{state.error}</p>
            <Link
              href="/forgot-password"
              className="text-destructive/80 hover:text-destructive mt-2 block text-sm underline"
            >
              {t("reset.requestNew")}
            </Link>
          </div>
        )}

        <form action={action} className="space-y-4">
          {/* Hidden token field */}
          <input type="hidden" name="token" value={token} />

          <div className="space-y-1.5">
            <Label htmlFor="password">{t("newPassword")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
            />
            <p className="text-muted-foreground text-xs">{t("passwordHint")}</p>
            {state.fieldErrors?.password && (
              <p className="text-destructive text-xs">{state.fieldErrors.password}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
            />
            {state.fieldErrors?.confirmPassword && (
              <p className="text-destructive text-xs">{state.fieldErrors.confirmPassword}</p>
            )}
          </div>

          <div className="pt-1">
            <SubmitButton />
          </div>
        </form>
      </div>
    </div>
  );
}
