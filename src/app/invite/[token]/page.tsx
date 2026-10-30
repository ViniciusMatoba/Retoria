"use client";

import React, { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Loader2, CheckCircle, AlertCircle, Eye, EyeOff, Calendar } from "lucide-react";

interface PageProps {
  params: Promise<{ token: string }>;
}

interface InviteData {
  nome: string;
  email: string;
  especialidade: string;
  ownerNomeNegocio: string;
}

export default function AcceptInvitePage({ params }: PageProps) {
  const { token } = use(params);
  const router = useRouter();

  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [inviteError, setInviteError] = useState("");

  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/invite/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setInviteError(data.error);
        else setInvite(data);
      })
      .catch(() => setInviteError("Erro ao carregar convite."))
      .finally(() => setLoadingInvite(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");

    if (senha.length < 6) { setSubmitError("Senha deve ter no mínimo 6 caracteres."); return; }
    if (senha !== confirmar) { setSubmitError("As senhas não conferem."); return; }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/invite/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha }),
      });
      const data = await res.json();
      if (!res.ok) { setSubmitError(data.error ?? "Erro ao criar conta."); return; }

      // Login automático
      await signInWithEmailAndPassword(auth, invite!.email, senha);
      setDone(true);
      setTimeout(() => router.push("/dashboard/slots"), 1500);
    } catch (err: any) {
      setSubmitError(err.message ?? "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInvite) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (inviteError) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto" />
          <h1 className="text-xl font-bold text-slate-100">Convite inválido</h1>
          <p className="text-slate-400 text-sm">{inviteError}</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4">
          <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto" />
          <h1 className="text-xl font-bold text-slate-100">Conta criada!</h1>
          <p className="text-slate-400 text-sm">Redirecionando para o painel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="h-12 w-12 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/20">
            <Calendar className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-100">Você foi convidado!</h1>
          <p className="text-slate-400 text-sm">
            <span className="font-semibold text-indigo-400">{invite?.ownerNomeNegocio}</span> está convidando você para fazer parte da equipe.
          </p>
        </div>

        {/* Invite details card */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-1">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Seus dados</p>
          <p className="text-slate-100 font-bold">{invite?.nome}</p>
          {invite?.especialidade && <p className="text-indigo-400 text-sm font-medium">{invite.especialidade}</p>}
          <p className="text-slate-400 text-sm">{invite?.email}</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-300">Crie sua senha de acesso</h2>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Senha</label>
            <div className="relative">
              <input
                type={showSenha ? "text" : "password"}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full px-4 py-2.5 pr-10 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition-all"
                required
                minLength={6}
              />
              <button type="button" onClick={() => setShowSenha(!showSenha)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500">
                {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Confirmar senha</label>
            <input
              type={showSenha ? "text" : "password"}
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              placeholder="Repita a senha"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition-all"
              required
            />
          </div>

          {submitError && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700/50 text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar conta e entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
