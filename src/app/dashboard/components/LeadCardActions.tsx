"use client";

import { useState } from "react";
import { CalendarClock, Loader2, MessageSquare, MoveVertical, Trash2 } from "lucide-react";
import { useAuth } from "@/app/providers";
import { useAppModal } from "@/components/ModalProvider";
import { getWhatsAppLink } from "@/lib/whatsapp";

const STATUS_OPTIONS = [
  { value: "Novo", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { value: "Em contato", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  { value: "Agendado", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  { value: "Atendido", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  { value: "Cancelado", color: "bg-red-500/10 text-red-400 border-red-500/20" },
  { value: "Perdido", color: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
];

const ACTIVE = ["Novo", "Em contato", "Agendado"];

const formatDate = (d?: string) => {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return y && m && day ? `${day}/${m}/${y}` : d;
};

interface Props {
  lead: any;
  profId: string;
  moving: boolean;
  onReschedule: (lead: any) => void;
  onMove: (lead: any) => void;
  onError: (msg: string) => void;
}

// Ações rápidas de um agendamento dentro do cartão da agenda diária:
// status, conversar no WhatsApp, reagendar, mover para outro horário livre e cancelar.
export default function LeadCardActions({ lead, profId, moving, onReschedule, onMove, onError }: Props) {
  const { user, profile } = useAuth();
  const { showConfirmationModal } = useAppModal();
  const [updating, setUpdating] = useState(false);

  const templates = (profile as any)?.messageTemplates ?? {};
  const pa = (profile as any)?.publicAddress;
  const isPresencial = (profile as any)?.serviceLocationType === "physical" || (profile as any)?.serviceLocationType === "both";
  const addr = isPresencial && pa?.street
    ? [pa.street + (pa.number ? ", " + pa.number : ""), pa.city, pa.state].filter(Boolean).join(" - ")
    : undefined;

  const msgText = (() => {
    const fallback = `Olá ${lead.nome}, recebi seu pedido para o serviço "${lead.servicoEscolhido}" em ${formatDate(lead.dataEscolhida)} às ${lead.horarioEscolhido}. Vamos confirmar?`;
    return (templates[lead.status] || fallback)
      .replace(/{nome}/g, lead.nome)
      .replace(/{servico}/g, lead.servicoEscolhido)
      .replace(/{data}/g, formatDate(lead.dataEscolhida))
      .replace(/{horario}/g, lead.horarioEscolhido)
      .replace(/{profissional}/g, (profile as any)?.nomeNegocio || (profile as any)?.nome || "")
      .replace(addr ? /{endereco}/g : /,?\s*{endereco}/g, addr ?? "")
      .trim();
  })();

  const updateStatus = async (newStatus: string) => {
    if (!user || updating) return;
    setUpdating(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/professionals/${profId}/leads/${lead.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Erro HTTP ${res.status}`);
      }
    } catch (e: any) {
      onError(e.message ?? "Erro ao atualizar status.");
    } finally {
      setUpdating(false);
    }
  };

  const confirmCancel = () => {
    showConfirmationModal({
      title: "Cancelar agendamento",
      description: `Deseja cancelar o agendamento de "${lead.nome}" e liberar o horário? O histórico do cliente será mantido.`,
      confirmLabel: "Cancelar agendamento",
      cancelLabel: "Voltar",
      variant: "danger",
      onConfirm: async () => { await updateStatus("Cancelado"); },
    });
  };

  const current = STATUS_OPTIONS.find((o) => o.value === lead.status) ?? STATUS_OPTIONS[0];
  const isActive = ACTIVE.includes(lead.status);
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div className="flex flex-wrap items-center gap-2 mt-3" onClick={stop}>
      <div className="relative inline-flex items-center">
        <select
          value={lead.status}
          disabled={updating}
          onChange={(e) => updateStatus(e.target.value)}
          aria-label="Status do agendamento"
          className={`pl-3 pr-6 py-1.5 rounded-full text-xs font-semibold border focus:outline-none ${updating ? "opacity-50" : "cursor-pointer"} ${current.color}`}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} className="bg-slate-900 text-slate-300">{o.value}</option>
          ))}
        </select>
        {updating && <Loader2 className="absolute right-1.5 h-3 w-3 animate-spin pointer-events-none" />}
      </div>

      <a
        href={getWhatsAppLink(lead.telefone, msgText)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        <span>Conversar</span>
      </a>

      {isActive && (
        <>
          <button
            type="button"
            onClick={() => onReschedule(lead)}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500 text-amber-400 hover:text-white font-semibold text-xs rounded-lg border border-amber-500/30"
          >
            <CalendarClock className="h-3.5 w-3.5" />
            <span>Reagendar</span>
          </button>
          <button
            type="button"
            onClick={() => onMove(lead)}
            className={`inline-flex items-center gap-1 px-3 py-1.5 font-semibold text-xs rounded-lg border ${moving ? "bg-indigo-600 text-white border-indigo-500" : "bg-indigo-500/10 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/20"}`}
          >
            <MoveVertical className="h-3.5 w-3.5" />
            <span>{moving ? "Escolha o horário…" : "Mover"}</span>
          </button>
          <button
            type="button"
            onClick={confirmCancel}
            title="Cancelar agendamento e liberar horário"
            aria-label="Cancelar agendamento e liberar horário"
            className="p-1.5 bg-slate-900 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-lg border border-slate-800"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
}
