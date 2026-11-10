"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Package, Pencil, Plus, Repeat, Trash2, Wallet, X } from "lucide-react";
import { useAuth } from "../../providers";
import { useAppModal } from "@/components/ModalProvider";
import { getSaoPauloToday } from "@/lib/timezone";
import { getPeriod } from "@/lib/revenue";
import {
  COST_CATEGORIES, categoryLabel, pendingFixedItems, round2, summarizeCosts,
  type CostCategory, type Expense, type Material,
} from "@/lib/costs";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const ddmm = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;

// Sugestões para o primeiro cadastro (um toque preenche o formulário do item)
const SUGGESTIONS: { nome: string; categoria: CostCategory; unidade: string; fixo?: boolean }[] = [
  { nome: "Luvas", categoria: "materiais", unidade: "caixa" },
  { nome: "Henna", categoria: "materiais", unidade: "un" },
  { nome: "Papel higiênico", categoria: "higiene", unidade: "pacote" },
  { nome: "Sabonete", categoria: "higiene", unidade: "un" },
  { nome: "Energia", categoria: "contas", unidade: "conta", fixo: true },
  { nome: "Água", categoria: "contas", unidade: "conta", fixo: true },
];

type MaterialForm = { id?: string; nome: string; categoria: CostCategory; unidade: string; preco: string; fixo: boolean };
type ExpenseForm = {
  id?: string; materialId: string; nome: string; categoria: CostCategory; data: string;
  quantidade: string; valorUnitario: string; observacao: string; atualizarPreco: boolean;
};

const toNum = (v: string) => Number(v.replace(",", "."));

// Custos e Materiais: itens que se compram sempre (com preço atual) e os gastos de cada mês,
// que o Faturamento desconta para mostrar o lucro.
export default function CustosPage() {
  const { user } = useAuth();
  const { showConfirmationModal } = useAppModal();
  const today = getSaoPauloToday();
  const [offset, setOffset] = useState(0);
  const [tab, setTab] = useState<"lancamentos" | "itens">("lancamentos");
  const [materials, setMaterials] = useState<Material[] | null>(null);
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [materialForm, setMaterialForm] = useState<MaterialForm | null>(null);
  const [expenseForm, setExpenseForm] = useState<ExpenseForm | null>(null);
  const [formError, setFormError] = useState("");

  const period = useMemo(() => getPeriod("mes", offset, today), [offset, today]);

  const api = useCallback(async (path: string, init?: RequestInit) => {
    if (!user) throw new Error("Sessão expirada.");
    const token = await user.getIdToken();
    const res = await fetch(`/api/professionals/${user.uid}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Não foi possível concluir. Tente novamente.");
    return data;
  }, [user]);

  // Recarregar = mudar a chave; os efeitos abaixo buscam de novo
  const [materialsKey, setMaterialsKey] = useState(0);
  const [expensesKey, setExpensesKey] = useState(0);
  const loadMaterials = () => setMaterialsKey((k) => k + 1);
  const loadExpenses = () => setExpensesKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api("/materials");
        if (!cancelled) setMaterials(data.materials);
      } catch (e) {
        if (!cancelled) { setError((e as Error).message); setMaterials([]); }
      }
    })();
    return () => { cancelled = true; };
  }, [api, materialsKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api(`/expenses?from=${period.prevStart}&to=${period.end}`);
        if (!cancelled) setExpenses(data.expenses);
      } catch (e) {
        if (!cancelled) { setError((e as Error).message); setExpenses([]); }
      }
    })();
    return () => { cancelled = true; };
  }, [api, period.prevStart, period.end, expensesKey]);

  const monthExpenses = useMemo(
    () => (expenses ?? []).filter((e) => e.data >= period.start && e.data <= period.end),
    [expenses, period.start, period.end]
  );
  const summary = useMemo(() => summarizeCosts(expenses ?? [], period), [expenses, period]);
  const pendingFixed = useMemo(() => pendingFixedItems(materials ?? [], monthExpenses), [materials, monthExpenses]);
  const defaultDate = offset === 0 ? today : period.start;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  // ── Itens ──────────────────────────────────────────────────────────────────
  const openNewMaterial = (preset?: Partial<MaterialForm>) => {
    setFormError("");
    setMaterialForm({ nome: "", categoria: "materiais", unidade: "un", preco: "", fixo: false, ...preset });
  };

  const saveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialForm) return;
    setBusy(true);
    setFormError("");
    try {
      const body = JSON.stringify({ ...materialForm, preco: toNum(materialForm.preco || "0") });
      if (materialForm.id) await api(`/materials/${materialForm.id}`, { method: "PATCH", body });
      else await api("/materials", { method: "POST", body });
      setMaterialForm(null);
      loadMaterials();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const deleteMaterial = (m: Material) =>
    showConfirmationModal({
      title: "Excluir item",
      description: `Excluir "${m.nome}" dos itens cadastrados? Os gastos já lançados com ele continuam no histórico.`,
      confirmLabel: "Excluir",
      cancelLabel: "Voltar",
      variant: "danger",
      onConfirm: () => run(async () => { await api(`/materials/${m.id}`, { method: "DELETE" }); loadMaterials(); }),
    });

  // ── Lançamentos ───────────────────────────────────────────────────────────
  const openNewExpense = (m?: Material) => {
    setFormError("");
    setExpenseForm({
      materialId: m?.id ?? "",
      nome: m?.nome ?? "",
      categoria: m?.categoria ?? "materiais",
      data: defaultDate,
      quantidade: "1",
      valorUnitario: m ? String(m.preco).replace(".", ",") : "",
      observacao: "",
      atualizarPreco: true,
    });
  };

  const openEditExpense = (x: Expense) => {
    setFormError("");
    setExpenseForm({
      id: x.id, materialId: x.materialId ?? "", nome: x.nome, categoria: x.categoria, data: x.data,
      quantidade: String(x.quantidade).replace(".", ","), valorUnitario: String(x.valorUnitario).replace(".", ","),
      observacao: x.observacao, atualizarPreco: false,
    });
  };

  const pickMaterial = (materialId: string) => {
    if (!expenseForm) return;
    const m = (materials ?? []).find((x) => x.id === materialId);
    setExpenseForm({
      ...expenseForm,
      materialId,
      nome: m ? m.nome : "",
      categoria: m ? m.categoria : expenseForm.categoria,
      valorUnitario: m ? String(m.preco).replace(".", ",") : expenseForm.valorUnitario,
    });
  };

  const saveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm) return;
    setBusy(true);
    setFormError("");
    try {
      const { id, atualizarPreco, ...rest } = expenseForm;
      const payload = { ...rest, materialId: rest.materialId || null, quantidade: toNum(rest.quantidade || "1"), valorUnitario: toNum(rest.valorUnitario || "0") };
      if (id) await api(`/expenses/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
      else await api("/expenses", { method: "POST", body: JSON.stringify({ ...payload, atualizarPreco }) });
      setExpenseForm(null);
      loadExpenses();
      if (atualizarPreco && !id && payload.materialId) loadMaterials();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const deleteExpense = (x: Expense) =>
    showConfirmationModal({
      title: "Excluir lançamento",
      description: `Excluir "${x.nome}" de ${ddmm(x.data)} (${brl(x.total)})?`,
      confirmLabel: "Excluir",
      cancelLabel: "Voltar",
      variant: "danger",
      onConfirm: () => run(async () => { await api(`/expenses/${x.id}`, { method: "DELETE" }); loadExpenses(); }),
    });

  const launchFixed = () =>
    showConfirmationModal({
      title: "Lançar contas fixas do mês",
      description: `Lançar ${pendingFixed.map((m) => `${m.nome} (${brl(m.preco)})`).join(", ")} em ${period.label}? Os valores vêm do último preço; depois é só corrigir o que mudou.`,
      confirmLabel: "Lançar",
      cancelLabel: "Voltar",
      variant: "info",
      onConfirm: () =>
        run(async () => {
          await api("/expenses", {
            method: "POST",
            body: JSON.stringify({
              itens: pendingFixed.map((m) => ({ materialId: m.id, nome: m.nome, categoria: m.categoria, data: defaultDate, quantidade: 1, valorUnitario: m.preco, observacao: "" })),
            }),
          });
          loadExpenses();
        }),
    });

  const expenseTotalPreview = expenseForm ? round2(toNum(expenseForm.quantidade || "0") * toNum(expenseForm.valorUnitario || "0")) : 0;
  const selectedMaterial = expenseForm?.materialId ? (materials ?? []).find((m) => m.id === expenseForm.materialId) : undefined;
  const priceChanged = !!selectedMaterial && !expenseForm?.id && toNum(expenseForm?.valorUnitario || "0") !== selectedMaterial.preco;
  const loading = materials === null || expenses === null;
  const topCategory = summary.byCategory[0];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <Wallet className="h-6 w-6 text-indigo-400" />
          Custos e Materiais
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Cadastre o que você compra sempre e lance os gastos do mês. O <Link href="/dashboard/faturamento" className="text-indigo-400 underline">Faturamento</Link> desconta esses custos e mostra o seu lucro.
        </p>
      </div>

      {/* Mês */}
      <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-2xl px-2 py-1.5">
        <button type="button" aria-label="Mês anterior" onClick={() => setOffset((o) => o - 1)} className="p-1.5 rounded-full text-slate-400 hover:bg-slate-800">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="flex-1 text-center text-sm font-extrabold text-slate-100">{period.label}</span>
        <button type="button" aria-label="Próximo mês" onClick={() => setOffset((o) => o + 1)} className="p-1.5 rounded-full text-slate-400 hover:bg-slate-800">
          <ChevronRight className="h-5 w-5" />
        </button>
        {offset !== 0 && (
          <button type="button" onClick={() => setOffset(0)} className="px-2.5 py-1 rounded-full border border-slate-800 text-[11px] font-bold text-slate-300">
            Atual
          </button>
        )}
      </div>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}

      {/* Resumo do mês */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="col-span-2 md:col-span-1 bg-slate-900/40 border border-slate-800 rounded-2xl p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gastos do mês</p>
          <p className="text-2xl font-black text-slate-100 mt-1">{loading ? "…" : brl(summary.total)}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {summary.deltaPct === null ? "Sem gastos no mês anterior para comparar." : `${summary.deltaPct >= 0 ? "+" : ""}${pct(summary.deltaPct)} em relação ao mês anterior (${brl(summary.prevTotal)})`}
          </p>
        </div>
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lançamentos</p>
          <p className="text-2xl font-black text-slate-100 mt-1">{loading ? "…" : summary.count}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">compras e contas no mês</p>
        </div>
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 min-w-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Maior gasto</p>
          <p className="text-base font-black text-slate-100 mt-1 truncate">{topCategory ? topCategory.label : "—"}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{topCategory ? `${brl(topCategory.value)} · ${pct(topCategory.share)} do mês` : "nenhum gasto lançado"}</p>
        </div>
      </div>

      {/* Contas fixas ainda não lançadas no mês */}
      {pendingFixed.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3">
          <p className="text-xs text-slate-200">
            <Repeat className="inline h-3.5 w-3.5 mr-1 text-indigo-400" />
            Faltam lançar neste mês: <strong>{pendingFixed.map((m) => m.nome).join(", ")}</strong>.
          </p>
          <button type="button" disabled={busy} onClick={launchFixed} className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold disabled:opacity-50">
            Lançar contas fixas
          </button>
        </div>
      )}

      {/* Abas */}
      <div className="inline-flex rounded-xl border border-slate-800 p-1 bg-slate-900/50">
        {([["lancamentos", "Gastos do mês"], ["itens", "Itens cadastrados"]] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${tab === k ? "bg-indigo-600 text-white" : "text-slate-400"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "lancamentos" && (
        <section className="space-y-4">
          {summary.byCategory.length > 0 && (
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 space-y-2.5">
              {summary.byCategory.map((c) => (
                <div key={c.label}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-slate-200 truncate">{c.label}</span>
                    <span className="font-bold text-slate-100 tabular-nums">{brl(c.value)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-800/60 overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(c.value / summary.byCategory[0].value) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {loading ? (
            <p className="text-sm text-slate-400">Carregando...</p>
          ) : monthExpenses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-400">
              Nenhum gasto lançado em {period.label}. Toque em <strong>+</strong> para lançar uma compra ou conta.
            </div>
          ) : (
            <ul className="overflow-hidden rounded-2xl border border-slate-800 divide-y divide-slate-800/60">
              {monthExpenses.map((x) => (
                <li key={x.id} className="flex items-center gap-3 p-3 bg-slate-900/30">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-200 truncate">{x.nome}</div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {ddmm(x.data)} · {categoryLabel(x.categoria)} · {x.quantidade.toLocaleString("pt-BR")} × {brl(x.valorUnitario)}
                      {x.observacao ? ` · ${x.observacao}` : ""}
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-slate-100 tabular-nums">{brl(x.total)}</span>
                  <button type="button" aria-label="Editar" onClick={() => openEditExpense(x)} className="p-1.5 text-slate-400"><Pencil className="h-4 w-4" /></button>
                  <button type="button" aria-label="Excluir" onClick={() => deleteExpense(x)} className="p-1.5 text-slate-400"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "itens" && (
        <section className="space-y-4">
          <button type="button" onClick={() => openNewMaterial()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 text-xs font-bold text-slate-200">
            <Plus className="h-4 w-4" /> Novo item
          </button>

          {materials !== null && materials.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-800 p-5 space-y-3">
              <p className="text-sm text-slate-400">Comece cadastrando o que você compra sempre. Sugestões:</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s.nome} type="button" onClick={() => openNewMaterial({ ...s, fixo: s.fixo ?? false })} className="px-3 py-1.5 rounded-full border border-slate-700 text-xs font-semibold text-slate-200">
                    + {s.nome}
                  </button>
                ))}
              </div>
            </div>
          )}

          {COST_CATEGORIES.map((cat) => {
            const items = (materials ?? []).filter((m) => m.categoria === cat.key);
            if (items.length === 0) return null;
            return (
              <div key={cat.key}>
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{cat.label}</h2>
                <ul className="overflow-hidden rounded-2xl border border-slate-800 divide-y divide-slate-800/60">
                  {items.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 p-3 bg-slate-900/30">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-200 truncate">
                          {m.nome}
                          {m.fixo && <span className="ml-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-400">fixo mensal</span>}
                        </div>
                        <div className="text-[11px] text-slate-500">{brl(m.preco)} por {m.unidade}</div>
                      </div>
                      <button type="button" onClick={() => openNewExpense(m)} className="shrink-0 px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-[11px] font-bold">
                        Lançar
                      </button>
                      <button type="button" aria-label="Editar" onClick={() => { setFormError(""); setMaterialForm({ id: m.id, nome: m.nome, categoria: m.categoria, unidade: m.unidade, preco: String(m.preco).replace(".", ","), fixo: m.fixo }); }} className="p-1.5 text-slate-400">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" aria-label="Excluir" onClick={() => deleteMaterial(m)} className="p-1.5 text-slate-400"><Trash2 className="h-4 w-4" /></button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      )}

      {/* Lançar gasto */}
      <button
        type="button"
        aria-label="Lançar gasto"
        onClick={() => openNewExpense()}
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-2xl bg-indigo-600 text-white shadow-xl flex items-center justify-center active:scale-95 transition-transform"
      >
        <Plus className="h-7 w-7" />
      </button>

      {expenseForm && (
        <Modal title={expenseForm.id ? "Editar gasto" : "Lançar gasto"} onClose={() => setExpenseForm(null)}>
          <form onSubmit={saveExpense} className="space-y-3">
            {!expenseForm.id && (
              <Field label="Item">
                <select value={expenseForm.materialId} onChange={(e) => pickMaterial(e.target.value)} className={inputClass}>
                  <option value="">Outro (gasto avulso)</option>
                  {COST_CATEGORIES.map((c) => {
                    const items = (materials ?? []).filter((m) => m.categoria === c.key);
                    return items.length ? (
                      <optgroup key={c.key} label={c.label}>
                        {items.map((m) => <option key={m.id} value={m.id}>{m.nome} ({brl(m.preco)}/{m.unidade})</option>)}
                      </optgroup>
                    ) : null;
                  })}
                </select>
              </Field>
            )}
            {(!expenseForm.materialId || expenseForm.id) && (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Descrição">
                  <input value={expenseForm.nome} onChange={(e) => setExpenseForm({ ...expenseForm, nome: e.target.value })} maxLength={60} required className={inputClass} placeholder="Ex.: Conserto" />
                </Field>
                <Field label="Categoria">
                  <select value={expenseForm.categoria} onChange={(e) => setExpenseForm({ ...expenseForm, categoria: e.target.value as CostCategory })} className={inputClass}>
                    {COST_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </Field>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <Field label="Data">
                <input type="date" value={expenseForm.data} onChange={(e) => setExpenseForm({ ...expenseForm, data: e.target.value })} required className={inputClass} />
              </Field>
              <Field label="Quantidade">
                <input inputMode="decimal" value={expenseForm.quantidade} onChange={(e) => setExpenseForm({ ...expenseForm, quantidade: e.target.value })} required className={inputClass} />
              </Field>
              <Field label="Valor unit. (R$)">
                <input inputMode="decimal" value={expenseForm.valorUnitario} onChange={(e) => setExpenseForm({ ...expenseForm, valorUnitario: e.target.value })} required className={inputClass} placeholder="0,00" />
              </Field>
            </div>
            <Field label="Observação (opcional)">
              <input value={expenseForm.observacao} onChange={(e) => setExpenseForm({ ...expenseForm, observacao: e.target.value })} maxLength={300} className={inputClass} placeholder="Ex.: comprado na loja X" />
            </Field>
            {priceChanged && (
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input type="checkbox" checked={expenseForm.atualizarPreco} onChange={(e) => setExpenseForm({ ...expenseForm, atualizarPreco: e.target.checked })} />
                Atualizar o preço de &quot;{selectedMaterial?.nome}&quot; para este valor
              </label>
            )}
            <p className="text-sm text-slate-300">Total: <strong className="text-slate-100">{brl(Number.isFinite(expenseTotalPreview) ? expenseTotalPreview : 0)}</strong></p>
            {formError && <p className="text-xs font-semibold text-red-500">{formError}</p>}
            <button type="submit" disabled={busy} className="w-full h-11 rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-50">
              {busy ? "Salvando..." : expenseForm.id ? "Salvar" : "Lançar"}
            </button>
          </form>
        </Modal>
      )}

      {materialForm && (
        <Modal title={materialForm.id ? "Editar item" : "Novo item"} onClose={() => setMaterialForm(null)}>
          <form onSubmit={saveMaterial} className="space-y-3">
            <Field label="Nome">
              <input value={materialForm.nome} onChange={(e) => setMaterialForm({ ...materialForm, nome: e.target.value })} maxLength={60} required className={inputClass} placeholder="Ex.: Luvas" />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Categoria">
                <select value={materialForm.categoria} onChange={(e) => setMaterialForm({ ...materialForm, categoria: e.target.value as CostCategory })} className={inputClass}>
                  {COST_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Unidade">
                <input value={materialForm.unidade} onChange={(e) => setMaterialForm({ ...materialForm, unidade: e.target.value })} maxLength={20} className={inputClass} placeholder="un, caixa, pacote" />
              </Field>
            </div>
            <Field label="Preço atual (R$)">
              <input inputMode="decimal" value={materialForm.preco} onChange={(e) => setMaterialForm({ ...materialForm, preco: e.target.value })} required className={inputClass} placeholder="0,00" />
            </Field>
            <label className="flex items-start gap-2 text-xs text-slate-300">
              <input type="checkbox" className="mt-0.5" checked={materialForm.fixo} onChange={(e) => setMaterialForm({ ...materialForm, fixo: e.target.checked })} />
              <span>Gasto fixo mensal (energia, água, aluguel...): aparece no lembrete &quot;Lançar contas fixas&quot; todo mês.</span>
            </label>
            {formError && <p className="text-xs font-semibold text-red-500">{formError}</p>}
            <button type="submit" disabled={busy} className="w-full h-11 rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-50">
              {busy ? "Salvando..." : "Salvar item"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

const inputClass = "block w-full min-w-0 h-10 px-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-indigo-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="block text-[11px] font-semibold text-slate-400 mb-1">{label}</span>
      {children}
    </label>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Fechar" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-black text-slate-100 flex items-center gap-2"><Package className="h-4 w-4 text-indigo-400" />{title}</h2>
          <button type="button" aria-label="Fechar" onClick={onClose} className="p-1.5 text-slate-400"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
