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
} from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, loading, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const navItems = [
    { name: "Leads / Contatos", href: "/dashboard", icon: Users },
    { name: "Serviços", href: "/dashboard/services", icon: Briefcase },
    { name: "Horários Disponíveis", href: "/dashboard/slots", icon: Calendar },
    { name: "Personalização da Página", href: "/dashboard/personalization", icon: Palette },
    { name: "Editar Perfil", href: "/dashboard/profile", icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-950 text-slate-100 font-sans">
      {/* Mobile Header */}
      <header className="flex md:hidden items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
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
        fixed inset-0 z-40 md:relative md:z-0
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
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Profissional</p>
          <h4 className="font-bold text-sm text-slate-200 truncate">{profile?.nome || "Sem Nome"}</h4>
          <p className="text-xs text-indigo-400 font-medium truncate mb-2">{profile?.nomeNegocio || "Sem Negócio"}</p>
          
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
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800/50 space-y-1">
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
      </aside>

      {/* Backdrop (mobile menu) */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
