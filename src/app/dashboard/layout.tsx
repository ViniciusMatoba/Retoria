import type { Metadata, Viewport } from "next";
import DashboardShell from "./components/DashboardShell";
import InstallAppBanner from "../p/[slug]/components/InstallAppBanner";

// App instalável do painel do administrador (Retoria), como o app de agendamento de cada profissional.
export const metadata: Metadata = {
  manifest: "/dashboard/manifest.webmanifest",
  icons: { icon: "/dashboard/app-icon", apple: "/dashboard/app-icon" },
  appleWebApp: { capable: true, title: "Retoria", statusBarStyle: "default" },
};

// Sem zoom da página no painel: a pinça fica só na grade da agenda (Horários → Dia/Semana).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DashboardShell>{children}</DashboardShell>
      <InstallAppBanner
        appName="Retoria"
        description="Acesse sua agenda direto da tela inicial."
        dismissKey="retoria-admin-install-dismissed"
      />
    </>
  );
}
