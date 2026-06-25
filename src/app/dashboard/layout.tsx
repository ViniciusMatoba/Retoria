"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../providers";
import {
  Calendar,
  Users,
  Settings,
  Briefcase,
  LogOut,
  Menu,
  X,
  ExternalLink,
  Loader2,
  AlertCircle,
  Palette,
  LayoutGrid,
  UserCog,
} from "lucide-react";
import {
  normalizeThemeConfig,
  fontCatalog,
  gradientPresets,
  bgPatterns,
  buildVersionedImageUrl,
} from "@/lib/themeUtils";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { getGoogleFontsLink } from "../p/[slug]/components/PublicThemeProvider";

function hexToRgba(hex: string, alpha: number): string {
  if (!hex) return `rgba(15, 23, 42, ${alpha})`;
  let cleanHex = hex.replace("#", "");
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split("").map(c => c + c).join("");
  }
  try {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      return `rgba(15, 23, 42, ${alpha})`;
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  } catch (e) {
    return `rgba(15, 23, 42, ${alpha})`;
  }
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, loading, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [licenseStatus, setLicenseStatus] = useState<string | null>(null);
  const [licenseEnd, setLicenseEnd] = useState<Date | null>(null);

  const themeConfig = normalizeThemeConfig({
    ...(profile?.themeConfig || {}),
    primaryColor: profile?.themeConfig?.primaryColor || profile?.corPrincipal
  });
  const fontUrl = getGoogleFontsLink(themeConfig.headingFont, themeConfig.bodyFont);

  // Auth Guard — must be logged in AND have a valid active professional document
  useEffect(() => {
    if (loading) return;
    if (!user) { router.push("/login"); return; }
    if (!profile) { router.push("/portal"); return; }

    const status = profile.professionalStatus;

    // Onboarding incompleto → redireciona para concluir cadastro
    if (status === "onboarding") {
      router.push("/professional/onboarding");
      return;
    }

    // Suspenso ou cancelado → portal (sem acesso ao dashboard)
    if (status === "suspended" || status === "cancelled") {
      router.push("/portal");
      return;
    }

    // Profissionais antigos sem professionalStatus têm acesso (fallback compatível)
  }, [user, profile, loading, router]);

  // License listener — apenas para owners (team_members herdam do dono)
  useEffect(() => {
    if (!user || !profile || profile.role === "team_member") return;
    const licenseRef = doc(db, "licenses", user.uid);
    const unsub = onSnapshot(licenseRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setLicenseStatus(data.status ?? null);
      const end = data.currentPeriodEnd;
      setLicenseEnd(end ? (end.toDate ? end.toDate() : new Date(end)) : null);
    });
    return unsub;
  }, [user, profile]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login");
    } catch (e) {
      console.error("Error signing out:", e);
    }
  };

  if (loading || !user || !profile) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-slate-950 min-h-screen">
        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
        <p className="mt-4 text-slate-400 font-medium">Carregando painel...</p>
      </div>
    );
  }

  // Active navigation links helper
  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(path);
  };

  const isTeamMember = profile?.role === "team_member";

  const navItems = [
    { name: "Leads / Contatos", href: "/dashboard", icon: Users },
    { name: "Serviços", href: "/dashboard/services", icon: Briefcase },
    { name: "Horários", href: "/dashboard/slots", icon: Calendar },
    ...(!isTeamMember ? [
      { name: "Equipe", href: "/dashboard/team", icon: UserCog },
      { name: "Personalização da Página", href: "/dashboard/personalization", icon: Palette },
    ] : []),
    { name: "Editar Perfil", href: "/dashboard/profile", icon: Settings },
  ];

  const styleVariables = {
    "--theme-primary": themeConfig.primaryColor || "#6366f1",
    "--theme-primary-hover": themeConfig.primaryColor || "#4f46e5",
    "--theme-heading-font": `'${themeConfig.headingFont}', ${fontCatalog.find(f => f.family === themeConfig.headingFont)?.fallback || 'sans-serif'}`,
    "--theme-body-font": `'${themeConfig.bodyFont}', ${fontCatalog.find(f => f.family === themeConfig.bodyFont)?.fallback || 'sans-serif'}`,
  } as React.CSSProperties;

  const bgStyle: React.CSSProperties = { 
    ...styleVariables,
    fontFamily: "var(--theme-body-font)",
  };

  if (themeConfig.backgroundType === "solid") {
    bgStyle.backgroundColor = themeConfig.backgroundColor;
  } else if (themeConfig.backgroundType === "gradient" && themeConfig.backgroundGradient) {
    bgStyle.background = gradientPresets[themeConfig.backgroundGradient] || themeConfig.backgroundColor;
  } else if (themeConfig.backgroundType === "preset" && themeConfig.backgroundPreset) {
    bgStyle.background = bgPatterns[themeConfig.backgroundPreset]?.css || themeConfig.backgroundColor;
    if (themeConfig.backgroundPreset === "texturized") {
      bgStyle.backgroundSize = "20px 20px";
    }
  } else if (themeConfig.backgroundType === "image" && themeConfig.backgroundImageUrl) {
    const versionedUrl = buildVersionedImageUrl(themeConfig.backgroundImageUrl, themeConfig.backgroundUpdatedAt);
    bgStyle.backgroundImage = `url(${versionedUrl})`;
    bgStyle.backgroundPosition = themeConfig.backgroundPosition;
    bgStyle.backgroundSize = themeConfig.backgroundSize;
    bgStyle.backgroundAttachment = "fixed";
  } else {
    bgStyle.backgroundColor = "#020617";
  }

  return (
    <div style={bgStyle} className="min-h-screen flex flex-col md:flex-row text-slate-100 font-sans relative selection:bg-[var(--theme-primary)] selection:text-white transition-colors duration-200 overflow-x-hidden">
      {fontUrl && <link rel="stylesheet" href={fontUrl} />}
      
      {/* Dynamic overlay glass layer to protect readability of the dashboard */}
      <div 
        className="absolute inset-0 z-0 backdrop-blur-[12px] pointer-events-none transition-colors duration-200"
        style={{
          backgroundColor: hexToRgba(themeConfig.backgroundColor, 0.85)
        }}
      />

      {/* Dynamic style overrides for Tailwind colors to match the theme configs */}
      <style>{`
        :root {
          --theme-primary: ${themeConfig.primaryColor || '#6366f1'};
          --theme-background: ${themeConfig.backgroundColor || '#020617'};
          --theme-surface: ${themeConfig.surfaceColor || '#0f172a'};
          --theme-text: ${themeConfig.textColor || '#f8fafc'};
          --theme-muted-text: ${themeConfig.mutedTextColor || '#94a3b8'};
          --theme-border: ${hexToRgba(themeConfig.textColor || '#ffffff', 0.08)};
          --theme-input-bg: ${hexToRgba(themeConfig.textColor || '#ffffff', 0.03)};
          --theme-card-bg: ${hexToRgba(themeConfig.surfaceColor || '#0f172a', themeConfig.mode === 'light' ? 0.9 : 0.75)};
        }
        
        .font-sans {
          font-family: var(--theme-body-font) !important;
        }

        /* Override main layouts backgrounds to match theme */
        .bg-slate-950 {
          background-color: var(--theme-background) !important;
        }
        .bg-slate-900 {
          background-color: var(--theme-surface) !important;
        }

        /* Target all opacity variants of bg-slate-900 (like /50, /30, etc.) to use theme-card-bg */
        [class*="bg-slate-900/"], [class*="bg-slate-900\\/"] {
          background-color: var(--theme-card-bg) !important;
        }

        /* Target all opacity variants of bg-slate-950 to use input background */
        [class*="bg-slate-950/"], [class*="bg-slate-950\\/"] {
          background-color: var(--theme-input-bg) !important;
        }

        /* Target bg-slate-800 and its variants */
        .bg-slate-800 {
          background-color: var(--theme-surface) !important;
        }
        [class*="bg-slate-800/"], [class*="bg-slate-800\\/"] {
          background-color: var(--theme-input-bg) !important;
        }
        
        /* Overrides for hover elements */
        .hover\\:bg-slate-800\\/50:hover {
          background-color: var(--theme-input-bg) !important;
        }
        .hover\\:bg-slate-800:hover {
          background-color: var(--theme-input-bg) !important;
        }

        /* Text colors to adapt to mode (dark in light theme, light in dark theme) */
        .text-slate-100 {
          color: var(--theme-text) !important;
        }
        .text-white {
          color: var(--theme-text) !important;
        }
        .text-slate-200 {
          color: var(--theme-text) !important;
        }
        .text-slate-300 {
          color: var(--theme-text) !important;
        }
        .text-slate-400 {
          color: var(--theme-muted-text) !important;
        }
        .text-slate-500 {
          color: var(--theme-muted-text) !important;
        }

        /* Border overrides dynamically targeting all slate borders */
        [class*="border-slate-800"] {
          border-color: var(--theme-border) !important;
        }

        /* Accent primary color overrides */
        .bg-indigo-600 {
          background-color: var(--theme-primary) !important;
          color: ${themeConfig.mode === 'light' ? '#ffffff' : 'var(--theme-text)'} !important;
        }
        .hover\\:bg-indigo-500:hover {
          background-color: var(--theme-primary) !important;
          filter: brightness(0.9) !important;
        }
        .border-indigo-500 {
          border-color: var(--theme-primary) !important;
        }
        .text-indigo-600 {
          color: var(--theme-primary) !important;
        }
        .text-indigo-500 {
          color: var(--theme-primary) !important;
        }
        .text-indigo-400 {
          color: var(--theme-primary) !important;
        }
        .focus\\:border-indigo-500:focus {
          border-color: var(--theme-primary) !important;
        }
        .focus\\:ring-indigo-500:focus {
          --tw-ring-color: var(--theme-primary) !important;
          border-color: var(--theme-primary) !important;
        }
      `}</style>

      {/* Mobile Header */}
      <header className="flex md:hidden items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0 relative z-10">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Calendar className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold tracking-tight text-lg">Retoria</span>
        </div>
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>

      {/* Sidebar - Desktop */}
      <aside className={`
        fixed inset-0 z-45 md:relative md:z-10
        flex flex-col w-64 bg-slate-900 border-r border-slate-800/80 shrink-0
        transition-transform duration-300 md:transition-none md:translate-x-0
        ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        {/* Sidebar Header */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-slate-800/50">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <span className="font-extrabold tracking-tight text-xl bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">Retoria</span>
          </div>
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-1 rounded-lg hover:bg-slate-800 text-slate-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Professional Details Mini Card */}
        <div className="p-4 mx-3 my-4 bg-slate-950/50 border border-slate-800/50 rounded-2xl">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">
            {profile?.role === "team_member" ? "Membro da Equipe" : "Profissional"}
          </p>
          <h4 className="font-bold text-sm text-slate-200 truncate">{profile?.nome || "Sem Nome"}</h4>
          <p className="text-xs text-indigo-400 font-medium truncate mb-2">
            {profile?.role === "team_member"
              ? (profile.especialidade || profile.nomeNegocio || "Sem Negócio")
              : (profile?.nomeNegocio || "Sem Negócio")}
          </p>
          
          {profile?.slugPublico && (
            <Link 
              href={`/p/${profile.slugPublico}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition-all bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 w-full justify-center"
            >
              <span>Ver página pública</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>

        {/* Sidebar Nav */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200
                  ${active
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/15"
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                  }
                `}
              >
                <Icon className={`h-5 w-5 ${active ? "text-white" : "text-slate-400 group-hover:text-slate-300"}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}

          <div className="pt-2 border-t border-slate-800/50 space-y-1 mt-2">
            <Link
              href="/portal"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 w-full px-4 py-3 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 rounded-xl text-sm font-semibold transition-all duration-200"
            >
              <LayoutGrid className="h-5 w-5" />
              <span>Trocar de área</span>
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3 text-slate-400 hover:bg-red-500/10 hover:text-red-400 rounded-xl text-sm font-semibold transition-all duration-200"
            >
              <LogOut className="h-5 w-5" />
              <span>Sair da conta</span>
            </button>
          </div>
        </nav>
      </aside>

      {/* Backdrop (mobile menu) */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto relative z-10">
        {/* License grace period banner */}
        {licenseStatus === "grace" && licenseEnd && (() => {
          const daysLeft = Math.max(0, Math.ceil((licenseEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
          return (
            <div className="sticky top-0 z-20 bg-amber-500/90 backdrop-blur-sm border-b border-amber-600/50 px-4 py-2.5 flex items-center gap-2 text-amber-950 text-sm font-semibold">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                Seu plano expirou.{" "}
                {daysLeft > 0 ? `Você tem ${daysLeft} dia${daysLeft !== 1 ? "s" : ""} de período de graça antes da suspensão.` : "Seu acesso será suspenso em breve."}
                {" "}Entre em contato para renovar.
              </span>
            </div>
          );
        })()}
        {licenseStatus === "trial" && licenseEnd && (() => {
          const daysLeft = Math.max(0, Math.ceil((licenseEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
          if (daysLeft > 3) return null;
          return (
            <div className="sticky top-0 z-20 bg-blue-500/90 backdrop-blur-sm border-b border-blue-600/50 px-4 py-2.5 flex items-center gap-2 text-blue-950 text-sm font-semibold">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                Seu trial termina em {daysLeft} dia{daysLeft !== 1 ? "s" : ""}. Entre em contato para garantir a continuidade do acesso.
              </span>
            </div>
          );
        })()}
        <div className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
