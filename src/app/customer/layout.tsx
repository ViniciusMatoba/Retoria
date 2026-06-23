"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../providers";
import { getOrCreateCustomerAccount } from "@/lib/accountUtils";
import {
  Calendar, CalendarCheck, User, LogOut, Loader2, LayoutGrid,
} from "lucide-react";

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, customerProfile, loading, logout, refreshCustomerProfile } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push("/login?returnUrl=/customer/appointments"); return; }

    // Auto-create customerAccount if authenticated but doesn't have one yet
    if (!customerProfile) {
      getOrCreateCustomerAccount(user).then(refreshCustomerProfile).catch(console.error);
    }
  }, [user, customerProfile, loading, router, refreshCustomerProfile]);

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  if (loading || !user) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-slate-950 min-h-screen">
        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
        <p className="mt-4 text-slate-400 font-medium">Carregando...</p>
      </div>
    );
  }

  const displayName = customerProfile?.name ?? user.email?.split("@")[0] ?? "Cliente";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top nav */}
      <header className="bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/portal" className="h-8 w-8 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Calendar className="h-4 w-4 text-white" />
            </Link>
            <div>
              <p className="text-xs text-slate-500 leading-none">Área do cliente</p>
              <p className="text-sm font-bold text-slate-100 leading-tight">{displayName}</p>
            </div>
          </div>

          <nav className="flex items-center gap-1">
            <NavLink href="/customer/appointments" icon={<CalendarCheck className="h-4 w-4" />} label="Agendamentos" />
            <NavLink href="/customer/profile" icon={<User className="h-4 w-4" />} label="Perfil" />
            <Link
              href="/portal"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Portal</span>
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}

function NavLink({
  href, icon, label,
}: {
  href: string; icon: React.ReactNode; label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
