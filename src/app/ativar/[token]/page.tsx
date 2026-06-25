"use client";

import React, { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { PLANS, type PlanId } from "@/lib/licenseTypes";
import {
  Calendar, Loader2, AlertCircle, CheckCircle2, Users, Building2, User as UserIcon, Eye, EyeOff,
} from "lucide-react";

interface PageProps { params: Promise<{ token: string }> }

interface TokenInfo {
  plan: PlanId;
  planLabel: string;
  maxMembers: number;
  contractDays: number;
  trialDays: number;
  label: string;
}

const planIcons: Record<PlanId, React.ReactNode> = {
  individual: <UserIcon className="h-6 w-6" />,
  professional: <Users className="h-6 w-6" />,
  enterprise: <Building2 className="h-6 w-6" />,
};

const planColors: Record<PlanId, string> = {
  individual: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  professional: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  enterprise: "text-amber-400 bg-amber-500/10 border-amber-500/20",
};

const membersLabel = (n: number) => {
  if (n === 0) return "Somente você";
  if (n === -1) return "Membros ilimitados";
  return `Até ${n} membros de equipe`;
};

export default function ActivatePage({ params }: PageProps) {
  const { token } = use(params);
  const router = useRouter();

  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [tokenError, setTokenError] = useState("");
  const [loadingToken, setLoadingToken] = useState(true);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`/api/activate/${token}`);
        const data = await res.json();
        if (!res.ok) { setTokenError(data.error ?? "Link inválido."); return; }
        setTokenInfo(data);
      } catch {
        setTokenError("Erro ao verificar o link.");
      } finally {
        setLoadingToken(false);
      }
    };
    check();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInfo) return;
    setFormError("");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/activate/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error ?? "Erro ao criar conta."); return; }

      // Auto login
      await signInWithEmailAndPassword(auth, email.toLowerCase().trim(), password);
      setDone(true);
      setTimeout(() => router.push("/professional/onboarding"), 1500);
    } catch (err: any) {
      setFormError(err.message ?? "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingToken) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="max-w-sm w-full bg-slate-900 border border-red-500/20 rounded-3xl p-8 text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto" />
          <h1 className="text-xl font-bold text-slate-100">Link inválido</h1>
          <p className="text-slate-400 text-sm">{tokenError}</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="max-w-sm w-full bg-slate-900 border border-emerald-500/20 rounded-3xl p-8 text-center space-y-4">
          <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto" />
          <h1 className="text-xl font-bold text-slate-100">Conta criada!</h1>
          <p className="text-slate-400 text-sm">Redirecionando para o cadastro do perfil...</p>
        </div>
      </div>
    );
  }

  const plan = tokenInfo!.plan;
  const colorClass = planColors[plan];

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2">
          <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Calendar className="h-5 w-5 text-white" />
          </div>
          <span className="text-2xl font-extrabold tracking-tight text-slate-100">Retoria</span>
        </div>

        {/* Plan card */}
        <div className={`flex items-center gap-4 p-5 rounded-2xl border ${colorClass}`}>
          <div className={`p-3 rounded-xl border ${colorClass}`}>
            {planIcons[plan]}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider opacity-70">Plano ativado</p>
            <p className="text-lg font-extrabold">{tokenInfo!.planLabel}</p>
            <p className="text-xs opacity-70 mt-0.5">{membersLabel(tokenInfo!.maxMembers)} · {tokenInfo!.trialDays} dias de trial</p>
          </div>
        </div>

        {/* Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-5">
          <div>
            <h1 className="text-xl font-extrabold text-slate-100">Crie sua conta</h1>
            <p className="text-sm text-slate-400 mt-1">Preencha os dados abaixo para ativar seu acesso.</p>
          </div>

          {formError && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertCircle className="h-4 w-4 shrink-0" /><span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Nome completo *</label>
              <input type="text" required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como você se chama"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">E-mail *</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Senha *</label>
              <div className="relative">
                <input type={showPw ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres"
                  className="w-full px-4 py-2.5 pr-10 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition-all" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700/50 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/20 mt-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar conta e ativar acesso"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-500">
          Já tem uma conta? <a href="/login" className="text-indigo-400 hover:underline">Entrar</a>
        </p>
      </div>
    </div>
  );
}
