"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../providers";
import {
  UserPlus, Users, Loader2, AlertCircle, Check, Copy, Trash2,
  Mail, Briefcase, User, Link as LinkIcon, Clock,
} from "lucide-react";

interface TeamMember {
  id: string;
  nome: string;
  especialidade: string;
  fotoLogoUrl: string | null;
  professionalStatus: string;
  email: string | null;
}

interface PendingInvite {
  token: string;
  email: string;
  nome: string;
}

export default function TeamPage() {
  const { user, profile } = useAuth();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [especialidade, setEspecialidade] = useState("");
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState("");

  // Convite gerado
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchTeam = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/professionals/${user.uid}/team`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erro ao carregar equipe."); return; }
      setMembers(data.members ?? []);
      setInvites(data.invites ?? []);
    } catch {
      setError("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setFormError("");
    setSending(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/professionals/${user.uid}/team`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, especialidade }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error ?? "Erro ao gerar convite."); return; }

      const link = `${window.location.origin}/invite/${data.token}`;
      setGeneratedLink(link);
      setNome(""); setEmail(""); setEspecialidade("");
      setShowForm(false);
      fetchTeam();
    } catch {
      setFormError("Erro de conexão.");
    } finally {
      setSending(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!user || !confirm("Desativar este membro da equipe?")) return;
    const token = await user.getIdToken();
    await fetch(`/api/professionals/${user.uid}/team`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });
    fetchTeam();
  };

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Bloquear acesso para membros da equipe
  if (profile?.role === "team_member") {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-slate-500">Acesso restrito ao proprietário do negócio.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">Equipe</h1>
          <p className="text-slate-400 text-sm mt-1">Gerencie os profissionais que fazem parte do seu negócio.</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setGeneratedLink(null); setFormError(""); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/20"
        >
          <UserPlus className="h-4 w-4" />
          <span>Convidar profissional</span>
        </button>
      </div>

      {/* Invite form */}
      {showForm && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-300 flex items-center gap-2">
            <Mail className="h-4 w-4 text-indigo-400" />
            Novo convite
          </h2>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Nome completo *</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500"><User className="h-4 w-4" /></span>
                  <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Maria Silva" required
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">E-mail *</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500"><Mail className="h-4 w-4" /></span>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="profissional@email.com" required
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition-all" />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Especialidade / Cargo</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500"><Briefcase className="h-4 w-4" /></span>
                  <input type="text" value={especialidade} onChange={(e) => setEspecialidade(e.target.value)} placeholder="Ex: Barbeiro, Dentista, Fisioterapeuta..."
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition-all" />
                </div>
              </div>
            </div>

            {formError && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <AlertCircle className="h-4 w-4 shrink-0" /><span>{formError}</span>
              </div>
            )}

            <div className="flex gap-3">
              <button type="submit" disabled={sending}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700/50 text-white font-semibold rounded-xl text-sm transition-all">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><LinkIcon className="h-4 w-4" /><span>Gerar link de convite</span></>}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm transition-all">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Generated link */}
      {generatedLink && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-5 space-y-3">
          <p className="text-emerald-400 font-semibold text-sm flex items-center gap-2">
            <Check className="h-4 w-4" /> Convite gerado! Envie este link para o profissional:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-300 truncate">{generatedLink}</code>
            <button onClick={() => copyLink(generatedLink)}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all shrink-0">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? "Copiado!" : "Copiar"}</span>
            </button>
          </div>
          <p className="text-xs text-slate-500">O link expira em 7 dias.</p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0" /><span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 text-indigo-500 animate-spin" /></div>
      ) : (
        <div className="space-y-6">
          {/* Active members */}
          {members.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Users className="h-3.5 w-3.5" /> Profissionais ativos ({members.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {members.map((m) => (
                  <div key={m.id} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center shrink-0 overflow-hidden">
                      {m.fotoLogoUrl
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={m.fotoLogoUrl} alt={m.nome} className="h-full w-full object-cover" />
                        : <span className="text-lg font-bold text-indigo-400">{m.nome[0]}</span>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-100 text-sm truncate">{m.nome}</p>
                      {m.especialidade && <p className="text-xs text-indigo-400 font-medium">{m.especialidade}</p>}
                      {m.email && <p className="text-xs text-slate-500 truncate">{m.email}</p>}
                    </div>
                    <button onClick={() => handleRemove(m.id)} title="Desativar membro"
                      className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending invites */}
          {invites.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" /> Convites pendentes ({invites.length})
              </h2>
              <div className="space-y-2">
                {invites.map((inv) => (
                  <div key={inv.token} className="bg-slate-900/50 border border-amber-500/15 rounded-2xl p-4 flex items-center gap-3">
                    <Mail className="h-4 w-4 text-amber-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-200">{inv.nome}</p>
                      <p className="text-xs text-slate-400 truncate">{inv.email}</p>
                    </div>
                    <button onClick={() => copyLink(`${window.location.origin}/invite/${inv.token}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg text-xs font-semibold transition-all shrink-0">
                      <Copy className="h-3 w-3" /><span>Link</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {members.length === 0 && invites.length === 0 && (
            <div className="text-center py-16 space-y-3">
              <Users className="h-10 w-10 text-slate-700 mx-auto" />
              <p className="text-slate-500 font-medium">Nenhum profissional na equipe ainda.</p>
              <p className="text-slate-600 text-sm">Clique em "Convidar profissional" para adicionar alguém.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
