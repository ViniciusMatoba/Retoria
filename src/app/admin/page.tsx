"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers";
import { PLANS, type PlanId, type LicenseStatus } from "@/lib/licenseTypes";
import {
  Users, Plus, Copy, Check, Loader2, AlertCircle, LogOut,
  RefreshCw, Ban, PlayCircle, ChevronRight, X, Trash2,
  Shield, TrendingUp, Clock, User,
  RotateCcw, ArrowUpCircle, LayoutDashboard,
} from "lucide-react";


interface Professional {
  id: string;
  nome: string;
  nomeNegocio: string;
  email: string;
  professionalStatus: string;
  plan: PlanId;
  licenseStatus: LicenseStatus;
  currentPeriodEnd: any;
  trialEndsAt: any;
  memberCount: number;
  maxMembers: number;
  createdAt: any;
}

interface ProfessionalDetail extends Professional {
  telefone: string;
  slugPublico: string;
  contractDays: number;
  trialDays: number;
  sourceToken: string | null;
  activatedAt: any;
  suspendedAt: any;
  pendingInvites: number;
  members: { id: string; nome: string; email: string; status: string }[];
}

interface Token {
  token: string;
  plan: PlanId;
  contractDays: number;
  trialDays: number;
  label: string;
  createdAt: any;
  expiresAt: any;
  usedAt: any;
  usedByUid: string | null;
}

const planColors: Record<string, string> = {
  individual: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  professional: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  enterprise: "text-amber-400 bg-amber-500/10 border-amber-500/20",
};

const statusColors: Record<string, string> = {
  trial: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  active: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  grace: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  suspended: "text-red-400 bg-red-500/10 border-red-500/20",
  cancelled: "text-slate-400 bg-slate-500/10 border-slate-500/20",
  onboarding: "text-violet-400 bg-violet-500/10 border-violet-500/20",
};

// ts é número (ms Unix) vindo da API — formato único, sem ambiguidade
const formatTs = (ts: any): string => {
  if (ts == null) return "—";
  try {
    const d = new Date(typeof ts === "number" ? ts : Number(ts));
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return "—"; }
};

const daysFrom = (ts: any): number | null => {
  if (ts == null) return null;
  try {
    const ms = typeof ts === "number" ? ts : Number(ts);
    if (isNaN(ms)) return null;
    return Math.ceil((ms - Date.now()) / (1000 * 60 * 60 * 24));
  } catch { return null; }
};

const addDays = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};

export default function AdminPage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"professionals" | "tokens" | "requests">("professionals");
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [accessRequests, setAccessRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Detail drawer
  const [detail, setDetail] = useState<ProfessionalDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");

  // Actions inside detail
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [upgradePlan, setUpgradePlan] = useState<PlanId>("individual");
  const [renewDays, setRenewDays] = useState("30");
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showRenew, setShowRenew] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [showDelete, setShowDelete] = useState(false);

  // Generate token form
  const [showForm, setShowForm] = useState(false);
  const [formPlan, setFormPlan] = useState<PlanId>("individual");
  const [formDays, setFormDays] = useState("30");
  const [formLabel, setFormLabel] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    user.getIdToken().then((token) =>
      fetch("/api/admin/me", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((d) => {
          if (!d.isAdmin) router.push("/dashboard/slots");
          else setIsAdmin(true);
        })
        .catch(() => router.push("/dashboard/slots"))
    );
  }, [user, router]);

  const fetchData = useCallback(async () => {
    if (!user || !isAdmin) return;
    setLoading(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [profRes, tokRes, reqRes] = await Promise.all([
        fetch("/api/admin/professionals", { headers }),
        fetch("/api/admin/license-tokens", { headers }),
        fetch("/api/access-requests", { headers }),
      ]);
      const [profData, tokData, reqData] = await Promise.all([profRes.json(), tokRes.json(), reqRes.json()]);
      if (!profRes.ok) { setError(profData.error ?? "Erro ao carregar clientes."); }
      else setProfessionals(profData.professionals ?? []);
      setTokens(tokData.tokens ?? []);
      setAccessRequests(reqData.requests ?? []);
    } catch {
      setError("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin]);

  useEffect(() => { if (isAdmin) fetchData(); }, [fetchData, isAdmin]);

  const openDetail = async (profId: string) => {
    if (!user) return;
    setLoadingDetail(true);
    setDetailError("");
    setDetail(null);
    setShowUpgrade(false);
    setShowRenew(false);
    setShowDelete(false);
    setDeleteConfirm("");
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/professionals?id=${profId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { setDetailError(data.error ?? "Erro ao carregar detalhes."); return; }
      setDetail(data);
      setUpgradePlan(data.plan);
    } finally {
      setLoadingDetail(false);
    }
  };

  const doAction = async (action: string, extra?: object) => {
    if (!user || !detail) return;
    setActionLoading(action);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/professionals", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ professionalId: detail.id, action, ...extra }),
      });
      if (res.ok) {
        await fetchData();
        await openDetail(detail.id);
        setShowUpgrade(false);
        setShowRenew(false);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const doDelete = async () => {
    if (!user || !detail || deleteConfirm !== detail.nome) return;
    setActionLoading("delete");
    try {
      const token = await user.getIdToken();
      await fetch("/api/admin/professionals", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ professionalId: detail.id }),
      });
      setDetail(null);
      fetchData();
    } finally {
      setActionLoading(null);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setGenerating(true);
    try {
      const authToken = await user.getIdToken();
      const res = await fetch("/api/admin/license-tokens", {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ plan: formPlan, contractDays: Number(formDays), label: formLabel }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erro ao gerar link."); return; }
      setGeneratedLink(`${window.location.origin}/ativar/${data.token}`);
      setFormLabel("");
      fetchData();
    } finally {
      setGenerating(false);
    }
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const total = professionals.length;
  const trials = professionals.filter(p => p.licenseStatus === "trial").length;
  const active = professionals.filter(p => p.licenseStatus === "active").length;
  const expiringSoon = professionals.filter(p => {
    const d = daysFrom(p.currentPeriodEnd);
    return d !== null && d >= 0 && d <= 7;
  }).length;

  if (!user || !isAdmin) return null;

  const isSuspended = detail && (detail.licenseStatus === "suspended" || detail.professionalStatus === "suspended");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <span className="font-extrabold text-lg tracking-tight">Retoria Admin</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all" title="Atualizar dados">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button onClick={() => router.push("/dashboard/slots")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm font-medium transition-all">
            <LayoutDashboard className="h-4 w-4" /><span>Ir para Dashboard</span>
          </button>
          <button onClick={() => router.push("/portal")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-indigo-300 hover:text-white bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/40 rounded-lg text-sm font-medium transition-all">
            <Users className="h-4 w-4" /><span>Portal</span>
          </button>
          <button onClick={async () => { await logout(); router.push("/login"); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg text-sm transition-all">
            <LogOut className="h-4 w-4" /><span>Sair</span>
          </button>
        </div>
      </header>

      {/* Body — list + detail side by side */}
      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 65px)" }}>

        {/* Main list */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total clientes", value: total, icon: <Users className="h-5 w-5" />, color: "text-indigo-400 bg-indigo-500/10" },
                { label: "Em trial", value: trials, icon: <Clock className="h-5 w-5" />, color: "text-blue-400 bg-blue-500/10" },
                { label: "Ativos", value: active, icon: <TrendingUp className="h-5 w-5" />, color: "text-emerald-400 bg-emerald-500/10" },
                { label: "Vencendo em 7d", value: expiringSoon, icon: <AlertCircle className="h-5 w-5" />, color: "text-amber-400 bg-amber-500/10" },
              ].map((m) => (
                <div key={m.label} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
                  <div className={`p-2.5 rounded-xl ${m.color}`}>{m.icon}</div>
                  <div>
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">{m.label}</p>
                    <p className="text-2xl font-extrabold mt-0.5">{m.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <AlertCircle className="h-4 w-4 shrink-0" /><span>{error}</span>
              </div>
            )}

            {/* Tabs + generate button */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl w-fit">
                {(["professionals", "tokens", "requests"] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all relative ${tab === t ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"}`}>
                    {t === "professionals" ? `Clientes (${total})` : t === "tokens" ? `Links (${tokens.length})` : (
                      <span className="flex items-center gap-1.5">
                        Solicitações
                        {accessRequests.filter((r) => r.status === "pending").length > 0 && (
                          <span className="h-4 w-4 rounded-full bg-amber-500 text-[10px] font-black text-white flex items-center justify-center">
                            {accessRequests.filter((r) => r.status === "pending").length}
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <button onClick={() => { setShowForm(!showForm); setGeneratedLink(null); }}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/20">
                <Plus className="h-4 w-4" /><span>Gerar link de acesso</span>
              </button>
            </div>

            {/* Generate form */}
            {showForm && (
              <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-slate-300">Novo link de ativação</h3>
                <form onSubmit={handleGenerate} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Plano *</label>
                      <div className="grid gap-2">
                        {(Object.keys(PLANS) as PlanId[]).map((p) => (
                          <button key={p} type="button" onClick={() => setFormPlan(p)}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left text-sm font-semibold transition-all ${formPlan === p ? planColors[p] : "border-slate-800 text-slate-400 hover:border-slate-700"}`}>
                            <span>{PLANS[p].label}</span>
                            <span className="text-xs font-normal opacity-60">{PLANS[p].maxMembers === 0 ? "só o dono" : `até ${PLANS[p].maxMembers}`}</span>
                            {formPlan === p && <Check className="h-3.5 w-3.5 ml-auto" />}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Duração *</label>
                      <div className="grid gap-2">
                        {[["30", "30 dias"], ["90", "90 dias"], ["180", "180 dias"], ["365", "1 ano"]].map(([v, l]) => (
                          <button key={v} type="button" onClick={() => setFormDays(v)}
                            className={`px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all text-left ${formDays === v ? "border-indigo-500 bg-indigo-500/10 text-indigo-300" : "border-slate-800 text-slate-400 hover:border-slate-700"}`}>
                            {l}{formDays === v && <Check className="h-3.5 w-3.5 inline ml-2" />}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Identificação (opcional)</label>
                        <input type="text" value={formLabel} onChange={(e) => setFormLabel(e.target.value)}
                          placeholder="Ex: João Barbeiro - mai/2026"
                          className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition-all" />
                      </div>
                      <button type="submit" disabled={generating}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700/50 text-white font-semibold rounded-xl text-sm transition-all">
                        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /><span>Gerar link</span></>}
                      </button>
                    </div>
                  </div>
                </form>
                {generatedLink && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 space-y-2">
                    <p className="text-emerald-400 font-semibold text-sm flex items-center gap-2"><Check className="h-4 w-4" />Link gerado!</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-300 truncate">{generatedLink}</code>
                      <button onClick={() => copy(generatedLink, "gen")}
                        className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold shrink-0">
                        {copied === "gen" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copied === "gen" ? "Copiado!" : "Copiar"}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Table / tokens list */}
            {loading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 text-indigo-500 animate-spin" /></div>
            ) : tab === "professionals" ? (
              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/30">
                {professionals.length === 0 ? (
                  <div className="text-center py-16 text-slate-500">Nenhum cliente cadastrado ainda.</div>
                ) : (
                  <table className="w-full text-sm text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/60 text-xs font-bold text-slate-400 uppercase tracking-wider">
                        <th className="py-3.5 px-4">Cliente</th>
                        <th className="py-3.5 px-4">Plano</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4">Vencimento</th>
                        <th className="py-3.5 px-4 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {professionals.map((p) => {
                        const daysLeft = daysFrom(p.currentPeriodEnd ?? p.trialEndsAt);
                        const isSelected = detail?.id === p.id;
                        return (
                          <tr key={p.id} onClick={() => openDetail(p.id)}
                            className={`cursor-pointer transition-colors ${isSelected ? "bg-indigo-500/5" : "hover:bg-slate-900/40"}`}>
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-slate-200">{p.nome || "—"}</div>
                              <div className="text-xs text-slate-500 truncate max-w-[160px]">{p.nomeNegocio || p.email || "—"}</div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-lg border ${planColors[p.plan] ?? "text-slate-400 bg-slate-800 border-slate-700"}`}>
                                {PLANS[p.plan]?.label ?? p.plan}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-lg border ${statusColors[p.licenseStatus] ?? "text-slate-400 bg-slate-800 border-slate-700"}`}>
                                {p.licenseStatus}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="text-slate-300 text-xs">{formatTs(p.currentPeriodEnd ?? p.trialEndsAt)}</div>
                              {daysLeft !== null && (
                                <div className={`text-[10px] font-semibold mt-0.5 ${daysLeft < 0 ? "text-red-400" : daysLeft <= 7 ? "text-amber-400" : "text-slate-500"}`}>
                                  {daysLeft < 0 ? `Vencido há ${Math.abs(daysLeft)}d` : daysLeft === 0 ? "Vence hoje" : `${daysLeft}d restantes`}
                                </div>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              <ChevronRight className={`h-4 w-4 transition-colors ${isSelected ? "text-indigo-400" : "text-slate-600"}`} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            ) : tab === "tokens" ? (
              <div className="space-y-3">
                {tokens.length === 0 ? (
                  <div className="text-center py-16 text-slate-500">Nenhum link gerado ainda.</div>
                ) : tokens.map((t) => {
                  const used = !!t.usedAt;
                  const expired = !used && t.expiresAt && (t.expiresAt.seconds ? new Date(t.expiresAt.seconds * 1000) : new Date(t.expiresAt)) < new Date();
                  const link = `${typeof window !== "undefined" ? window.location.origin : ""}/ativar/${t.token}`;
                  return (
                    <div key={t.token} className={`bg-slate-900/50 border rounded-2xl p-4 flex flex-wrap items-center gap-4 ${used ? "border-slate-900 opacity-50" : expired ? "border-amber-500/20" : "border-slate-800"}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${planColors[t.plan]}`}>{PLANS[t.plan]?.label ?? t.plan}</span>
                          <span className="text-xs text-slate-500">{t.contractDays} dias</span>
                          {t.label && <span className="text-xs text-slate-400 font-medium">· {t.label}</span>}
                          {used && <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-lg">✓ Usado {formatTs(t.usedAt)}</span>}
                          {expired && !used && <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">Expirado</span>}
                        </div>
                        <code className="text-[10px] text-slate-600 truncate block mt-1">{link}</code>
                      </div>
                      {!used && !expired && (
                        <button onClick={() => copy(link, t.token)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold shrink-0">
                          {copied === t.token ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                          Copiar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : tab === "requests" ? (
              <div className="space-y-3">
                {accessRequests.length === 0 ? (
                  <div className="text-center py-16 text-slate-500">Nenhuma solicitação ainda.</div>
                ) : accessRequests.map((req) => (
                  <div key={req.id} className={`bg-slate-900/50 border rounded-2xl p-4 flex flex-wrap items-center gap-4 ${req.status === "pending" ? "border-amber-500/30" : "border-slate-800 opacity-60"}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-slate-200 text-sm">{req.nome}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-lg border font-semibold ${req.status === "pending" ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : "bg-slate-800 border-slate-700 text-slate-500"}`}>
                          {req.status === "pending" ? "Pendente" : "Atendido"}
                        </span>
                        <span className="text-xs text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-lg capitalize">{req.plano}</span>
                      </div>
                      <p className="text-xs text-slate-400 font-mono">{req.email}</p>
                      {req.createdAt && <p className="text-[10px] text-slate-600 mt-0.5">{new Date(req.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {req.status === "pending" && (
                        <>
                          <button
                            onClick={async () => {
                              const token = await user?.getIdToken();
                              const adminToken = await user?.getIdToken();
                              await fetch("/api/access-requests", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ id: req.id, status: "attended" }) });
                              setAccessRequests((prev) => prev.map((r) => r.id === req.id ? { ...r, status: "attended" } : r));
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs font-semibold transition-all"
                          >
                            <Check className="h-3.5 w-3.5" /> Atendido
                          </button>
                          <button
                            onClick={() => { setShowForm(true); setFormLabel(req.email); setTab("professionals"); }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/20 text-indigo-400 rounded-lg text-xs font-semibold transition-all"
                          >
                            <Plus className="h-3.5 w-3.5" /> Gerar link
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </main>

        {/* ── Detail side panel ── */}
        {(detail || loadingDetail) && (
          <aside className="w-[360px] shrink-0 border-l border-slate-800 bg-slate-900/80 overflow-y-auto flex flex-col">
            <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-5 py-4 flex items-center justify-between z-10">
              <h2 className="font-bold text-slate-200 text-sm truncate pr-4">{detail?.nome ?? "Carregando..."}</h2>
              <button onClick={() => { setDetail(null); setShowUpgrade(false); setShowRenew(false); setShowDelete(false); }}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>

            {loadingDetail ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />
              </div>
            ) : detailError ? (
              <div className="p-5 text-red-400 text-sm">{detailError}</div>
            ) : detail ? (
              <div className="p-5 space-y-5">

                {/* Identificação */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${planColors[detail.plan]}`}>{PLANS[detail.plan]?.label ?? detail.plan}</span>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${statusColors[detail.licenseStatus]}`}>{detail.licenseStatus}</span>
                  </div>
                  <p className="text-xs text-slate-500">{detail.email}</p>
                  {detail.telefone && <p className="text-xs text-slate-500">{detail.telefone}</p>}
                  {detail.nomeNegocio && <p className="text-xs text-slate-400 font-semibold">{detail.nomeNegocio}</p>}
                </div>

                {/* Timeline de licença */}
                <div className="bg-slate-950/60 rounded-2xl p-4 space-y-2.5">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Licença</p>
                  {[
                    ["Cadastro", formatTs(detail.createdAt)],
                    ["Ativação", formatTs(detail.activatedAt)],
                    ["Fim do trial", formatTs(detail.trialEndsAt)],
                    ["Vencimento", formatTs(detail.currentPeriodEnd)],
                    ["Duração do contrato", detail.contractDays ? `${detail.contractDays} dias` : "—"],
                    ...(detail.suspendedAt ? [["Suspenso em", formatTs(detail.suspendedAt)]] : []),
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">{label}</span>
                      <span className="text-slate-300 font-medium">{value}</span>
                    </div>
                  ))}
                  {detail.currentPeriodEnd && (() => {
                    const d = daysFrom(detail.currentPeriodEnd);
                    if (d === null) return null;
                    return (
                      <div className={`text-xs font-bold text-center py-1.5 rounded-lg mt-1 ${d < 0 ? "bg-red-500/10 text-red-400" : d <= 7 ? "bg-amber-500/10 text-amber-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                        {d < 0 ? `Vencido há ${Math.abs(d)} dias` : d === 0 ? "Vence hoje!" : `${d} dias restantes`}
                      </div>
                    );
                  })()}
                </div>

                {/* Equipe */}
                <div className="bg-slate-950/60 rounded-2xl p-4 space-y-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Equipe</p>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Membros ativos</span>
                    <span className="text-slate-300 font-medium">{detail.memberCount} / {detail.maxMembers === -1 ? "∞" : detail.maxMembers === 0 ? "0 (Individual)" : detail.maxMembers}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Convites pendentes</span>
                    <span className="text-slate-300 font-medium">{detail.pendingInvites}</span>
                  </div>
                  {detail.members.length > 0 && (
                    <div className="pt-1 space-y-1.5 border-t border-slate-800 mt-2">
                      {detail.members.map((m) => (
                        <div key={m.id} className="flex items-center gap-2">
                          <User className="h-3 w-3 text-slate-600 shrink-0" />
                          <span className="text-xs text-slate-400 truncate flex-1">{m.nome}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${m.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-800 text-slate-500"}`}>{m.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Ações */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ações</p>

                  {isSuspended ? (
                    <button onClick={() => doAction("reactivate")} disabled={!!actionLoading}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-sm font-semibold transition-all">
                      {actionLoading === "reactivate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                      Reativar acesso
                    </button>
                  ) : (
                    <button onClick={() => doAction("suspend")} disabled={!!actionLoading}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-sm font-semibold transition-all">
                      {actionLoading === "suspend" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                      Suspender acesso
                    </button>
                  )}

                  {/* Alterar plano */}
                  <button onClick={() => { setShowUpgrade(!showUpgrade); setShowRenew(false); }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-xl text-sm font-semibold transition-all">
                    <ArrowUpCircle className="h-4 w-4" />Alterar plano
                  </button>
                  {showUpgrade && (
                    <div className="bg-slate-950/60 rounded-2xl p-4 space-y-3">
                      <div className="space-y-2">
                        {(Object.keys(PLANS) as PlanId[]).map((p) => (
                          <button key={p} type="button" onClick={() => setUpgradePlan(p)}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition-all text-left ${upgradePlan === p ? planColors[p] : "border-slate-800 text-slate-400 hover:border-slate-700"}`}>
                            <span className="flex-1">{PLANS[p].label}</span>
                            <span className="text-xs opacity-60">{PLANS[p].maxMembers === 0 ? "individual" : `${PLANS[p].maxMembers} membros`}</span>
                            {upgradePlan === p && <Check className="h-3.5 w-3.5" />}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => doAction("upgrade", { plan: upgradePlan })} disabled={!!actionLoading}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2">
                        {actionLoading === "upgrade" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar alteração"}
                      </button>
                    </div>
                  )}

                  {/* Renovar licença */}
                  <button onClick={() => { setShowRenew(!showRenew); setShowUpgrade(false); }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-xl text-sm font-semibold transition-all">
                    <RotateCcw className="h-4 w-4" />Renovar licença
                  </button>
                  {showRenew && (
                    <div className="bg-slate-950/60 rounded-2xl p-4 space-y-3">
                      <p className="text-xs text-slate-400 font-semibold">Novo vencimento (a partir de hoje):</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[["30", "30 dias"], ["90", "90 dias"], ["180", "180 dias"], ["365", "1 ano"]].map(([v, l]) => (
                          <button key={v} type="button" onClick={() => setRenewDays(v)}
                            className={`py-2 rounded-xl border text-xs font-semibold transition-all ${renewDays === v ? "border-amber-500 bg-amber-500/10 text-amber-300" : "border-slate-800 text-slate-400 hover:border-slate-700"}`}>
                            {l}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => doAction("renew", { newPeriodEnd: addDays(Number(renewDays)) })} disabled={!!actionLoading}
                        className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2">
                        {actionLoading === "renew" ? <Loader2 className="h-4 w-4 animate-spin" /> : `Renovar por ${renewDays} dias`}
                      </button>
                    </div>
                  )}
                </div>

                {/* Zona de perigo */}
                <div className="border border-red-500/20 rounded-2xl p-4 space-y-3">
                  <p className="text-xs font-bold text-red-400 uppercase tracking-wider">Zona de perigo</p>
                  <p className="text-xs text-slate-500">Remove permanentemente o cadastro, licença, serviços, horários, leads e membros da equipe. <strong className="text-red-400">Irreversível.</strong></p>
                  <button onClick={() => setShowDelete(!showDelete)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-sm font-semibold transition-all">
                    <Trash2 className="h-4 w-4" />Excluir cliente
                  </button>
                  {showDelete && (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-400">Digite <strong className="text-red-400">{detail.nome}</strong> para confirmar:</p>
                      <input type="text" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)}
                        placeholder={detail.nome}
                        className="w-full px-3 py-2 bg-slate-950 border border-red-500/30 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-red-500 transition-all" />
                      <button onClick={doDelete} disabled={deleteConfirm !== detail.nome || !!actionLoading}
                        className="w-full py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-red-900/30 disabled:text-red-800 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2">
                        {actionLoading === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Trash2 className="h-4 w-4" />Excluir permanentemente</>}
                      </button>
                    </div>
                  )}
                </div>

              </div>
            ) : null}
          </aside>
        )}
      </div>
    </div>
  );
}
