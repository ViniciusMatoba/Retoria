"use client";

import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Calendar as CalendarIcon, Check, LayoutDashboard, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "../../providers";
import { getSaoPauloToday, isPastDateTimeSaoPaulo } from "@/lib/timezone";
import GoogleCalendarIntegration from "../components/GoogleCalendarIntegration";

interface SlotRow {
  data: string;
  horario: string;
  disponivel: boolean;
}

// Resumo da agenda e funcionalidades importantes (Google Agenda), separados da tela de Horários,
// que fica só com o calendário.
export default function ResumoPage() {
  const { user } = useAuth();
  const [slots, setSlots] = useState<SlotRow[] | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "professionals", user.uid, "availableSlots"), where("data", ">=", getSaoPauloToday()));
    return onSnapshot(
      q,
      (snap) => setSlots(snap.docs.map((d) => ({ data: d.data().data, horario: d.data().horario, disponivel: d.data().disponivel === true }))),
      (err) => {
        console.error("Erro ao carregar horários:", err);
        setSlots([]);
      }
    );
  }, [user]);

  // Só horários de agora em diante (os de hoje que já passaram não contam)
  const upcoming = (slots ?? []).filter((s) => !isPastDateTimeSaoPaulo(s.data, s.horario));
  const free = upcoming.filter((s) => s.disponivel).length;
  const busy = upcoming.length - free;
  const loading = slots === null;

  const cards = [
    { label: "Horários livres", value: free, hint: "Livres para agendamento a partir de agora.", color: "text-emerald-400", icon: Check, iconColor: "text-emerald-500/10" },
    { label: "Horários ocupados / reservados", value: busy, hint: "Agendados ou bloqueados a partir de agora.", color: "text-amber-500", icon: X, iconColor: "text-amber-500/10" },
    { label: "Total de horários na agenda", value: upcoming.length, hint: "Todos os horários futuros cadastrados.", color: "text-indigo-400", icon: CalendarIcon, iconColor: "text-indigo-500/10" },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6 text-indigo-400" />
          Resumo da Agenda
        </h1>
        <p className="text-sm text-slate-400 mt-1">Números dos seus horários e integrações importantes.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map(({ label, value, hint, color, icon: Icon, iconColor }) => (
          <div key={label} className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl backdrop-blur-sm relative overflow-hidden">
            <div className={`absolute top-0 right-0 p-3 ${iconColor}`}><Icon className="h-16 w-16" /></div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</span>
            <h3 className={`text-3xl font-black mt-2 ${color}`}>{loading ? "…" : value}</h3>
            <p className="text-[11px] text-slate-400 mt-1">{hint}</p>
          </div>
        ))}
      </div>

      <div className="relative rounded-3xl overflow-hidden shadow-xl" style={{ background: "linear-gradient(135deg,#1e3a5f 0%,#1e2d5a 60%,#2d1b6e 100%)", border: "2px solid #3b82f6" }}>
        <div className="flex items-center gap-2 px-5 pt-4 pb-2">
          <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full" style={{ background: "#2563eb", color: "#fff", boxShadow: "0 0 12px rgba(59,130,246,0.5)" }}>
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            Funcionalidade Importante
          </span>
        </div>
        <div className="px-3 pb-3">
          <GoogleCalendarIntegration />
        </div>
      </div>
    </div>
  );
}
