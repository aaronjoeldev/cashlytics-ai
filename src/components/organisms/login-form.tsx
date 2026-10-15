"use client";

import { useEffect, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { loginAction, type AuthActionState } from "@/actions/auth-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";

const initialState: AuthActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("auth.login");
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

export function LoginForm() {
  const [state, action] = useActionState(loginAction, initialState);
  const t = useTranslations("auth");
  const searchParams = useSearchParams();
  const resetSuccess = searchParams.get("reset") === "success";
  const prefilledEmail = searchParams.get("email") || "";

  useEffect(() => {
    if (resetSuccess) {
      toast.success(t("login.resetSuccess"));
    }
  }, [resetSuccess, t]);

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
          {t("login.title")}
        </h1>
        <p className="text-muted-foreground/70 mb-6 text-sm">{t("login.subtitle")}</p>

        {/* Global error */}
        {state.error && (
          <div className="bg-destructive/10 border-destructive/20 mb-4 rounded-lg border px-4 py-3">
            <p className="text-destructive text-sm">{state.error}</p>
          </div>
        )}

        <form action={action} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder={t("emailPlaceholder")}
              defaultValue={prefilledEmail}
            />
            {state.fieldErrors?.email && (
              <p className="text-destructive text-xs">{state.fieldErrors.email}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">{t("password")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
            />
            {state.fieldErrors?.password && (
              <p className="text-destructive text-xs">{state.fieldErrors.password}</p>
            )}
          </div>

          <div className="pt-1">
            <SubmitButton />
          </div>
        </form>

        <div className="flex justify-end pt-2">
          <Link
            href="/forgot-password"
            className="text-muted-foreground text-xs underline-offset-4 transition-colors hover:text-amber-500 hover:underline"
          >
            {t("login.forgotPassword")}
          </Link>
        </div>
      </div>

      {/* Register link */}
      <p className="text-muted-foreground mt-4 text-center text-sm">
        {t("login.noAccount")}{" "}
        <Link
          href="/register"
          className="text-amber-500 underline-offset-4 transition-colors hover:text-amber-400 hover:underline"
        >
          {t("login.register")}
        </Link>
      </p>
    </div>
  );
}
