"use client";

import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { BookUser, ChevronDown, ChevronUp, MessageCircle, Search } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "../../providers";
import { formatPhoneFriendly, getWhatsAppLink } from "@/lib/whatsapp";

interface LeadRow {
  id: string;
  telefone: string;
  nome: string;
  servicoEscolhido: string;
  dataEscolhida: string;
  horarioEscolhido: string;
  status: string;
  valorTotal: number;
}

interface CustomerRow {
  id: string;
  nome: string;
  telefone: string;
  lastBookingDate?: string;
}

const formatDate = (d?: string) => {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return y && m && day ? `${day}/${m}/${y}` : d;
};

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const STATUS_STYLE: Record<string, string> = {
  Atendido: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Cancelado: "bg-red-500/10 text-red-400 border-red-500/20",
  Perdido: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  Agendado: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  Novo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  "Em contato": "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

export default function ClientesPage() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const [custSnap, leadSnap] = await Promise.all([
          getDocs(collection(db, "professionals", user.uid, "customers")),
          getDocs(collection(db, "professionals", user.uid, "leads")),
        ]);
        if (cancelled) return;

        const leadRows: LeadRow[] = leadSnap.docs.map((d) => {
          const x = d.data();
          return {
            id: d.id,
            telefone: String(x.telefone ?? "").replace(/\D/g, ""),
            nome: x.nome ?? "",
            servicoEscolhido: x.servicoEscolhido ?? "",
            dataEscolhida: x.dataEscolhida ?? "",
            horarioEscolhido: x.horarioEscolhido ?? "",
            status: x.status ?? "Novo",
            valorTotal: typeof x.valorTotal === "number" ? x.valorTotal : 0,
          };
        });

        // Clientes: cadastro automático + qualquer telefone que só exista nos leads (histórico antigo)
        const byPhone = new Map<string, CustomerRow>();
        custSnap.docs.forEach((d) => {
          const x = d.data();
          const phone = String(x.telefone ?? "").replace(/\D/g, "");
          if (!phone) return;
          const prev = byPhone.get(phone);
          if (!prev || (x.lastBookingDate ?? "") > (prev.lastBookingDate ?? "")) {
            byPhone.set(phone, { id: phone, nome: x.nome ?? "", telefone: phone, lastBookingDate: x.lastBookingDate });
          }
        });
        leadRows.forEach((l) => {
          if (!l.telefone) return;
          const prev = byPhone.get(l.telefone);
          if (!prev) {
            byPhone.set(l.telefone, { id: l.telefone, nome: l.nome, telefone: l.telefone, lastBookingDate: l.dataEscolhida });
          } else if (l.dataEscolhida > (prev.lastBookingDate ?? "")) {
            prev.lastBookingDate = l.dataEscolhida;
          }
        });

        const rows = [...byPhone.values()].sort((a, b) => (b.lastBookingDate ?? "").localeCompare(a.lastBookingDate ?? ""));
        setLeads(leadRows);
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

  const leadsByPhone = useMemo(() => {
    const map = new Map<string, LeadRow[]>();
    leads.forEach((l) => {
      if (!l.telefone) return;
      const list = map.get(l.telefone) ?? [];
      list.push(l);
      map.set(l.telefone, list);
    });
    map.forEach((list) =>
      list.sort((a, b) => `${b.dataEscolhida} ${b.horarioEscolhido}`.localeCompare(`${a.dataEscolhida} ${a.horarioEscolhido}`))
    );
    return map;
  }, [leads]);

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
        <p className="text-sm text-slate-400 mt-1">Toque em um cliente para ver o histórico de agendamentos e o valor gasto.</p>
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
          {filtered.map((c) => {
            const history = leadsByPhone.get(c.telefone) ?? [];
            const done = history.filter((l) => l.status === "Atendido");
            const canceled = history.filter((l) => l.status === "Cancelado" || l.status === "Perdido");
            const spent = done.reduce((sum, l) => sum + l.valorTotal, 0);
            const isOpen = openId === c.id;

            const servicesDone = new Map<string, number>();
            done.forEach((l) => {
              if (!l.servicoEscolhido) return;
              servicesDone.set(l.servicoEscolhido, (servicesDone.get(l.servicoEscolhido) ?? 0) + 1);
            });

            return (
              <div key={c.id} className="bg-slate-900/30">
                <div className="flex items-center justify-between gap-3 p-4">
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : c.id)}
                    className="min-w-0 flex-1 text-left"
                    aria-expanded={isOpen}
                  >
                    <div className="font-semibold text-slate-200 truncate">{c.nome || "Sem nome"}</div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">{formatPhoneFriendly(c.telefone)}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {history.length} agendamento(s) · {done.length} concluído(s) · {canceled.length} cancelado(s) · Gasto: {brl(spent)}
                    </div>
                  </button>
                  <a
                    href={getWhatsAppLink(c.telefone, `Olá ${c.nome.split(" ")[0]}!`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-slate-700 hover:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200"
                  >
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </a>
                  <button type="button" onClick={() => setOpenId(isOpen ? null : c.id)} className="shrink-0 text-slate-400" aria-label="Ver histórico">
                    {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </button>
                </div>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-4">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-slate-950/50 border border-slate-800 p-3">
                        <div className="text-lg font-bold text-emerald-400">{done.length}</div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-500">Concluídos</div>
                      </div>
                      <div className="rounded-xl bg-slate-950/50 border border-slate-800 p-3">
                        <div className="text-lg font-bold text-red-400">{canceled.length}</div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-500">Cancelados</div>
                      </div>
                      <div className="rounded-xl bg-slate-950/50 border border-slate-800 p-3">
                        <div className="text-lg font-bold text-slate-100">{brl(spent)}</div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-500">Valor gasto</div>
                      </div>
                    </div>

                    {servicesDone.size > 0 && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Serviços já realizados</div>
                        <div className="flex flex-wrap gap-1.5">
                          {[...servicesDone.entries()].map(([name, count]) => (
                            <span key={name} className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">
                              {name}{count > 1 ? ` ×${count}` : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Histórico de agendamentos</div>
                      {history.length === 0 ? (
                        <p className="text-xs text-slate-500">Nenhum agendamento encontrado.</p>
                      ) : (
                        <div className="divide-y divide-slate-800/60 rounded-xl border border-slate-800">
                          {history.map((l) => (
                            <div key={l.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                              <div className="min-w-0">
                                <div className="text-slate-200 truncate">{l.servicoEscolhido || "Serviço"}</div>
                                <div className="text-xs text-slate-500">{formatDate(l.dataEscolhida)} às {l.horarioEscolhido}{l.valorTotal > 0 ? ` · ${brl(l.valorTotal)}` : ""}</div>
                              </div>
                              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[l.status] ?? STATUS_STYLE.Novo}`}>
                                {l.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
