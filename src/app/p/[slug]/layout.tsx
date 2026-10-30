import type { Metadata } from "next";
import { getAppBranding } from "@/lib/appBranding";
import InstallAppBanner from "./components/InstallAppBanner";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

// Metadados do app instalável (manifesto, ícone do iPhone e nome na tela inicial) de cada profissional.
export async function generateMetadata({ params }: Pick<LayoutProps, "params">): Promise<Metadata> {
  const { slug } = await params;
  const branding = await getAppBranding(slug).catch(() => null);
  if (!branding) return {};
  const base = `/p/${encodeURIComponent(slug)}`;
  return {
    manifest: `${base}/manifest.webmanifest`,
    icons: { icon: `${base}/app-icon`, apple: `${base}/app-icon` },
    appleWebApp: { capable: true, title: branding.name, statusBarStyle: "default" },
  };
}

export default async function PublicProfessionalLayout({ children, params }: LayoutProps) {
  const { slug } = await params;
  const branding = await getAppBranding(slug).catch(() => null);
  return (
    <>
      {children}
      {branding && <InstallAppBanner appName={branding.name} />}
    </>
  );
}
