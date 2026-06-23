"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../providers";
import {
  Calendar,
  CalendarCheck,
  Briefcase,
  User,
  LogOut,
  Loader2,
  ChevronRight,
  Sparkles,
} from "lucide-react";

export default function PortalPage() {
  const router = useRouter();
  const { user, profile, customerProfile, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

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

  const hasProfessional = !!profile;
  const hasCustomer = !!customerProfile;
  const displayName = profile?.nome ?? customerProfile?.name ?? user.email?.split("@")[0] ?? "você";
  const isProfessionalActive =
    !profile?.professionalStatus ||
    ["trial", "active", "onboarding"].includes(profile.professionalStatus);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-600/8 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="max-w-2xl w-full mx-auto px-6 h-16 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Calendar className="h-4 w-4 text-white" />
          </div>
          <span className="font-extrabold tracking-tight text-lg bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
            Retoria
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-red-400 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-10 z-10 flex flex-col">
        {/* Greeting */}
        <div className="mb-8">
          <p className="text-slate-400 text-sm font-medium mb-1">Bem-vindo de volta</p>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Olá, {displayName.split(" ")[0]}!
          </h1>
          <p className="text-slate-400 text-sm mt-1">{user.email}</p>
        </div>

        {/* Access cards */}
        <div className="space-y-4 mb-8">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            O que você deseja fazer?
          </p>

          {/* Customer area */}
          {hasCustomer ? (
            <Link
              href="/customer/appointments"
              className="group flex items-center gap-4 p-5 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/40 rounded-2xl transition-all duration-200 shadow-sm"
            >
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/20 transition-colors">
                <CalendarCheck className="h-6 w-6 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-slate-100 text-base">Meus agendamentos</h2>
                <p className="text-sm text-slate-400 mt-0.5">
                  Veja seus próximos horários e histórico.
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-600 group-hover:text-slate-300 transition-colors shrink-0" />
            </Link>
          ) : (
            <Link
              href="/customer/appointments"
              className="group flex items-center gap-4 p-5 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/30 rounded-2xl transition-all duration-200 shadow-sm"
            >
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <CalendarCheck className="h-6 w-6 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-slate-100 text-base">Meus agendamentos</h2>
                <p className="text-sm text-slate-400 mt-0.5">
                  Acesse ou crie seu perfil de cliente.
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-600 group-hover:text-slate-300 transition-colors shrink-0" />
            </Link>
          )}

          {/* Professional area */}
          {hasProfessional && isProfessionalActive ? (
            <Link
              href="/dashboard"
              className="group flex items-center gap-4 p-5 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/40 rounded-2xl transition-all duration-200 shadow-sm"
            >
              <div className="h-12 w-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0 group-hover:bg-indigo-500/20 transition-colors">
                <Briefcase className="h-6 w-6 text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-slate-100 text-base">Área profissional</h2>
                  {profile?.professionalStatus === "trial" && (
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-500/15 text-amber-400 border border-amber-500/20 rounded-full">
                      Trial
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-400 mt-0.5 truncate">
                  {profile?.nomeNegocio ?? "Gerencie sua agenda e seus clientes."}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-600 group-hover:text-slate-300 transition-colors shrink-0" />
            </Link>
          ) : hasProfessional && profile?.professionalStatus === "onboarding" ? (
            <Link
              href="/professional/onboarding"
              className="group flex items-center gap-4 p-5 bg-amber-950/30 hover:bg-amber-950/50 border border-amber-500/30 rounded-2xl transition-all duration-200"
            >
              <div className="h-12 w-12 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
                <Briefcase className="h-6 w-6 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-amber-300 text-base">Concluir cadastro profissional</h2>
                <p className="text-sm text-amber-400/70 mt-0.5">
                  Você está com o cadastro incompleto. Continue para ativar.
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-amber-600 group-hover:text-amber-300 transition-colors shrink-0" />
            </Link>
          ) : (
            <Link
              href="/professional/onboarding"
              className="group flex items-center gap-4 p-5 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-violet-500/30 rounded-2xl transition-all duration-200 shadow-sm"
            >
              <div className="h-12 w-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                <Sparkles className="h-6 w-6 text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-slate-100 text-base">Quero usar no meu negócio</h2>
                <p className="text-sm text-slate-400 mt-0.5">
                  Crie sua página e comece a receber agendamentos.
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-600 group-hover:text-slate-300 transition-colors shrink-0" />
            </Link>
          )}

          {/* Profile */}
          <Link
            href={hasProfessional ? "/dashboard/profile" : "/customer/profile"}
            className="group flex items-center gap-4 p-5 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 rounded-2xl transition-all duration-200 shadow-sm"
          >
            <div className="h-12 w-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
              <User className="h-6 w-6 text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-slate-100 text-base">Meu perfil</h2>
              <p className="text-sm text-slate-400 mt-0.5">Dados da conta e preferências.</p>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-600 group-hover:text-slate-300 transition-colors shrink-0" />
          </Link>
        </div>
      </main>
    </div>
  );
}
