"use client";

import { ThemeProvider } from "./theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SettingsProvider } from "@/lib/settings-context";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { type Locale } from "@/i18n/config";
import { type Currency, type ExchangeRateTable } from "@/lib/currency";
import { SessionProvider } from "next-auth/react";

interface ProvidersProps {
  children: React.ReactNode;
  locale: Locale;
  messages: AbstractIntlMessages;
  timeZone?: string;
  initialCurrency?: Currency;
  rates?: ExchangeRateTable;
}

export function Providers({
  children,
  locale,
  messages,
  timeZone,
  initialCurrency,
  rates,
}: ProvidersProps) {
  return (
    <SessionProvider>
      <NextIntlClientProvider locale={locale} messages={messages} timeZone={timeZone}>
        <SettingsProvider initialLocale={locale} initialCurrency={initialCurrency} rates={rates}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <TooltipProvider>
              {children}
              <Toaster />
            </TooltipProvider>
          </ThemeProvider>
        </SettingsProvider>
      </NextIntlClientProvider>
    </SessionProvider>
  );
}
