"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { collection, query, orderBy, onSnapshot, getDocs, doc, deleteDoc, where, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "../providers";
import { formatPhoneFriendly, getWhatsAppLink } from "@/lib/whatsapp";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/leadTypes";
import {
  Search, Filter, MessageSquare, Trash2, Clock, CalendarCheck,
  DollarSign, Inbox, AlertCircle, Loader2, CalendarClock, X,
  Building2, User, Users, CheckCircle2, ChevronDown,
} from "lucide-react";
import { useAppModal } from "@/components/ModalProvider";

interface Lead {
  id: string;
  professionalId: string;
  nome: string;
  telefone: string;
  servicoEscolhido: string;
  serviceId: string;
  dataEscolhida: string;
  horarioEscolhido: string;
  observacao?: string;
  status: LeadStatus;
  customerUid?: string;
  origem: string;
  valorTotal?: number;
  createdAt: any;
  updatedAt: any;
  // runtime only
  _profNome?: string;
}

interface TeamMemberTab {
  id: string;
  nome: string;
  especialidade?: string;
}

const statusOptions = [
  { value: "Novo",        label: "Novo",        color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { value: "Em contato",  label: "Em contato",  color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  { value: "Agendado",    label: "Agendado",    color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  { value: "Atendido",    label: "Atendido",    color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  { value: "Cancelado",   label: "Cancelado",   color: "bg-red-500/10 text-red-400 border-red-500/20" },
  { value: "Perdido",     label: "Perdido",     color: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
] satisfies { value: LeadStatus; label: string; color: string }[];

// activeProfId = null → "Todos" (agrega de todos)
type ProfFilter = string | null;

export default function DashboardHome() {
  const { user, profile } = useAuth();

  // Agendamentos cujo evento foi apagado no Google Agenda são cancelados aqui (ao abrir e a cada 3 min)
  useEffect(() => {
    if (!user) return;
    const run = async () => {
      try {
        const token = await user.getIdToken();
        await fetch(`/api/professionals/${user.uid}/google-sync`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // silencioso: a próxima rodada tenta de novo
      }
    };
    run();
    const timer = setInterval(run, 180_000);
    return () => clearInterval(timer);
  }, [user]);
  const { showConfirmationModal } = useAppModal();

  const [teamMembers, setTeamMembers] = useState<TeamMemberTab[]>([]);
  const [activeProfId, setActiveProfId] = useState<ProfFilter>(null); // null = ainda carregando default
  const [initialized, setInitialized] = useState(false);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLimit, setLeadsLimit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");

  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Filters for revenue cards
  const [revenueFilter, setRevenueFilter] = useState<"hoje" | "semana" | "mes" | "ano">("mes");
  const [projectionFilter, setProjectionFilter] = useState<"amanha" | "7d" | "30d" | "todos">("todos");

  // Search autocomplete
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const [rescheduleModal, setRescheduleModal] = useState<{
    leadId: string; nome: string; data: string; inicio: string; fim: string;
    profId: string;
  } | null>(null);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  // ── Fetch team members ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const fetchTeam = async () => {
      try {
        const q = query(
          collection(db, "professionals"),
          where("parentProfessionalId", "==", user.uid),
          where("role", "==", "team_member"),
          where("professionalStatus", "==", "active"),
        );
        const snap = await getDocs(q);
        const members: TeamMemberTab[] = snap.docs.map((d) => ({
          id: d.id,
          nome: d.data().nome ?? "",
          especialidade: d.data().teamConfig?.especialidade ?? d.data().especialidade ?? "",
        }));
        setTeamMembers(members);
        // Default: "Todos" quando há equipe, senão dono
        setActiveProfId(members.length > 0 ? "all" : user.uid);
      } catch {
        setActiveProfId(user.uid);
      } finally {
        setInitialized(true);
      }
    };
    fetchTeam();
  }, [user]);

  // ── Load leads — reactive to activeProfId ─────────────────────────────────
  useEffect(() => {
    if (!user || !initialized) return;
    setLoading(true);

    if (activeProfId === "all") {
      // Agrega leads de todos os profissionais (owner + membros)
      const allProfIds = [user.uid, ...teamMembers.map((m) => m.id)];
      const getProfNome = (id: string) => {
        if (id === user.uid) return "Estabelecimento";
        return teamMembers.find((m) => m.id === id)?.nome ?? "Membro";
      };

      const unsubscribes: (() => void)[] = [];
      const leadsMap = new Map<string, Lead>();

      const merge = () => {
        const merged = Array.from(leadsMap.values()).sort((a, b) => {
          const ta = a.createdAt?.seconds ?? 0;
          const tb = b.createdAt?.seconds ?? 0;
          return tb - ta;
        });
        setLeads(merged);
        setLoading(false);
      };

      for (const pid of allProfIds) {
        const q = query(collection(db, "professionals", pid, "leads"), orderBy("createdAt", "desc"), limit(leadsLimit));
        const unsub = onSnapshot(q, (snap) => {
          snap.docs.forEach((d) => {
            leadsMap.set(`${pid}:${d.id}`, {
              id: d.id,
              _profNome: getProfNome(pid),
              ...d.data(),
            } as Lead);
          });
          // Remove deleted
          snap.docChanges().forEach((change) => {
            if (change.type === "removed") leadsMap.delete(`${pid}:${change.doc.id}`);
          });
          merge();
        }, () => { setLoading(false); });
        unsubscribes.push(unsub);
      }

      return () => unsubscribes.forEach((u) => u());
    } else {
      // Único profissional
      const pid = activeProfId ?? user.uid;
      const q = query(collection(db, "professionals", pid, "leads"), orderBy("createdAt", "desc"), limit(leadsLimit));
      const unsub = onSnapshot(q, (snap) => {
        setLeads(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Lead)));
        setLoading(false);
      }, () => { setLoading(false); });
      return () => unsub();
    }
  }, [user, activeProfId, initialized, teamMembers, leadsLimit]);

  // ── Update status ──────────────────────────────────────────────────────────
  const handleUpdateStatus = async (lead: Lead, newStatus: LeadStatus) => {
    if (!user || updatingLeadId) return;
    setUpdatingLeadId(lead.id);
    setStatusError(null);
    try {
      const token = await user.getIdToken();
      const profId = lead.professionalId || user.uid;
      const res = await fetch(`/api/professionals/${profId}/leads/${lead.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Erro HTTP ${res.status}`);
      }
      // Cleanup silencioso quando lead passa para status inativo
      if (["Cancelado", "Perdido", "Não compareceu"].includes(newStatus)) {
        user.getIdToken().then(t =>
          fetch(`/api/professionals/${profId}/slots/cleanup`, {
            method: "POST",
            headers: { Authorization: `Bearer ${t}` },
          }).catch(() => {})
        );
      }
    } catch (e: any) {
      setStatusError(e.message ?? "Erro ao atualizar status.");
    } finally {
      setUpdatingLeadId(null);
    }
  };

  // ── Reschedule ─────────────────────────────────────────────────────────────
  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !rescheduleModal) return;
    setRescheduleError(null);
    setRescheduleLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(
        `/api/professionals/${rescheduleModal.profId}/leads/${rescheduleModal.leadId}/reschedule`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            dataEscolhida: rescheduleModal.data,
            horarioEscolhido: rescheduleModal.inicio,
            horarioFim: rescheduleModal.fim,
          }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Erro HTTP ${res.status}`);
      }
      setRescheduleModal(null);
    } catch (e: any) {
      setRescheduleError(e.message ?? "Erro ao reagendar.");
    } finally {
      setRescheduleLoading(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDeleteLead = (lead: Lead) => {
    if (!user) return;
    const profId = lead.professionalId || user.uid;
    showConfirmationModal({
      title: "Excluir contato",
      description: `Deseja realmente excluir "${lead.nome}"? Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      cancelLabel: "Cancelar",
      variant: "danger",
      onConfirm: async () => {
        await deleteDoc(doc(db, "professionals", profId, "leads", lead.id));
      },
    });
  };

  // ── Metrics ────────────────────────────────────────────────────────────────
  const newLeads = leads.filter(l => l.status === "Novo").length;
  const scheduledLeads = leads.filter(l => l.status === "Agendado").length;

  const todayStr = new Date().toISOString().split("T")[0];
  const thisMonthStr = new Date().toISOString().slice(0, 7);
  const thisWeekStart = (() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().split("T")[0];
  })();
  const thisYearStr = new Date().getFullYear().toString();

  const attendedThisMonth = leads.filter(
    l => l.status === "Atendido" && l.dataEscolhida?.startsWith(thisMonthStr)
  ).length;

  // Revenue filtered by revenueFilter
  const revenueAtendidos = leads.filter(l => {
    if (l.status !== "Atendido") return false;
    const d = l.dataEscolhida ?? "";
    if (revenueFilter === "hoje") return d === todayStr;
    if (revenueFilter === "semana") return d >= thisWeekStart && d <= todayStr;
    if (revenueFilter === "mes") return d.startsWith(thisMonthStr);
    if (revenueFilter === "ano") return d.startsWith(thisYearStr);
    return true;
  });
  const realRevenue = revenueAtendidos.reduce((s, l) => s + (l.valorTotal ?? 0), 0);

  // Projection filtered by projectionFilter
  const tomorrowStr = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]; })();
  const in7dStr = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().split("T")[0]; })();
  const in30dStr = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split("T")[0]; })();

  const projectionLeads = leads.filter(l => {
    if (l.status !== "Agendado") return false;
    const d = l.dataEscolhida ?? "";
    if (projectionFilter === "amanha") return d === tomorrowStr;
    if (projectionFilter === "7d") return d >= todayStr && d <= in7dStr;
    if (projectionFilter === "30d") return d >= todayStr && d <= in30dStr;
    return true; // "todos"
  });
  const projectedRevenue = projectionLeads.reduce((s, l) => s + (l.valorTotal ?? 0), 0);
  const projectedCount = projectionLeads.length;

  // Histórico mensal — últimos 4 meses
  const monthlyHistory = (() => {
    const now = new Date();
    return Array.from({ length: 4 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (3 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      const atendidos = leads.filter(l => l.status === "Atendido" && l.dataEscolhida?.startsWith(key));
      return {
        key,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        count: atendidos.length,
        real: atendidos.reduce((s, l) => s + (l.valorTotal ?? 0), 0),
      };
    });
  })();

  const formatBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // ── Search autocomplete ────────────────────────────────────────────────────
  const searchSuggestions = searchTerm.length >= 2
    ? Array.from(
        new Map(
          leads
            .filter(l =>
              l.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
              l.telefone.includes(searchTerm) ||
              l.servicoEscolhido.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .slice(0, 6)
            .map(l => [l.nome, l])
        ).values()
      )
    : [];

  // ── Filtered leads ─────────────────────────────────────────────────────────
  const filteredLeads = leads.filter(lead => {
    const matchesSearch =
      lead.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.telefone.includes(searchTerm) ||
      lead.servicoEscolhido.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "Todos" || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  const hasTeam = teamMembers.length > 0;

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Acompanhe seus agendamentos</h1>
        <p className="text-sm text-slate-400">Gerencie contatos e atualize os status de pré-atendimento.</p>
      </div>

      {/* Seletor de profissional — só quando há equipe */}
      {hasTeam && initialized && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveProfId("all")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${activeProfId === "all" ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"}`}
          >
            <Users className="h-4 w-4" />
            <span>Todos</span>
          </button>
          <button
            onClick={() => setActiveProfId(user!.uid)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${activeProfId === user?.uid ? "bg-indigo-600/80 border-indigo-500 text-white" : "border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"}`}
          >
            <Building2 className="h-4 w-4" />
            <span>Estabelecimento</span>
          </button>
          {teamMembers.map((m) => (
            <button
              key={m.id}
              onClick={() => setActiveProfId(m.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${activeProfId === m.id ? "bg-amber-500/20 border-amber-500 text-amber-300" : "border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"}`}
            >
              <User className="h-4 w-4" />
              <span>{m.nome}</span>
              {m.especialidade && <span className="text-xs opacity-70">· {m.especialidade}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Metrics */}
      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 animate-pulse">
            {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-slate-900/50 border border-slate-800 rounded-2xl" />)}
          </div>
          <div className="grid grid-cols-2 gap-4 animate-pulse">
            {[...Array(2)].map((_, i) => <div key={i} className="h-24 bg-slate-900/50 border border-slate-800 rounded-2xl" />)}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Linha 1 — agendamentos */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-400 shrink-0"><Inbox className="h-5 w-5" /></div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Novos pedidos</p>
                <h3 className="text-xl font-extrabold text-white mt-0.5">{newLeads}</h3>
              </div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3">
              <div className="p-2.5 bg-purple-500/10 rounded-xl text-purple-400 shrink-0"><CalendarCheck className="h-5 w-5" /></div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Agendados</p>
                <h3 className="text-xl font-extrabold text-white mt-0.5">{scheduledLeads}</h3>
              </div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400 shrink-0"><CheckCircle2 className="h-5 w-5" /></div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Atendidos no mês</p>
                <h3 className="text-xl font-extrabold text-white mt-0.5">{attendedThisMonth}</h3>
              </div>
            </div>
          </div>

          {/* Linha 2 — faturamento */}
          <div className="grid grid-cols-2 gap-4 items-stretch">
            {/* Faturamento Real */}
            <div className="rounded-2xl p-4 flex flex-col gap-3 bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/60 dark:border-emerald-800/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Faturamento Real</p>
                  <h3 className="text-lg font-extrabold mt-0.5 text-emerald-900 dark:text-emerald-50">{formatBRL(realRevenue)}</h3>
                  <p className="text-[10px] mt-0.5 text-emerald-600 dark:text-emerald-400">{revenueAtendidos.length} atendimento{revenueAtendidos.length !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <div className="flex gap-1 flex-wrap">
                {(["hoje", "semana", "mes", "ano"] as const).map(f => (
                  <button key={f} onClick={() => setRevenueFilter(f)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                      revenueFilter === f
                        ? "bg-emerald-600 border-emerald-700 text-white dark:bg-emerald-600 dark:border-emerald-700"
                        : "bg-transparent border-emerald-300 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700/50 dark:text-emerald-400 dark:hover:bg-emerald-900/40"
                    }`}>
                    {f === "hoje" ? "Hoje" : f === "semana" ? "Semana" : f === "mes" ? "Mês" : "Ano"}
                  </button>
                ))}
              </div>
            </div>

            {/* Faturamento Previsto */}
            <div className="rounded-2xl p-4 flex flex-col gap-3 bg-amber-50 border border-amber-200 dark:bg-amber-950/60 dark:border-amber-800/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                  <CalendarClock className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">Faturamento Previsto</p>
                  <h3 className="text-lg font-extrabold mt-0.5 text-amber-900 dark:text-amber-50">{formatBRL(projectedRevenue)}</h3>
                  <p className="text-[10px] mt-0.5 text-amber-600 dark:text-amber-400">{projectedCount} agendamento{projectedCount !== 1 ? "s" : ""} confirmado{projectedCount !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <div className="flex gap-1 flex-wrap">
                {(["amanha", "7d", "30d", "todos"] as const).map(f => (
                  <button key={f} onClick={() => setProjectionFilter(f)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                      projectionFilter === f
                        ? "bg-amber-600 border-amber-700 text-white dark:bg-amber-600 dark:border-amber-700"
                        : "bg-transparent border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700/50 dark:text-amber-400 dark:hover:bg-amber-900/40"
                    }`}>
                    {f === "amanha" ? "Amanhã" : f === "7d" ? "7 dias" : f === "30d" ? "30 dias" : "Todos"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Histórico mensal */}
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Histórico — últimos 4 meses</p>
            <div className="grid grid-cols-4 gap-3">
              {monthlyHistory.map(m => (
                <div key={m.key} className={`rounded-xl p-3 text-center ${m.key === thisMonthStr ? "bg-indigo-500/10 border border-indigo-500/20" : "bg-slate-900/60 border border-slate-800/40"}`}>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{m.label}</p>
                  <p className="text-base font-extrabold text-white mt-1">{m.count}</p>
                  <p className="text-[10px] text-slate-500">atend.</p>
                  {m.real > 0 && (
                    <p className="text-[10px] font-semibold text-emerald-400 mt-1">{formatBRL(m.real)}</p>
                  )}
                  {m.real === 0 && (
                    <p className="text-[10px] text-slate-600 mt-1">—</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {statusError && (
        <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{statusError}</span>
          <button onClick={() => setStatusError(null)} className="ml-auto text-red-400/60 hover:text-red-300 text-xs">✕</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-4 md:p-6 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="relative flex-1 max-w-md" ref={searchRef}>
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <Search className="h-5 w-5" />
            </span>
            <input
              type="text"
              placeholder="Buscar por nome, telefone ou serviço..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800/80 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-100 text-sm transition-all"
            />
            {showSuggestions && searchSuggestions.length > 0 && (
              <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-xl overflow-hidden">
                {searchSuggestions.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    onMouseDown={() => { setSearchTerm(lead.nome); setShowSuggestions(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800 transition-colors text-left"
                  >
                    <Search className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-200 truncate">{lead.nome}</p>
                      <p className="text-xs text-slate-500 truncate">{lead.servicoEscolhido} · {lead.telefone}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800/80 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:border-indigo-500 text-slate-300"
            >
              <option value="Todos">Todos os Status</option>
              {statusOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col justify-center items-center py-12">
            <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
            <p className="mt-4 text-slate-400 font-medium">Buscando leads...</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="flex flex-col justify-center items-center py-16 text-center border-2 border-dashed border-slate-800/80 rounded-2xl">
            <div className="p-4 bg-slate-900 rounded-full text-slate-600 mb-4"><Inbox className="h-8 w-8" /></div>
            <h3 className="text-lg font-bold text-slate-300">Nenhum contato encontrado</h3>
            <p className="text-slate-500 text-sm mt-1 max-w-sm">
              {searchTerm || statusFilter !== "Todos"
                ? "Tente mudar os filtros de busca para encontrar outros contatos."
                : "Os leads dos clientes aparecerão aqui conforme chegarem."}
            </p>
          </div>
        ) : (
          <>
          <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/20">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/40 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4 font-bold">Cliente</th>
                  {activeProfId === "all" && hasTeam && (
                    <th className="py-3.5 px-4 font-bold">Profissional</th>
                  )}
                  <th className="py-3.5 px-4 font-bold">Serviço Solicitado</th>
                  <th className="py-3.5 px-4 font-bold">Horário</th>
                  <th className="py-3.5 px-4 font-bold">Status</th>
                  <th className="py-3.5 px-4 font-bold text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredLeads.map((lead) => {
                  const templates = profile?.messageTemplates ?? {};
                  const isPresencial = profile?.serviceLocationType === "physical" || profile?.serviceLocationType === "both";
                  const addr = isPresencial && profile?.publicAddress?.street
                    ? [profile.publicAddress.street + (profile.publicAddress.number ? ", " + profile.publicAddress.number : ""), profile.publicAddress.city, profile.publicAddress.state].filter(Boolean).join(" - ")
                    : undefined;
                  const buildMsg = (status: string, fallback: string) => {
                    const tpl = templates[status] || fallback;
                    return tpl
                      .replace(/{nome}/g, lead.nome)
                      .replace(/{servico}/g, lead.servicoEscolhido)
                      .replace(/{data}/g, formatDate(lead.dataEscolhida))
                      .replace(/{horario}/g, lead.horarioEscolhido)
                      .replace(/{profissional}/g, profile?.nomeNegocio || profile?.nome || "")
                      .replace(addr ? /{endereco}/g : /,?\s*{endereco}/g, addr ?? "")
                      .trim();
                  };
                  const msgText = buildMsg(lead.status, `Olá ${lead.nome}, recebi seu pedido para o serviço "${lead.servicoEscolhido}" em ${formatDate(lead.dataEscolhida)} às ${lead.horarioEscolhido}. Vamos confirmar?`);
                  const whatsappChatUrl = getWhatsAppLink(lead.telefone, msgText);
                  const cancelMsgText = buildMsg("Cancelado", `Olá ${lead.nome}, precisamos cancelar o agendamento de "${lead.servicoEscolhido}" previsto para ${formatDate(lead.dataEscolhida)} às ${lead.horarioEscolhido}. Lamentamos o inconveniente. Entre em contato para remarcar!`);
                  const whatsappCancelUrl = getWhatsAppLink(lead.telefone, cancelMsgText);
                  const currentStatus = statusOptions.find(o => o.value === lead.status) || statusOptions[0];
                  const isOwnerLead = lead.professionalId === user?.uid;

                  return (
                    <tr key={`${lead.professionalId}:${lead.id}`} className="hover:bg-slate-900/20 transition-colors text-sm group">
                      {/* Cliente */}
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-200">{lead.nome}</div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">{formatPhoneFriendly(lead.telefone)}</div>
                        {lead.observacao && (
                          <div className="mt-1 text-xs text-slate-400 bg-slate-900/60 p-2 rounded-lg max-w-xs border border-slate-800/30">
                            <span className="font-semibold text-[10px] text-slate-500 uppercase tracking-wide block mb-0.5">Obs:</span>
                            {lead.observacao}
                          </div>
                        )}
                      </td>

                      {/* Coluna Profissional — só na visão "Todos" */}
                      {activeProfId === "all" && hasTeam && (
                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-lg border ${isOwnerLead ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400" : "bg-amber-500/10 border-amber-500/20 text-amber-400"}`}>
                            {isOwnerLead ? <Building2 className="h-3 w-3" /> : <User className="h-3 w-3" />}
                            {lead._profNome ?? (isOwnerLead ? "Estabelecimento" : "Membro")}
                          </span>
                        </td>
                      )}

                      {/* Serviço */}
                      <td className="py-4 px-4 text-slate-300 font-medium">{lead.servicoEscolhido}</td>

                      {/* Horário */}
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-200">{formatDate(lead.dataEscolhida)}</div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">{lead.horarioEscolhido}</div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        <div className="relative inline-flex items-center">
                          <select
                            value={lead.status}
                            disabled={updatingLeadId === lead.id}
                            onChange={(e) => handleUpdateStatus(lead, e.target.value as LeadStatus)}
                            className={`pl-3 pr-7 py-1.5 rounded-full text-xs font-semibold border focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all ${updatingLeadId === lead.id ? "opacity-50 cursor-wait" : "cursor-pointer"} ${currentStatus.color}`}
                          >
                            {statusOptions.map(opt => (
                              <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-300">{opt.label}</option>
                            ))}
                          </select>
                          {updatingLeadId === lead.id && (
                            <Loader2 className="absolute right-1.5 h-3 w-3 animate-spin text-current pointer-events-none" />
                          )}
                        </div>
                      </td>

                      {/* Ações */}
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <a
                            href={whatsappChatUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg transition-all"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span>Conversar</span>
                          </a>
                          {lead.status === "Cancelado" && (
                            <a
                              href={whatsappCancelUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-2 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white font-semibold text-xs rounded-lg border border-red-500/30 hover:border-red-500 transition-all"
                              title="Notificar cancelamento via WhatsApp"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              <span>Notificar</span>
                            </a>
                          )}
                          <button
                            onClick={() => setRescheduleModal({
                              leadId: lead.id,
                              nome: lead.nome,
                              data: lead.dataEscolhida,
                              inicio: lead.horarioEscolhido,
                              fim: (lead as any).horarioFim ?? lead.horarioEscolhido,
                              profId: lead.professionalId || user!.uid,
                            })}
                            className="inline-flex items-center gap-1 px-3 py-2 bg-amber-500/15 hover:bg-amber-500 text-amber-400 hover:text-white font-semibold text-xs rounded-lg border border-amber-500/30 hover:border-amber-500 transition-all"
                            title="Reagendar"
                          >
                            <CalendarClock className="h-3.5 w-3.5" />
                            <span>Reagendar</span>
                          </button>
                          <button
                            onClick={() => handleDeleteLead(lead)}
                            className="p-2 bg-slate-900 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-lg border border-slate-800/80 hover:border-red-500/20 transition-all opacity-40 group-hover:opacity-100"
                            title="Excluir Lead"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Carregar mais — aparece se o número de leads retornados atingiu o limite */}
          {leads.length >= leadsLimit && (
            <div className="flex justify-center pt-2 pb-1">
              <button
                onClick={() => setLeadsLimit(l => l + 50)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-400 hover:text-slate-200 bg-slate-900/60 hover:bg-slate-800 border border-slate-800 rounded-xl transition-all"
              >
                Carregar mais leads
              </button>
            </div>
          )}
          </>
        )}
      </div>
    </div>

    {/* Modal Reagendar */}
    {rescheduleModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-slate-100">Reagendar</h2>
              <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[220px]">{rescheduleModal.nome}</p>
            </div>
            <button onClick={() => { setRescheduleModal(null); setRescheduleError(null); }} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleReschedule} className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Nova Data</label>
              <input type="date" required value={rescheduleModal.data}
                onChange={(e) => setRescheduleModal(m => m ? { ...m, data: e.target.value } : m)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Início</label>
                <input type="time" required value={rescheduleModal.inicio}
                  onChange={(e) => setRescheduleModal(m => m ? { ...m, inicio: e.target.value } : m)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Fim</label>
                <input type="time" required value={rescheduleModal.fim}
                  onChange={(e) => setRescheduleModal(m => m ? { ...m, fim: e.target.value } : m)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
            </div>
            {rescheduleError && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{rescheduleError}</p>
            )}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => { setRescheduleModal(null); setRescheduleError(null); }}
                className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg border border-slate-700 transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={rescheduleLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-wait text-white text-sm font-semibold rounded-lg transition-colors">
                {rescheduleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
                Salvar
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
    </>
  );
}
