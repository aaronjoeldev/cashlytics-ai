"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Coins, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
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

const QUICK_CURRENCIES: Currency[] = ["USD", "GBP", "CHF", "JPY", "CAD", "AUD", "SEK", "PLN"];

export default function ToolsPage() {
  const t = useTranslations("tools");
  const tCurrency = useTranslations("currency");
  const { locale, currency: baseCurrency } = useSettings();

  const [amount, setAmount] = useState("100");
  const [sourceCurrency, setSourceCurrency] = useState<Currency>(baseCurrency);
  const [targetCurrency, setTargetCurrency] = useState<Currency>("USD");
  const [rates, setRates] = useState<RatesResponse>(fallbackRates);
  const [isLoading, setIsLoading] = useState(true);
  const [sourceSynced, setSourceSynced] = useState(false);

  // One-time sync: once DB settings load and override cookie value, align sourceCurrency
  useEffect(() => {
    if (!sourceSynced) {
      setSourceCurrency(baseCurrency);
      setSourceSynced(true);
    }
  }, [baseCurrency, sourceSynced]);

  useEffect(() => {
    let isMounted = true;

    async function loadRates() {
      try {
        const response = await fetch("/api/exchange-rates", { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to fetch rates");

        const data = (await response.json()) as RatesResponse;
        if (!isMounted) return;

        setRates({ ...fallbackRates, ...data, EUR: 1 });
      } catch {
        if (!isMounted) return;
        setRates(fallbackRates);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadRates();

    return () => {
      isMounted = false;
    };
  }, []);

  function handleSourceChange(value: Currency) {
    setSourceCurrency(value);
    if (value === targetCurrency) setTargetCurrency(sourceCurrency);
  }

  function handleTargetChange(value: Currency) {
    setTargetCurrency(value);
    if (value === sourceCurrency) setSourceCurrency(targetCurrency);
  }

  function handleSwap() {
    setSourceCurrency(targetCurrency);
    setTargetCurrency(sourceCurrency);
  }

  const parsedAmount = Number.parseFloat(amount.replace(",", "."));
  const safeAmount = Number.isFinite(parsedAmount) ? parsedAmount : 0;
  const sourceRate = rates[sourceCurrency] ?? fallbackRates[sourceCurrency] ?? 1;
  const targetRate = rates[targetCurrency] ?? fallbackRates[targetCurrency] ?? 1;
  const exchangeRate = targetRate / sourceRate;
  const convertedAmount = safeAmount * exchangeRate;

  const numberLocale = locale === "de" ? "de-DE" : "en-US";

  const sourceFormatted = useMemo(
    () =>
      new Intl.NumberFormat(numberLocale, {
        style: "currency",
        currency: sourceCurrency,
      }).format(safeAmount),
    [numberLocale, safeAmount, sourceCurrency]
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

  const isQuickTargetCurrency = QUICK_CURRENCIES.includes(targetCurrency);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="from-foreground to-foreground/60 bg-gradient-to-br bg-clip-text text-[2rem] leading-none font-bold tracking-[-0.03em] text-transparent">
          {t("title")}
        </h2>
        <p className="text-muted-foreground/60 mt-1.5 text-sm">{t("description")}</p>
      </div>

      <Card id="currency-converter">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-500" />
            {t("converter.title")}
          </CardTitle>
          <CardDescription>{t("converter.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
            <div className="grid gap-2">
              <Label htmlFor="amount">{t("converter.amountLabel")}</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="100"
              />
              <Select
                value={sourceCurrency}
                onValueChange={(value) => handleSourceChange(value as Currency)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {popularConverterCurrencies.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {currency} · {tCurrency(currency)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-center self-center">
              <button
                type="button"
                onClick={handleSwap}
                className="text-muted-foreground hover:text-foreground rounded-xl p-2 transition-colors hover:bg-white/[0.06]"
                aria-label={t("converter.swap")}
              >
                <ArrowRightLeft className="h-4 w-4" />
              </button>
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
                      onClick={() => handleTargetChange(currency)}
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
                onValueChange={(value) => handleTargetChange(value as Currency)}
              >
                <SelectTrigger id="target-currency-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {popularConverterCurrencies.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {currency} · {tCurrency(currency)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!isQuickTargetCurrency ? (
                <p className="text-muted-foreground text-xs">{t("converter.fullListHint")}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-muted-foreground text-xs tracking-[0.18em] uppercase">
                {t("converter.baseCurrency")}
              </p>
              <p className="mt-2 text-3xl font-semibold">{sourceFormatted}</p>
              <p className="text-muted-foreground mt-2 text-sm">{tCurrency(sourceCurrency)}</p>
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
                  source: sourceCurrency,
                  target: targetCurrency,
                  rate: rateFormatted,
                })}
              </p>
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
