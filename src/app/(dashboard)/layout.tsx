import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { Toaster } from "@/components/ui/toaster";
import { FloatingActions } from "@/components/organisms/floating-actions";
import { isAiEnabled } from "@/lib/import/feature-gating";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { OfflineCacheOwner } from "@/components/pwa/offline-cache-owner";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // The proxy only checks that the cookie decodes; the server may have ended the session
  const session = await auth();
  if (!session?.user?.id) redirect("/session-expired");

  const aiEnabled = isAiEnabled();

  return (
    <SidebarProvider>
      <AppSidebar aiEnabled={aiEnabled} />
      <SidebarInset>
        <Header />
        <main className="relative flex-1 overflow-auto">
          {/* Ambient background layer */}
          <div className="pointer-events-none fixed inset-0 -z-20">
            {/* Light mode: warm parchment with subtle grid */}
            <div className="vault-grid absolute inset-0 bg-[#f9f7f4] opacity-100 dark:bg-[#08080a]" />
          </div>

          {/* Dark mode organic blobs */}
          <div className="pointer-events-none fixed inset-0 -z-10 hidden overflow-hidden dark:block">
            {/* Primary amber glow — top left */}
            <div
              className="blob-primary absolute"
              style={{
                top: "-15%",
                left: "-10%",
                width: "55%",
                height: "55%",
              }}
            />
            {/* Secondary glow — middle right */}
            <div
              className="blob-secondary absolute"
              style={{
                top: "30%",
                right: "-15%",
                width: "40%",
                height: "40%",
              }}
            />
            {/* Tertiary warm glow — bottom center */}
            <div
              className="absolute"
              style={{
                bottom: "-10%",
                left: "30%",
                width: "35%",
                height: "35%",
                background: "radial-gradient(ellipse, rgba(180,83,9,0.04) 0%, transparent 60%)",
                filter: "blur(80px)",
              }}
            />
          </div>

          <div className="p-6">{children}</div>
        </main>
      </SidebarInset>
      <FloatingActions aiEnabled={aiEnabled} />
      <Toaster />
      <OfflineCacheOwner userId={session.user.id} />
    </SidebarProvider>
  );
}
