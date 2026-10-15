import type { Metadata, Viewport } from "next";
import { Syne, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { ServiceWorkerRegistrar } from "@/components/pwa/service-worker-registrar";
import { getLocale, getMessages, getTimeZone } from "next-intl/server";
import { getUserPreferences } from "@/lib/user-preferences";
import { type Locale } from "@/i18n/config";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export const metadata: Metadata = {
  title: "Cashlytics — Budget Planer",
  description: "Dein persönlicher KI-gestützter Budget Planer",
  applicationName: "Cashlytics",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Cashlytics",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = (await getLocale()) as Locale;
  const messages = await getMessages();
  const timeZone = await getTimeZone();
  const { currency: initialCurrency } = await getUserPreferences();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${syne.variable} ${jakartaSans.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <ServiceWorkerRegistrar />
        <Providers
          locale={locale}
          messages={messages}
          timeZone={timeZone}
          initialCurrency={initialCurrency}
        >
          {children}
        </Providers>
      </body>
    </html>
  );
}
