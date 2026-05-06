"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Coins, Loader2, Sparkles, WandSparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettings } from "@/lib/settings-context";
import {
  exchangeRates as fallbackRates,
  popularConverterCurrencies,
  type Currency,
} from "@/lib/currency";

type RatesResponse = Partial<Record<Currency, number>>;

const TARGET_CURRENCIES = popularConverterCurrencies.filter((currency) => currency !== "EUR");
const QUICK_CURRENCIES: Currency[] = ["USD", "GBP", "CHF", "JPY", "CAD", "AUD", "SEK", "PLN"];

export default function ToolsPage() {
  const t = useTranslations("tools");
  const tCurrency = useTranslations("currency");
  const { locale } = useSettings();

  const [amount, setAmount] = useState("100");
  const [targetCurrency, setTargetCurrency] = useState<Currency>("USD");
  const [rates, setRates] = useState<RatesResponse>(fallbackRates);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLiveRates, setHasLiveRates] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadRates() {
      try {
        const response = await fetch("/api/exchange-rates", { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to fetch rates");

        const data = (await response.json()) as RatesResponse;
        if (!isMounted) return;

        setRates({ ...fallbackRates, ...data, EUR: 1 });
        setHasLiveRates(true);
      } catch {
        if (!isMounted) return;
        setRates(fallbackRates);
        setHasLiveRates(false);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadRates();

    return () => {
      isMounted = false;
    };
  }, []);

  const parsedAmount = Number.parseFloat(amount.replace(",", "."));
  const safeAmount = Number.isFinite(parsedAmount) ? parsedAmount : 0;
  const exchangeRate = rates[targetCurrency] ?? fallbackRates[targetCurrency];
  const convertedAmount = safeAmount * exchangeRate;

  const numberLocale = locale === "de" ? "de-DE" : "en-US";

  const eurFormatted = useMemo(
    () =>
      new Intl.NumberFormat(numberLocale, {
        style: "currency",
        currency: "EUR",
      }).format(safeAmount),
    [numberLocale, safeAmount]
  );

  const targetFormatted = useMemo(
    () =>
      new Intl.NumberFormat(numberLocale, {
        style: "currency",
        currency: targetCurrency,
      }).format(convertedAmount),
    [convertedAmount, numberLocale, targetCurrency]
  );

  const rateFormatted = useMemo(
    () =>
      new Intl.NumberFormat(numberLocale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: exchangeRate >= 100 ? 4 : 6,
      }).format(exchangeRate),
    [exchangeRate, numberLocale]
  );

  const isQuickCurrency = QUICK_CURRENCIES.includes(targetCurrency);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="from-foreground to-foreground/60 bg-gradient-to-br bg-clip-text text-[2rem] leading-none font-bold tracking-[-0.03em] text-transparent">
          {t("title")}
        </h2>
        <p className="text-muted-foreground/60 mt-1.5 text-sm">{t("description")}</p>
      </div>

      <Card className="border-white/10 bg-gradient-to-br from-white/[0.04] via-transparent to-amber-500/[0.04]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            {t("hub.title")}
          </CardTitle>
          <CardDescription>{t("hub.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-foreground font-medium">{t("hub.converter.title")}</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {t("hub.converter.description")}
                </p>
              </div>
              <div className="rounded-xl bg-amber-500/15 p-2">
                <Coins className="h-4 w-4 text-amber-500" />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-muted-foreground text-xs tracking-[0.18em] uppercase">
                {t("hub.availableNow", { count: 1 })}
              </span>
              <Button asChild size="sm" className="rounded-xl">
                <a href="#currency-converter">{t("hub.openTool")}</a>
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 opacity-85">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-foreground font-medium">{t("hub.comingSoon.title")}</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {t("hub.comingSoon.description")}
                </p>
              </div>
              <div className="rounded-xl bg-white/[0.05] p-2">
                <WandSparkles className="text-muted-foreground h-4 w-4" />
              </div>
            </div>
            <p className="text-muted-foreground mt-4 text-xs">{t("hub.comingSoon.examples")}</p>
          </div>
        </CardContent>
      </Card>

      <Card id="currency-converter">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-500" />
            {t("converter.title")}
          </CardTitle>
          <CardDescription>{t("converter.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-end">
            <div className="grid gap-2">
              <Label htmlFor="eur-amount">{t("converter.amountLabel")}</Label>
              <Input
                id="eur-amount"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="100"
              />
            </div>

            <div className="text-muted-foreground flex h-10 items-center justify-center">
              <ArrowRightLeft className="h-4 w-4" />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="target-currency">{t("converter.targetLabel")}</Label>
              <div className="flex flex-wrap gap-2">
                {QUICK_CURRENCIES.map((currency) => {
                  const isActive = targetCurrency === currency;

                  return (
                    <button
                      key={currency}
                      type="button"
                      onClick={() => setTargetCurrency(currency)}
                      className={[
                        "rounded-xl border px-3 py-2 text-sm transition-all duration-200",
                        isActive
                          ? "text-foreground border-amber-500/40 bg-amber-500/10 shadow-[0_0_0_1px_rgba(245,158,11,0.15)]"
                          : "text-muted-foreground hover:text-foreground border-white/10 bg-white/[0.03] hover:bg-white/[0.06]",
                      ].join(" ")}
                    >
                      <span className="font-medium">{currency}</span>
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-2 pt-2">
                <Label htmlFor="target-currency-select" className="text-muted-foreground text-xs">
                  {t("converter.allCurrencies")}
                </Label>
              </div>
              <Select
                value={targetCurrency}
                onValueChange={(value) => setTargetCurrency(value as Currency)}
              >
                <SelectTrigger id="target-currency-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TARGET_CURRENCIES.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {currency} · {tCurrency(currency)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!isQuickCurrency ? (
                <p className="text-muted-foreground text-xs">{t("converter.fullListHint")}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-muted-foreground text-xs tracking-[0.18em] uppercase">
                {t("converter.baseCurrency")}
              </p>
              <p className="mt-2 text-3xl font-semibold">{eurFormatted}</p>
              <p className="text-muted-foreground mt-2 text-sm">{tCurrency("EUR")}</p>
            </div>

            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-5">
              <p className="text-muted-foreground text-xs tracking-[0.18em] uppercase">
                {t("converter.convertedAmount")}
              </p>
              <div className="mt-2 flex items-center gap-2">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-amber-500" /> : null}
                <p className="text-3xl font-semibold">{targetFormatted}</p>
              </div>
              <p className="text-muted-foreground mt-2 text-sm">
                {t("converter.rate", {
                  target: targetCurrency,
                  rate: rateFormatted,
                })}
              </p>
            </div>
          </div>

          <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span>{hasLiveRates ? t("converter.liveRates") : t("converter.fallbackRates")}</span>
            <span>•</span>
            <span>{t("converter.scope")}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
