"use client";

import React, { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "../providers";
import { formatPhoneFriendly, getWhatsAppLink } from "@/lib/whatsapp";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/leadTypes";
import {
  Search,
  Filter,
  MessageSquare,
  Trash2,
  Clock,
  CalendarCheck,
  TrendingUp,
  Inbox,
  AlertCircle,
  Loader2,
  CalendarClock,
  X,
} from "lucide-react";

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
  createdAt: any;
  updatedAt: any;
}

const statusOptions = [
  { value: "Novo",        label: "Novo",        color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { value: "Em contato",  label: "Em contato",  color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  { value: "Agendado",    label: "Agendado",    color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  { value: "Atendido",    label: "Atendido",    color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  { value: "Cancelado",   label: "Cancelado",   color: "bg-red-500/10 text-red-400 border-red-500/20" },
  { value: "Perdido",     label: "Perdido",     color: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
] satisfies { value: LeadStatus; label: string; color: string }[];

export default function DashboardHome() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  // Per-lead loading state and inline error for status changes
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Modal de reagendamento
  const [rescheduleModal, setRescheduleModal] = useState<{
    leadId: string; nome: string; data: string; inicio: string; fim: string;
  } | null>(null);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  // Real-time subscription to Leads
  useEffect(() => {
    if (!user) return;

    const leadsRef = collection(db, "professionals", user.uid, "leads");
    const q = query(leadsRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const leadsData: Lead[] = [];
      snapshot.forEach((doc) => {
        leadsData.push({ id: doc.id, ...doc.data() } as Lead);
      });
      setLeads(leadsData);
      setLoading(false);
    }, (error) => {
      console.error("Error loading leads:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Update Lead Status — via endpoint seguro que sincroniza lead + índice do cliente atomicamente
  const handleUpdateStatus = async (leadId: string, newStatus: LeadStatus) => {
    if (!user || updatingLeadId) return;
    setUpdatingLeadId(leadId);
    setStatusError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(
        `/api/professionals/${user.uid}/leads/${leadId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Erro HTTP ${res.status}`);
      }
      // onSnapshot reflete automaticamente a mudança — nenhuma atualização local necessária
    } catch (e: any) {
      console.error("Error updating lead status:", e);
      setStatusError(e.message ?? "Erro ao atualizar status.");
    } finally {
      setUpdatingLeadId(null);
    }
  };

  // Reagendar
  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !rescheduleModal) return;
    setRescheduleError(null);
    setRescheduleLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(
        `/api/professionals/${user.uid}/leads/${rescheduleModal.leadId}/reschedule`,
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

  // Delete Lead
  const handleDeleteLead = async (leadId: string) => {
    if (!user) return;
    if (!window.confirm("Deseja realmente excluir este contato?")) return;
    try {
      const leadDocRef = doc(db, "professionals", user.uid, "leads", leadId);
      await deleteDoc(leadDocRef);
    } catch (e) {
      console.error("Error deleting lead:", e);
    }
  };

  // Metrics calculations
  const totalLeads = leads.length;
  const newLeads = leads.filter(l => l.status === "Novo").length;
  const scheduledLeads = leads.filter(l => l.status === "Agendado").length;
  const convertedLeads = leads.filter(l => l.status === "Agendado" || l.status === "Atendido").length;
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

  // Filtered leads
  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      lead.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.telefone.includes(searchTerm) ||
      lead.servicoEscolhido.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesStatus = statusFilter === "Todos" || lead.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Format date helper: "2026-06-25" -> "25/06/2026"
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  return (
    <>
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Olá! Acompanhe seus agendamentos</h1>
          <p className="text-sm text-slate-400">Gerencie contatos e atualize os status de pré-atendimento.</p>
        </div>
      </div>


      {/* Metrics Dashboard */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-900/50 border border-slate-800 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Card 1: Total */}
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-4">
            <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400">
              <Inbox className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Leads</p>
              <h3 className="text-xl md:text-2xl font-extrabold text-white mt-0.5">{totalLeads}</h3>
            </div>
          </div>

          {/* Card 2: Novos */}
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Novos</p>
              <h3 className="text-xl md:text-2xl font-extrabold text-white mt-0.5">{newLeads}</h3>
            </div>
          </div>

          {/* Card 3: Agendados */}
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-4">
            <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
              <CalendarCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Agendados</p>
              <h3 className="text-xl md:text-2xl font-extrabold text-white mt-0.5">{scheduledLeads}</h3>
            </div>
          </div>

          {/* Card 4: Taxa de conversão */}
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Conversão</p>
              <h3 className="text-xl md:text-2xl font-extrabold text-white mt-0.5">{conversionRate}%</h3>
            </div>
          </div>
        </div>
      )}

      {/* Inline status error banner */}
      {statusError && (
        <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{statusError}</span>
          <button onClick={() => setStatusError(null)} className="ml-auto text-red-400/60 hover:text-red-300 text-xs">✕</button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-4 md:p-6 backdrop-blur-sm">
        {/* Filters and Search Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <Search className="h-5 w-5" />
            </span>
            <input
              type="text"
              placeholder="Buscar por nome, telefone ou serviço..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800/80 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-100 text-sm transition-all"
            />
          </div>

          {/* Filter Status */}
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

        {/* Lead Table / Grid */}
        {loading ? (
          <div className="flex flex-col justify-center items-center py-12">
            <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
            <p className="mt-4 text-slate-400 font-medium">Buscando leads...</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="flex flex-col justify-center items-center py-16 text-center border-2 border-dashed border-slate-800/80 rounded-2xl">
            <div className="p-4 bg-slate-900 rounded-full text-slate-600 mb-4">
              <Inbox className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-300">Nenhum contato encontrado</h3>
            <p className="text-slate-500 text-sm mt-1 max-w-sm">
              {searchTerm || statusFilter !== "Todos" 
                ? "Tente mudar os filtros de busca para encontrar outros contatos." 
                : "Os leads dos clientes cadastrados em sua página pública aparecerão aqui."
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/20">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/40 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4 font-bold">Cliente</th>
                  <th className="py-3.5 px-4 font-bold">Serviço Solicitado</th>
                  <th className="py-3.5 px-4 font-bold">Horário</th>
                  <th className="py-3.5 px-4 font-bold">Status</th>
                  <th className="py-3.5 px-4 font-bold text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredLeads.map((lead) => {
                  // Pre-filled quick response message
                  const msgText = `Olá ${lead.nome}, sou profissional da Retoria e recebi seu pedido para o serviço "${lead.servicoEscolhido}" em ${formatDate(lead.dataEscolhida)} às ${lead.horarioEscolhido}. Vamos confirmar?`;
                  const whatsappChatUrl = getWhatsAppLink(lead.telefone, msgText);
                  
                  const currentStatus = statusOptions.find(o => o.value === lead.status) || statusOptions[0];

                  return (
                    <tr key={lead.id} className="hover:bg-slate-900/20 transition-colors text-sm group">
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
                      
                      {/* Serviço */}
                      <td className="py-4 px-4 text-slate-300 font-medium">
                        {lead.servicoEscolhido}
                      </td>
                      
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
                            onChange={(e) => handleUpdateStatus(lead.id, e.target.value as LeadStatus)}
                            className={`
                              pl-3 pr-7 py-1.5 rounded-full text-xs font-semibold border focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all
                              ${updatingLeadId === lead.id ? "opacity-50 cursor-wait" : "cursor-pointer"}
                              ${currentStatus.color}
                            `}
                          >
                            {statusOptions.map(opt => (
                              <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-300">
                                {opt.label}
                              </option>
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
                          {/* WhatsApp Chat Button */}
                          <a
                            href={whatsappChatUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg transition-all shadow-md shadow-emerald-600/10 hover:shadow-emerald-600/20"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span>Conversar</span>
                          </a>

                          {/* Reagendar */}
                          <button
                            onClick={() => setRescheduleModal({
                              leadId: lead.id,
                              nome: lead.nome,
                              data: lead.dataEscolhida,
                              inicio: lead.horarioEscolhido,
                              fim: (lead as any).horarioFim ?? lead.horarioEscolhido,
                            })}
                            className="p-2 bg-slate-900 hover:bg-indigo-500/10 text-slate-500 hover:text-indigo-400 rounded-lg border border-slate-800/80 hover:border-indigo-500/20 transition-all opacity-40 group-hover:opacity-100"
                            title="Reagendar"
                          >
                            <CalendarClock className="h-4 w-4" />
                          </button>

                          {/* Delete Lead */}
                          <button
                            onClick={() => handleDeleteLead(lead.id)}
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
        )}
      </div>
    </div>

    {/* Modal Reagendar ─────────────────────────────────────────── */}
    {rescheduleModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-slate-100">Reagendar</h2>
              <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[220px]">{rescheduleModal.nome}</p>
            </div>
            <button
              onClick={() => { setRescheduleModal(null); setRescheduleError(null); }}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleReschedule} className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Nova Data</label>
              <input
                type="date"
                required
                value={rescheduleModal.data}
                onChange={(e) => setRescheduleModal(m => m ? { ...m, data: e.target.value } : m)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Início</label>
                <input
                  type="time"
                  required
                  value={rescheduleModal.inicio}
                  onChange={(e) => setRescheduleModal(m => m ? { ...m, inicio: e.target.value } : m)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Fim</label>
                <input
                  type="time"
                  required
                  value={rescheduleModal.fim}
                  onChange={(e) => setRescheduleModal(m => m ? { ...m, fim: e.target.value } : m)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            {rescheduleError && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {rescheduleError}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => { setRescheduleModal(null); setRescheduleError(null); }}
                className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg border border-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={rescheduleLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-wait text-white text-sm font-semibold rounded-lg transition-colors"
              >
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
