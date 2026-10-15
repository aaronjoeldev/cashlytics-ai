import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { OfflineCacheOwner } from "@/components/pwa/offline-cache-owner";

export const metadata: Metadata = {
  title: "Cashlytics — Auth",
};

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("auth");
  return (
    <div className="flex min-h-screen">
      <OfflineCacheOwner userId={null} />
      {/* Left panel — branding (hidden on mobile) */}
      <div className="relative hidden flex-col items-center justify-center overflow-hidden bg-[#08080a] p-12 lg:flex lg:w-[45%] xl:w-[40%]">
        {/* Vault grid overlay */}
        <div className="vault-grid pointer-events-none absolute inset-0" />

        {/* Amber ambient blobs */}
        <div
          className="pointer-events-none absolute top-[-20%] left-[-20%] h-[70%] w-[70%] rounded-full"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(245,158,11,0.12) 0%, transparent 70%)",
          }}
        />
        <div
          className="pointer-events-none absolute right-[-10%] bottom-[-10%] h-[50%] w-[50%] rounded-full"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(245,158,11,0.07) 0%, transparent 70%)",
          }}
        />

        {/* Branding content */}
        <div className="relative z-10 flex flex-col items-center gap-8 text-center">
          <Image
            src="/logo.svg"
            alt="Cashlytics"
            width={160}
            height={40}
            className="h-9 w-auto brightness-0 invert"
            priority
          />
          <div className="max-w-xs space-y-3">
            <p
              className="text-2xl leading-snug font-bold tracking-tight text-white"
              style={{ fontFamily: "var(--font-syne)" }}
            >
              {t("taglineLine1")}
              <br />
              {t("taglineLine2")}
            </p>
            <p
              className="text-sm leading-relaxed text-white/40"
              style={{ fontFamily: "var(--font-jakarta)" }}
            >
              {t("taglineDescription")}
            </p>
          </div>

          {/* Decorative amber accent line */}
          <div className="h-px w-16 bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
        </div>
      </div>

      {/* Right panel — form area */}
      <div className="bg-background flex flex-1 items-center justify-center p-8">{children}</div>
    </div>
  );
}
