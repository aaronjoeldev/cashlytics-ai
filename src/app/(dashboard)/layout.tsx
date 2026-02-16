import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { Header } from '@/components/layout/header';
import { Toaster } from '@/components/ui/toaster';
import { FloatingActions } from '@/components/organisms/floating-actions';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Header />
        <main className="relative flex-1 overflow-auto">
          {/* Ambient background layer */}
          <div className="fixed inset-0 -z-20 pointer-events-none">
            {/* Light mode: warm parchment with subtle grid */}
            <div className="absolute inset-0 bg-[#f9f7f4] dark:bg-[#08080a] vault-grid opacity-100" />
          </div>

          {/* Dark mode organic blobs */}
          <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none hidden dark:block">
            {/* Primary amber glow — top left */}
            <div
              className="absolute blob-primary"
              style={{
                top: '-15%',
                left: '-10%',
                width: '55%',
                height: '55%',
              }}
            />
            {/* Secondary glow — middle right */}
            <div
              className="absolute blob-secondary"
              style={{
                top: '30%',
                right: '-15%',
                width: '40%',
                height: '40%',
              }}
            />
            {/* Tertiary warm glow — bottom center */}
            <div
              className="absolute"
              style={{
                bottom: '-10%',
                left: '30%',
                width: '35%',
                height: '35%',
                background: 'radial-gradient(ellipse, rgba(180,83,9,0.04) 0%, transparent 60%)',
                filter: 'blur(80px)',
              }}
            />
          </div>

          <div className="p-6">
            {children}
          </div>
        </main>
      </SidebarInset>
      <FloatingActions />
      <Toaster />
    </SidebarProvider>
  );
}
