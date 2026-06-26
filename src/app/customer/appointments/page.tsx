"use client";

import React, { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "../../providers";
import { formatDateFriendlySaoPaulo } from "@/lib/timezone";
import {
  CalendarCheck, Clock, Briefcase, MapPin, ChevronRight,
  Loader2, CalendarX, ExternalLink, XCircle,
} from "lucide-react";
import Link from "next/link";
import { useAppModal } from "@/components/ModalProvider";

interface CustomerBooking {
  bookingId: string;
  professionalId: string;
  professionalName: string;
  professionalSlug: string;
  serviceName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  sourcePath: string;
  updatedAt: any;
}

const STATUS_STYLES: Record<string, { label: string; classes: string }> = {
  Novo:        { label: "Novo",           classes: "bg-cyan-500/15 text-cyan-300 border-cyan-500/20" },
  "Em contato":{ label: "Em contato",    classes: "bg-yellow-500/15 text-yellow-300 border-yellow-500/20" },
  Agendado:    { label: "Confirmado",     classes: "bg-blue-500/15 text-blue-300 border-blue-500/20" },
  Atendido:    { label: "Concluído",      classes: "bg-violet-500/15 text-violet-300 border-violet-500/20" },
  Cancelado:   { label: "Cancelado",      classes: "bg-red-500/15 text-red-400 border-red-500/20" },
  Perdido:     { label: "Não realizado",  classes: "bg-orange-500/15 text-orange-300 border-orange-500/20" },
};

const CANCELLABLE = new Set(["Novo", "Em contato", "Agendado"]);

export default function CustomerAppointmentsPage() {
  const { user, loading } = useAuth();
  const { showConfirmationModal } = useAppModal();
  const [bookings, setBookings] = useState<CustomerBooking[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const ref = collection(db, "customerAccounts", user.uid, "bookings");
    const q = query(ref, orderBy("date", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setBookings(snap.docs.map((d) => ({ bookingId: d.id, ...d.data() } as CustomerBooking)));
        setListLoading(false);
      },
      () => setListLoading(false)
    );
    return () => unsub();
  }, [user]);

  const handleCancel = (booking: CustomerBooking) => {
    showConfirmationModal({
      title: "Cancelar agendamento",
      description: `Deseja cancelar "${booking.serviceName}" com ${booking.professionalName} em ${formatDateFriendlySaoPaulo(booking.date)} às ${booking.startTime}? O horário ficará disponível para outros clientes.`,
      confirmLabel: "Cancelar agendamento",
      cancelLabel: "Voltar",
      variant: "danger",
      onConfirm: async () => {
        setCancellingId(booking.bookingId);
        try {
          const token = await user!.getIdToken();
          const res = await fetch(`/api/customer/cancel/${booking.bookingId}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error ?? "Erro ao cancelar.");
          }
        } finally {
          setCancellingId(null);
        }
      },
    });
  };

  if (loading || listLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
        <p className="mt-4 text-slate-400 text-sm">Carregando agendamentos...</p>
      </div>
    );
  }

  const today = new Date().toISOString().split("T")[0];
  const upcoming = bookings.filter(
    (b) => b.date >= today && !["Cancelado", "Perdido", "Atendido"].includes(b.status)
  );
  const past = bookings.filter(
    (b) => b.date < today || ["Cancelado", "Perdido", "Atendido"].includes(b.status)
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <CalendarCheck className="h-6 w-6 text-emerald-400" />
          Meus agendamentos
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Todos os seus horários marcados com profissionais.
        </p>
      </div>

      {bookings.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {upcoming.length > 0 && (
            <Section title="Próximos" bookings={upcoming} onCancel={handleCancel} cancellingId={cancellingId} />
          )}
          {past.length > 0 && (
            <Section title="Histórico" bookings={past} muted />
          )}
        </>
      )}
    </div>
  );
}

function Section({
  title, bookings, muted, onCancel, cancellingId,
}: {
  title: string;
  bookings: CustomerBooking[];
  muted?: boolean;
  onCancel?: (b: CustomerBooking) => void;
  cancellingId?: string | null;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">{title}</p>
      <div className="space-y-3">
        {bookings.map((b) => (
          <BookingCard
            key={b.bookingId}
            booking={b}
            muted={muted}
            onCancel={onCancel}
            cancelling={cancellingId === b.bookingId}
          />
        ))}
      </div>
    </div>
  );
}

function BookingCard({
  booking: b, muted, onCancel, cancelling,
}: {
  booking: CustomerBooking;
  muted?: boolean;
  onCancel?: (b: CustomerBooking) => void;
  cancelling?: boolean;
}) {
  const style = STATUS_STYLES[b.status] ?? { label: b.status, classes: "bg-slate-800 text-slate-400 border-slate-700" };
  const canCancel = CANCELLABLE.has(b.status) && !!onCancel;

  return (
    <div className={`p-4 rounded-2xl border transition-all ${muted ? "bg-slate-900/30 border-slate-800/60" : "bg-slate-900/60 border-slate-800"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${style.classes}`}>
              {style.label}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Briefcase className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            <p className="font-semibold text-slate-100 text-sm truncate">{b.serviceName}</p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
            <span className="font-medium text-indigo-300">{b.professionalName}</span>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <CalendarCheck className="h-3.5 w-3.5" />
              <span>{formatDateFriendlySaoPaulo(b.date)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span>{b.startTime}{b.endTime ? ` – ${b.endTime}` : ""}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          {b.professionalSlug && (
            <Link
              href={`/p/${b.professionalSlug}`}
              target="_blank"
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-400 transition-colors"
              title="Ver página do profissional"
            >
              <ExternalLink className="h-4 w-4" />
            </Link>
          )}

          {canCancel && (
            <button
              onClick={() => onCancel(b)}
              disabled={cancelling}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-red-400 hover:text-white bg-red-500/10 hover:bg-red-600 border border-red-500/20 hover:border-red-600 rounded-lg transition-all disabled:opacity-50 disabled:cursor-wait"
            >
              {cancelling ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              <span>Cancelar</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
      <div className="h-16 w-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
        <CalendarX className="h-8 w-8 text-slate-600" />
      </div>
      <div>
        <p className="font-bold text-slate-300">Nenhum agendamento ainda</p>
        <p className="text-slate-500 text-sm mt-1">
          Acesse a página de um profissional para fazer seu primeiro agendamento.
        </p>
      </div>
      <Link
        href="/portal"
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all"
      >
        Voltar ao portal <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
