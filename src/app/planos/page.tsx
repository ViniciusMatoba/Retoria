"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Calendar, Check, ArrowRight, Loader2, AlertCircle, CheckCircle2,
  Users, User, Building2, Zap,
} from "lucide-react";

const PLANS = [
  {
    id: "individual",
    name: "Individual",
    price: 29,
    description: "Para profissionais autônomos que trabalham sozinhos.",
    members: "Apenas você",
    icon: User,
    features: [
      "Página pública de agendamento",
      "Controle de horários e slots",
      "Painel de leads e clientes",
      "Histórico completo de pedidos",
      "Personalização de tema e cores",
    ],
    highlight: false,
  },
  {
    id: "professional",
    name: "Professional",
    price: 59,
    description: "Para salões, estúdios e equipes pequenas.",
    members: "Até 5 membros",
    icon: Users,
    features: [
      "Tudo do Individual",
      "Até 5 profissionais na equipe",
      "Cada membro com agenda própria",
      "Gestão centralizada de leads",
      "Convites por link para a equipe",
    ],
    highlight: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 99,
    description: "Para clínicas e equipes maiores.",
    members: "Até 15 membros",
    icon: Building2,
    features: [
      "Tudo do Professional",
      "Até 15 profissionais na equipe",
      "Suporte prioritário",
      "Onboarding assistido",
    ],
    highlight: false,
  },
];

function PlanosContent() {
  const searchParams = useSearchParams();
  const aviso = searchParams.get("aviso");

  const [selectedPlan, setSelectedPlan] = useState("professional");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nome.trim(), email: email.trim(), plano: selectedPlan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao enviar.");
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Erro ao enviar solicitação. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans relative overflow-hidden">
      <div className="absolute top-0 left-1/4 -translate-x-1/2 w-96 h-96 bg-indigo-600/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 translate-x-1/2 w-96 h-96 bg-purple-600/8 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between border-b border-slate-900/80 relative z-10">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Calendar className="h-5 w-5 text-white" />
          </div>
          <span className="font-extrabold tracking-tight text-xl bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">Retoria</span>
        </Link>
        <Link href="/login" className="text-sm font-semibold text-slate-400 hover:text-white transition-all">
          Entrar
        </Link>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-16 relative z-10">
        {/* Aviso quando veio do /register sem token */}
        {aviso === "registro" && (
          <div className="mb-8 flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-300 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <p>O cadastro de profissionais requer um link de ativação. Solicite acesso abaixo e entraremos em contato.</p>
          </div>
        )}

        {/* Hero */}
        <div className="text-center mb-14 space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 rounded-full text-xs font-semibold">
            <Zap className="h-3.5 w-3.5" />
            <span>7 dias grátis para testar</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Planos simples e transparentes
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Escolha o plano ideal para o seu negócio. Cancele a qualquer momento.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const isSelected = selectedPlan === plan.id;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelectedPlan(plan.id)}
                className={`text-left p-6 rounded-3xl border transition-all duration-200 relative ${
                  plan.highlight
                    ? "bg-indigo-950/40 border-indigo-500/50 shadow-xl shadow-indigo-500/10"
                    : "bg-slate-900/40 border-slate-800 hover:border-slate-600"
                } ${isSelected ? "ring-2 ring-indigo-500" : ""}`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-indigo-600 rounded-full text-[11px] font-bold text-white whitespace-nowrap">
                    Mais popular
                  </div>
                )}
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-4 ${plan.highlight ? "bg-indigo-500/20 text-indigo-400" : "bg-slate-800 text-slate-400"}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-bold text-white mb-1">{plan.name}</h2>
                <p className="text-xs text-slate-500 mb-4">{plan.description}</p>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-3xl font-black text-white">R$ {plan.price}</span>
                  <span className="text-slate-500 text-sm mb-1">/mês</span>
                </div>
                <p className="text-xs text-slate-500 mb-5">{plan.members}</p>
                <ul className="space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-slate-300">
                      <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                {isSelected && (
                  <div className="mt-4 pt-4 border-t border-indigo-500/20 text-xs text-indigo-400 font-semibold flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" /> Plano selecionado
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Request Access Form */}
        <div className="max-w-lg mx-auto">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl">
            {!sent ? (
              <>
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-white">Solicitar acesso</h2>
                  <p className="text-slate-400 text-sm mt-1">
                    Preencha seus dados e entraremos em contato com o link de ativação.
                  </p>
                </div>

                {error && (
                  <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex gap-2 items-center">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-sm">
                    <span className="text-slate-500">Plano escolhido: </span>
                    <span className="font-semibold text-indigo-400">
                      {PLANS.find((p) => p.id === selectedPlan)?.name} — R$ {PLANS.find((p) => p.id === selectedPlan)?.price}/mês
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Seu nome completo"
                    className="w-full px-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-100 placeholder-slate-500 text-sm transition-all"
                  />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Seu melhor e-mail"
                    className="w-full px-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-100 placeholder-slate-500 text-sm transition-all"
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98]"
                  >
                    {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <><span>Solicitar acesso</span><ArrowRight className="h-4 w-4" /></>}
                  </button>
                </form>
                <p className="text-center text-xs text-slate-600 mt-4">
                  Você receberá um e-mail com o link de ativação em até 24h.
                </p>
              </>
            ) : (
              <div className="flex flex-col items-center text-center py-6 space-y-4">
                <div className="h-14 w-14 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                </div>
                <div>
                  <p className="font-bold text-white text-lg">Solicitação recebida!</p>
                  <p className="text-slate-400 text-sm mt-2 leading-relaxed max-w-sm">
                    Recebemos seu pedido para o plano <span className="text-indigo-400 font-semibold">{PLANS.find((p) => p.id === selectedPlan)?.name}</span>. Entraremos em contato pelo e-mail <span className="text-white font-semibold">{email}</span> em até 24h com o link de ativação.
                  </p>
                </div>
                <Link href="/login" className="text-sm text-indigo-400 hover:text-indigo-300 transition-all font-semibold">
                  Já tenho acesso → Entrar
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="py-8 text-center text-xs text-slate-700 border-t border-slate-900 mt-12 relative z-10">
        <p>&copy; {new Date().getFullYear()} Retoria. Feito para profissionais autônomos.</p>
      </footer>
    </div>
  );
}

export default function PlanosPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex flex-col justify-center items-center bg-slate-950 min-h-screen">
        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
      </div>
    }>
      <PlanosContent />
    </Suspense>
  );
}
