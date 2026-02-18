'use client';

import { ThemeProvider } from './theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { SettingsProvider } from '@/lib/settings-context';
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import { type Locale } from '@/i18n/config';
import { type Currency } from '@/lib/currency';

interface ProvidersProps {
  children: React.ReactNode;
  locale: Locale;
  messages: AbstractIntlMessages;
  timeZone?: string;
  initialCurrency?: Currency;
}

export function Providers({ children, locale, messages, timeZone, initialCurrency }: ProvidersProps) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone={timeZone}>
      <SettingsProvider initialLocale={locale} initialCurrency={initialCurrency}>
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
  );
}
