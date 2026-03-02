"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tag, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSettings } from "@/lib/settings-context";
import { locales, localeNames, type Locale } from "@/i18n/config";
import { currencies, type Currency } from "@/lib/currency";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { BillingCard } from "@/components/settings/billing-card";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tCurrency = useTranslations("currency");
  const { locale, setLocale, currency, setCurrency } = useSettings();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="from-foreground to-foreground/60 bg-gradient-to-br bg-clip-text text-[2rem] leading-none font-bold tracking-[-0.03em] text-transparent">
          {t("title")}
        </h2>
        <p className="text-muted-foreground/60 mt-1.5 text-sm">{t("description")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("general")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-2">
            <Label htmlFor="language">{t("language")}</Label>
            <Select value={locale} onValueChange={(value) => setLocale(value as Locale)}>
              <SelectTrigger id="language" className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {locales.map((loc) => (
                  <SelectItem key={loc} value={loc}>
                    {localeNames[loc]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="currency">{t("currency")}</Label>
            <Select value={currency} onValueChange={(value) => setCurrency(value as Currency)}>
              <SelectTrigger id="currency" className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((curr) => (
                  <SelectItem key={curr} value={curr}>
                    {curr} - {tCurrency(curr)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      <BillingCard />
      <NotificationSettings />

      <Card>
        <CardHeader>
          <CardTitle>Datenverwaltung</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Link href="/categories">
            <div className="hover:bg-accent/30 flex cursor-pointer items-center justify-between rounded-xl p-3 transition-colors duration-200 dark:hover:bg-white/5">
              <div className="flex items-center gap-3">
                <div className="from-primary/20 to-primary/5 rounded-xl bg-gradient-to-br p-2">
                  <Tag className="text-primary h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium">Kategorien verwalten</p>
                  <p className="text-muted-foreground text-sm">
                    Ausgaben-Kategorien anlegen und bearbeiten
                  </p>
                </div>
              </div>
              <ChevronRight className="text-muted-foreground h-4 w-4" />
            </div>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
