"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../providers";
import {
  UserPlus, Users, Loader2, AlertCircle, Check, Copy, Trash2,
  Mail, Briefcase, User, Link as LinkIcon, Clock, ChevronDown,
  Settings, MessageCircle, Phone,
} from "lucide-react";
import { maskPhone } from "@/lib/whatsapp";

interface TeamMember {
  id: string;
  nome: string;
  especialidade: string;
  fotoLogoUrl: string | null;
  professionalStatus: string;
  email: string | null;
  teamConfig: {
    especialidade: string;
    cargo: string;
    whatsapp?: string | null;
    permissions: {
      canEditProfile: boolean;
      canEditServices: boolean;
      canManageSlots: boolean;
      canViewAllLeads: boolean;
    };
  } | null;
}

interface PendingInvite {
  token: string;
  email: string;
  nome: string;
}

interface TeamSettings {
  whatsappMode: "single" | "per_member";
}

const DEFAULT_PERMISSIONS = {
  canEditProfile: false,
  canEditServices: false,
  canManageSlots: false,
  canViewAllLeads: false,
};

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <span className="text-sm font-semibold text-slate-200">{label}</span>
        {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
      </div>
      <button type="button" onClick={() => onChange(!checked)} className="shrink-0">
        <div className={`w-10 h-5.5 rounded-full relative transition-colors ${checked ? "bg-indigo-600" : "bg-slate-700"}`}
          style={{ width: 40, height: 22 }}>
          <div className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`}
            style={{ width: 18, height: 18, top: 2, left: 2, transform: checked ? "translateX(18px)" : "translateX(0)" }} />
        </div>
      </button>
    </div>
  );
}

export default function TeamPage() {
  const { user, profile } = useAuth();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [teamSettings, setTeamSettings] = useState<TeamSettings>({ whatsappMode: "single" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Invite form
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [especialidade, setEspecialidade] = useState("");
  const [cargo, setCargo] = useState("");
  const [invitePermissions, setInvitePermissions] = useState({ ...DEFAULT_PERMISSIONS });
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState("");
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Member edit panel
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editEspecialidade, setEditEspecialidade] = useState("");
  const [editCargo, setEditCargo] = useState("");
  const [editWhatsapp, setEditWhatsapp] = useState("");
  const [editPermissions, setEditPermissions] = useState({ ...DEFAULT_PERMISSIONS });
  const [savingMember, setSavingMember] = useState(false);
  const [memberSaved, setMemberSaved] = useState(false);

  // WhatsApp mode saving
  const [savingWaMode, setSavingWaMode] = useState(false);

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
      setTeamSettings(data.teamSettings ?? { whatsappMode: "single" });
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
        body: JSON.stringify({ nome, email, especialidade, cargo, permissions: invitePermissions }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error ?? "Erro ao gerar convite."); return; }
      setGeneratedLink(`${window.location.origin}/invite/${data.token}`);
      setNome(""); setEmail(""); setEspecialidade(""); setCargo(""); setInvitePermissions({ ...DEFAULT_PERMISSIONS });
      setShowForm(false);
      fetchTeam();
    } catch {
      setFormError("Erro de conexão.");
    } finally {
      setSending(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!user || !confirm("Desativar este membro da equipe? Ele perderá acesso ao painel.")) return;
    const token = await user.getIdToken();
    await fetch(`/api/professionals/${user.uid}/team`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });
    setEditingMember(null);
    fetchTeam();
  };

  const handleRemoveInvite = async (inviteToken: string, inviteNome: string) => {
    if (!user || !confirm(`Cancelar o convite de ${inviteNome}? O link deixará de funcionar.`)) return;
    const token = await user.getIdToken();
    await fetch(`/api/professionals/${user.uid}/team`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inviteToken }),
    });
    fetchTeam();
  };

  const openEdit = (m: TeamMember) => {
    setEditingMember(m);
    setEditEspecialidade(m.teamConfig?.especialidade ?? m.especialidade ?? "");
    setEditCargo(m.teamConfig?.cargo ?? "");
    setEditWhatsapp(m.teamConfig?.whatsapp ?? "");
    setEditPermissions(m.teamConfig?.permissions ?? { ...DEFAULT_PERMISSIONS });
    setMemberSaved(false);
  };

  const handleSaveMember = async () => {
    if (!user || !editingMember) return;
    setSavingMember(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/professionals/${user.uid}/team/${editingMember.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          especialidade: editEspecialidade,
          cargo: editCargo,
          whatsapp: editWhatsapp || null,
          permissions: editPermissions,
        }),
      });
      if (!res.ok) return;
      setMemberSaved(true);
      setTimeout(() => setMemberSaved(false), 2000);
      fetchTeam();
    } finally {
      setSavingMember(false);
    }
  };

  const handleWhatsappMode = async (mode: "single" | "per_member") => {
    if (!user) return;
    setTeamSettings({ whatsappMode: mode });
    setSavingWaMode(true);
    try {
      const token = await user.getIdToken();
      await fetch(`/api/professionals/${user.uid}/team`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ whatsappMode: mode }),
      });
    } finally {
      setSavingWaMode(false);
    }
  };

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">Equipe</h1>
          <p className="text-slate-400 text-sm mt-1">Gerencie os profissionais e configure os acessos de cada um.</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setGeneratedLink(null); setFormError(""); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/20"
        >
          <UserPlus className="h-4 w-4" />
          <span>Convidar profissional</span>
        </button>
      </div>

      {/* WhatsApp settings card */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-5 md:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-emerald-400" />
          <h2 className="text-sm font-bold text-slate-300">WhatsApp de atendimento</h2>
          {savingWaMode && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500 ml-auto" />}
        </div>
        <p className="text-xs text-slate-500">Defina para onde vai a notificação de agendamento quando o cliente finalizar.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(["single", "per_member"] as const).map((mode) => {
            const active = teamSettings.whatsappMode === mode;
            const labels = { single: "Único para o negócio", per_member: "Individual por profissional" };
            const descs = { single: "Todos os agendamentos vão para o seu WhatsApp.", per_member: "Cada agendamento vai para o WhatsApp do profissional escolhido (opcional por membro)." };
            return (
              <button
                key={mode}
                type="button"
                onClick={() => handleWhatsappMode(mode)}
                className={`text-left p-4 rounded-2xl border transition-all ${active ? "border-emerald-500 bg-emerald-500/10" : "border-slate-800 hover:border-slate-700 bg-slate-950/30"}`}
              >
                <p className={`text-sm font-bold ${active ? "text-emerald-400" : "text-slate-300"}`}>{labels[mode]}</p>
                <p className="text-xs text-slate-500 mt-1">{descs[mode]}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Invite form */}
      {showForm && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-300 flex items-center gap-2">
            <Mail className="h-4 w-4 text-indigo-400" />Novo convite
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
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Especialidade</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500"><Briefcase className="h-4 w-4" /></span>
                  <input type="text" value={especialidade} onChange={(e) => setEspecialidade(e.target.value)} placeholder="Ex: Barbeiro, Dentista..."
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Cargo interno</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500"><User className="h-4 w-4" /></span>
                  <input type="text" value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Ex: Sócio, Colaborador..."
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition-all" />
                </div>
              </div>
            </div>

            {/* Permissões de acesso já no convite */}
            <div className="space-y-3 pt-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Permissões de acesso</p>
              <div className="space-y-3 bg-slate-950/40 rounded-2xl p-4">
                <ToggleRow
                  label="Pode editar o próprio perfil"
                  hint="Nome, foto e dados pessoais."
                  checked={invitePermissions.canEditProfile}
                  onChange={(v) => setInvitePermissions((p) => ({ ...p, canEditProfile: v }))}
                />
                <ToggleRow
                  label="Pode criar e editar serviços"
                  hint="Adicionar, editar e remover serviços da sua agenda."
                  checked={invitePermissions.canEditServices}
                  onChange={(v) => setInvitePermissions((p) => ({ ...p, canEditServices: v }))}
                />
                <ToggleRow
                  label="Pode gerenciar horários"
                  hint="Criar e remover slots de disponibilidade."
                  checked={invitePermissions.canManageSlots}
                  onChange={(v) => setInvitePermissions((p) => ({ ...p, canManageSlots: v }))}
                />
                <ToggleRow
                  label="Pode ver leads de outros membros"
                  hint="Por padrão vê apenas os próprios agendamentos."
                  checked={invitePermissions.canViewAllLeads}
                  onChange={(v) => setInvitePermissions((p) => ({ ...p, canViewAllLeads: v }))}
                />
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Members list */}
          <div className="space-y-3">
            {members.length > 0 && (
              <>
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Users className="h-3.5 w-3.5" /> Profissionais ativos ({members.length})
                </h2>
                {members.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => openEdit(m)}
                    className={`w-full text-left bg-slate-900/50 border rounded-2xl p-4 flex items-center gap-4 transition-all hover:border-indigo-500/30 ${editingMember?.id === m.id ? "border-indigo-500/50 bg-indigo-500/5" : "border-slate-800"}`}
                  >
                    <div className="h-12 w-12 rounded-xl bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center shrink-0 overflow-hidden">
                      {m.fotoLogoUrl
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={m.fotoLogoUrl} alt={m.nome} className="h-full w-full object-cover object-center" />
                        : <span className="text-lg font-bold text-indigo-400">{m.nome[0]}</span>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-100 text-sm truncate">{m.nome}</p>
                      {(m.teamConfig?.cargo || m.teamConfig?.especialidade || m.especialidade) && (
                        <p className="text-xs text-indigo-400 font-medium truncate">
                          {[m.teamConfig?.cargo, m.teamConfig?.especialidade || m.especialidade].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {m.email && <p className="text-xs text-slate-500 truncate">{m.email}</p>}
                    </div>
                    <Settings className="h-4 w-4 text-slate-500 shrink-0" />
                  </button>
                ))}
              </>
            )}

            {invites.length > 0 && (
              <>
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mt-4">
                  <Clock className="h-3.5 w-3.5" /> Convites pendentes ({invites.length})
                </h2>
                {invites.map((inv) => (
                  <div key={inv.token} className="bg-slate-900/50 border border-amber-500/15 rounded-2xl p-4 flex items-center gap-3">
                    <Mail className="h-4 w-4 text-amber-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-200">{inv.nome}</p>
                      <p className="text-xs text-slate-400 truncate">{inv.email}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => copyLink(`${window.location.origin}/invite/${inv.token}`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg text-xs font-semibold transition-all">
                        <Copy className="h-3 w-3" /><span>Link</span>
                      </button>
                      <button onClick={() => handleRemoveInvite(inv.token, inv.nome)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-red-400 hover:bg-red-500/10 border border-red-500/20 rounded-lg text-xs font-semibold transition-all">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}

            {members.length === 0 && invites.length === 0 && (
              <div className="text-center py-12 space-y-3">
                <Users className="h-10 w-10 text-slate-700 mx-auto" />
                <p className="text-slate-500 font-medium">Nenhum profissional na equipe ainda.</p>
                <p className="text-slate-600 text-sm">Clique em "Convidar profissional" para começar.</p>
              </div>
            )}
          </div>

          {/* Member edit panel */}
          {editingMember && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-5 md:p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                  <Settings className="h-4 w-4 text-indigo-400" />Configurar: {editingMember.nome}
                </h2>
                <button onClick={() => setEditingMember(null)} className="text-slate-500 hover:text-slate-300 text-xs">Fechar</button>
              </div>

              {/* Especialidade e cargo */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Especialidade</label>
                  <input type="text" value={editEspecialidade} onChange={(e) => setEditEspecialidade(e.target.value)}
                    placeholder="Ex: Fisioterapeuta, Barbeiro..."
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition-all" />
                  <p className="text-[10px] text-slate-500 mt-1">Aparece para o cliente na seleção do profissional.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Cargo interno</label>
                  <input type="text" value={editCargo} onChange={(e) => setEditCargo(e.target.value)}
                    placeholder="Ex: Sócio, Colaborador, Estagiário..."
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition-all" />
                  <p className="text-[10px] text-slate-500 mt-1">Visível só para você no painel.</p>
                </div>
              </div>

              {/* WhatsApp individual (opcional, só quando modo per_member) */}
              {teamSettings.whatsappMode === "per_member" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    WhatsApp individual <span className="normal-case font-normal text-slate-500">(opcional)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500"><Phone className="h-4 w-4" /></span>
                    <input type="tel" value={editWhatsapp} onChange={(e) => setEditWhatsapp(maskPhone(e.target.value))}
                      placeholder="(11) 99999-9999 — deixe vazio para usar o do negócio"
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition-all" />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Se vazio, usa o WhatsApp principal do negócio.</p>
                </div>
              )}

              {/* Permissões */}
              <div className="space-y-3 pt-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Permissões de acesso</p>
                <div className="space-y-3 bg-slate-950/40 rounded-2xl p-4">
                  <ToggleRow
                    label="Pode editar o próprio perfil"
                    hint="Nome, foto e dados pessoais."
                    checked={editPermissions.canEditProfile}
                    onChange={(v) => setEditPermissions((p) => ({ ...p, canEditProfile: v }))}
                  />
                  <ToggleRow
                    label="Pode criar e editar serviços"
                    hint="Adicionar, editar e remover serviços da sua agenda."
                    checked={editPermissions.canEditServices}
                    onChange={(v) => setEditPermissions((p) => ({ ...p, canEditServices: v }))}
                  />
                  <ToggleRow
                    label="Pode gerenciar horários"
                    hint="Criar e remover slots de disponibilidade."
                    checked={editPermissions.canManageSlots}
                    onChange={(v) => setEditPermissions((p) => ({ ...p, canManageSlots: v }))}
                  />
                  <ToggleRow
                    label="Pode ver leads de outros membros"
                    hint="Por padrão vê apenas os próprios agendamentos."
                    checked={editPermissions.canViewAllLeads}
                    onChange={(v) => setEditPermissions((p) => ({ ...p, canViewAllLeads: v }))}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleSaveMember}
                  disabled={savingMember}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700/50 text-white font-semibold rounded-xl text-sm transition-all"
                >
                  {savingMember ? <Loader2 className="h-4 w-4 animate-spin" /> : memberSaved ? <><Check className="h-4 w-4" /><span>Salvo!</span></> : <span>Salvar configurações</span>}
                </button>
                <button
                  onClick={() => handleRemove(editingMember.id)}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-red-400 hover:bg-red-500/10 border border-red-500/20 font-semibold rounded-xl text-sm transition-all"
                >
                  <Trash2 className="h-4 w-4" /><span>Desativar</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
