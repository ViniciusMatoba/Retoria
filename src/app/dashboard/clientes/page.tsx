"use client";

import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { BookUser, MessageCircle, Search } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "../../providers";
import { formatPhoneFriendly, getWhatsAppLink } from "@/lib/whatsapp";

interface CustomerRow {
  id: string;
  nome: string;
  telefone: string;
  lastBookingDate?: string;
  hasAccount: boolean;
}

const formatDate = (d?: string) => {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return y && m && day ? `${day}/${m}/${y}` : d;
};

export default function ClientesPage() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(collection(db, "professionals", user.uid, "customers"));
        if (cancelled) return;
        const rows: CustomerRow[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            nome: data.nome ?? "",
            telefone: data.telefone ?? "",
            lastBookingDate: data.lastBookingDate,
            hasAccount: !!data.customerUid,
          };
        });
        rows.sort((a, b) => (b.lastBookingDate ?? "").localeCompare(a.lastBookingDate ?? ""));
        setCustomers(rows);
      } catch (e) {
        console.error("Erro ao carregar clientes:", e);
        if (!cancelled) setError("Não foi possível carregar os clientes. Tente novamente.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const digits = term.replace(/\D/g, "");
    if (!term) return customers;
    return customers.filter(
      (c) => c.nome.toLowerCase().includes(term) || (digits && c.telefone.includes(digits))
    );
  }, [customers, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <BookUser className="h-6 w-6 text-indigo-400" />
          Clientes
        </h1>
        <p className="text-sm text-slate-400 mt-1">Pessoas que já agendaram com você.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou telefone"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

      {loading ? (
        <p className="text-sm text-slate-400">Carregando clientes...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 p-10 text-center text-sm text-slate-400">
          {customers.length === 0 ? "Nenhum cliente ainda. Eles aparecem aqui após o primeiro agendamento." : "Nenhum cliente encontrado para essa busca."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800 divide-y divide-slate-800/60">
          {filtered.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 p-4 bg-slate-900/30">
              <div className="min-w-0">
                <div className="font-semibold text-slate-200 truncate">{c.nome || "Sem nome"}</div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">{formatPhoneFriendly(c.telefone)}</div>
                <div className="text-xs text-slate-500 mt-0.5">Último agendamento: {formatDate(c.lastBookingDate)}</div>
              </div>
              <a
                href={getWhatsAppLink(c.telefone, `Olá ${c.nome.split(" ")[0]}!`)}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-slate-700 hover:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
