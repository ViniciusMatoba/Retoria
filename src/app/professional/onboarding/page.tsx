"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  doc, setDoc, getDoc, collection, query, where, getDocs, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "../../providers";
import { addAccountType } from "@/lib/accountUtils";
import { formatPhoneForWhatsApp, maskPhone } from "@/lib/whatsapp";
import {
  Calendar, Briefcase, Link as LinkIcon, Phone, ChevronRight,
  ChevronLeft, Loader2, AlertCircle, CheckCircle2,
} from "lucide-react";

const SEGMENTS = [
  "Beleza e Estética", "Saúde", "Bem-estar e Terapias", "Fitness e Esporte",
  "Criativo e Arte", "Corporativo e Consultoria", "Alimentação e Gastronomia",
  "Pet e Veterinário", "Jovem e Entretenimento", "Outro",
];

const TOTAL_STEPS = 6;

export default function OnboardingPage() {
  const router = useRouter();
  const { user, profile, loading, refreshProfile } = useAuth();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [nomeNegocio, setNomeNegocio] = useState("");
  const [nomePublico, setNomePublico] = useState("");
  const [segment, setSegment] = useState("");
  const [slug, setSlug] = useState("");
  const [telefone, setTelefone] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [slugError, setSlugError] = useState("");
  const [checkingSlug, setCheckingSlug] = useState(false);

  // Auto-slugify
  useEffect(() => {
    if (nomeNegocio) {
      const clean = nomeNegocio
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .trim();
      setSlug(clean);
    }
  }, [nomeNegocio]);

  // Guard + pré-preenchimento com dados da ativação
  useEffect(() => {
    if (loading) return;
    if (!user) { router.push("/login"); return; }
    if (profile && profile.professionalStatus !== "onboarding") {
      router.push("/dashboard/slots");
      return;
    }
    // Pré-preencher com dados do profile (vindos da ativação)
    if (profile?.nome && !nomePublico) setNomePublico(profile.nome);
    if ((profile as any)?.telefoneWhatsapp && !telefone) {
      const raw = (profile as any).telefoneWhatsapp.replace(/\D/g, "").replace(/^55/, "");
      setTelefone(maskPhone(raw));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, loading, router]);

  const checkSlug = async () => {
    if (!slug) return;
    setCheckingSlug(true);
    setSlugError("");
    try {
      const q = query(collection(db, "professionals"), where("slugPublico", "==", slug));
      const snap = await getDocs(q);
      // Allow if the only match is our own document (resuming)
      const conflict = snap.docs.find((d) => d.id !== user?.uid);
      if (conflict) setSlugError("Este link já está em uso. Escolha outro.");
    } catch {
      setSlugError("Não foi possível verificar o slug. Tente novamente.");
    }
    setCheckingSlug(false);
  };

  const handleFinish = async () => {
    if (!user) return;
    if (!termsAccepted) { setError("Aceite os termos para continuar."); return; }
    setSaving(true);
    setError("");

    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "").trim();
    const cleanPhone = formatPhoneForWhatsApp(telefone);
    if (cleanPhone.length < 10) {
      setError("Telefone inválido. Inclua o DDD.");
      setSaving(false);
      return;
    }

    try {
      const profRef = doc(db, "professionals", user.uid);
      const exists = (await getDoc(profRef)).exists();
      const ts = serverTimestamp();

      if (exists) {
        // Update onboarding in progress
        await setDoc(profRef, {
          nome: nomePublico.trim(),
          nomeNegocio: nomeNegocio.trim(),
          slugPublico: cleanSlug,
          telefoneWhatsapp: cleanPhone,
          segment,
          professionalStatus: "trial",
          plan: "trial",
          trialStartedAt: ts,
          trialEndsAt: null,
          updatedAt: ts,
        }, { merge: true });
      } else {
        await setDoc(profRef, {
          id: user.uid,
          userId: user.uid,
          nome: nomePublico.trim(),
          nomeNegocio: nomeNegocio.trim(),
          slugPublico: cleanSlug,
          telefoneWhatsapp: cleanPhone,
          segment,
          descricaoCurta: "Seja bem-vindo ao meu canal de pré-agendamentos!",
          fotoLogoUrl: "",
          corPrincipal: "#6366f1",
          professionalStatus: "trial",
          plan: "trial",
          trialStartedAt: ts,
          trialEndsAt: null,
          createdAt: ts,
          updatedAt: ts,
        });
      }

      await addAccountType(user.uid, "professional");
      await refreshProfile();
      router.push("/dashboard/slots");
    } catch (e: any) {
      setError("Erro ao salvar: " + e.message);
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-slate-950 min-h-screen">
        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/8 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-lg z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-500/30 flex items-center justify-center mb-4">
            <Calendar className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Configure seu negócio</h1>
          <p className="text-slate-400 text-sm mt-1">Passo {step} de {TOTAL_STEPS}</p>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-slate-800 rounded-full mb-8">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl">
          {error && (
            <div className="mb-5 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex gap-3 items-start">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {/* ─── Step 1: Confirmar intenção ─── */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold mb-2">Bem-vindo ao Retoria Profissional</h2>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Você está prestes a criar sua página de agendamento. Seus clientes poderão
                  escolher serviços, horários e enviar o pedido diretamente para o seu WhatsApp.
                </p>
              </div>
              <ul className="space-y-3">
                {["Página pública personalizada", "Agenda com controle de horários", "Receba leads direto no WhatsApp", "Painel de clientes e status"].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button onClick={() => setStep(2)} className={btnClass}>
                Começar <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* ─── Step 2: Nome do negócio ─── */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold mb-1">Nome do negócio</h2>
                <p className="text-slate-400 text-sm">Como seus clientes vão te encontrar.</p>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Briefcase className="h-5 w-5" />
                </div>
                <input
                  type="text" value={nomeNegocio}
                  onChange={(e) => setNomeNegocio(e.target.value)}
                  placeholder="Ex: João Barbearia, Studio Ana Lima"
                  className={inputClass}
                />
              </div>
              <StepNav
                onBack={() => setStep(1)}
                onNext={() => { if (!nomeNegocio.trim()) { setError("Informe o nome do negócio."); return; } setError(""); setStep(3); }}
              />
            </div>
          )}

          {/* ─── Step 3: Nome público ─── */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold mb-1">Seu nome público</h2>
                <p className="text-slate-400 text-sm">O nome exibido na sua página para os clientes.</p>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Briefcase className="h-5 w-5" />
                </div>
                <input
                  type="text" value={nomePublico}
                  onChange={(e) => setNomePublico(e.target.value)}
                  placeholder="Ex: João Silva"
                  className={inputClass}
                />
              </div>
              <StepNav
                onBack={() => setStep(2)}
                onNext={() => { if (!nomePublico.trim()) { setError("Informe seu nome público."); return; } setError(""); setStep(4); }}
              />
            </div>
          )}

          {/* ─── Step 4: Segmento ─── */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold mb-1">Segmento de atuação</h2>
                <p className="text-slate-400 text-sm">Ajuda a personalizar sua experiência.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {SEGMENTS.map((s) => (
                  <button
                    key={s} type="button"
                    onClick={() => setSegment(s)}
                    className={`p-3 rounded-xl border text-sm font-medium text-left transition-all ${
                      segment === s
                        ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-300"
                        : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <StepNav
                onBack={() => setStep(3)}
                onNext={() => { if (!segment) { setError("Selecione um segmento."); return; } setError(""); setStep(5); }}
              />
            </div>
          )}

          {/* ─── Step 5: Slug + telefone ─── */}
          {step === 5 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold mb-1">Link público e WhatsApp</h2>
                <p className="text-slate-400 text-sm">Seus clientes usarão esse link para agendar.</p>
              </div>
              <div className="space-y-1.5">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <LinkIcon className="h-5 w-5" />
                  </div>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); setSlugError(""); }}
                    onBlur={checkSlug}
                    placeholder="seu-link-publico"
                    className={`${inputClass} ${slugError ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}`}
                  />
                  {checkingSlug && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-500" />}
                </div>
                {slugError ? (
                  <p className="text-xs text-red-400 px-1">{slugError}</p>
                ) : (
                  <p className="text-[11px] text-slate-500 px-1">
                    Link: <span className="text-indigo-400 font-mono">/p/{slug || "seu-link"}</span>
                  </p>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Phone className="h-5 w-5" />
                </div>
                <input
                  type="tel" value={telefone}
                  onChange={(e) => setTelefone(maskPhone(e.target.value))}
                  placeholder="(11) 99999-9999"
                  className={inputClass}
                />
              </div>
              <StepNav
                onBack={() => setStep(4)}
                onNext={() => {
                  if (!slug.trim()) { setError("Informe o link público."); return; }
                  if (slugError) { setError(slugError); return; }
                  if (!telefone.trim()) { setError("Informe o telefone WhatsApp."); return; }
                  setError(""); setStep(6);
                }}
              />
            </div>
          )}

          {/* ─── Step 6: Termos + finalizar ─── */}
          {step === 6 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold mb-1">Quase lá!</h2>
                <p className="text-slate-400 text-sm">Revise as informações e confirme para ativar sua conta.</p>
              </div>
              <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 space-y-2 text-sm">
                <Row label="Negócio" value={nomeNegocio} />
                <Row label="Nome público" value={nomePublico} />
                <Row label="Segmento" value={segment} />
                <Row label="Link" value={`/p/${slug}`} mono />
                <Row label="WhatsApp" value={telefone} />
              </div>
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
                />
                <span className="text-sm text-slate-400 leading-relaxed">
                  Declaro que sou responsável pelo negócio cadastrado e concordo com os
                  <span className="text-indigo-400"> Termos de Uso</span> do Retoria.
                </span>
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  className="flex items-center gap-1.5 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold transition-all"
                >
                  <ChevronLeft className="h-4 w-4" /> Voltar
                </button>
                <button
                  type="button"
                  disabled={saving || !termsAccepted}
                  onClick={handleFinish}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700/50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/20"
                >
                  {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <><span>Ativar minha conta</span><ChevronRight className="h-4 w-4" /></>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Internal helpers ────────────────────────────────────────────────────────

const btnClass =
  "w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98]";

const inputClass =
  "w-full pl-10 pr-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-100 placeholder-slate-500 text-sm transition-all";

function StepNav({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <div className="flex gap-3 pt-2">
      <button
        type="button" onClick={onBack}
        className="flex items-center gap-1.5 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold transition-all"
      >
        <ChevronLeft className="h-4 w-4" /> Voltar
      </button>
      <button
        type="button" onClick={onNext}
        className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/20"
      >
        Continuar <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className={`text-slate-200 text-right ${mono ? "font-mono text-indigo-300" : ""}`}>{value}</span>
    </div>
  );
}
