"use client";

import React, { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import {
  doc, setDoc, collection, query, where, getDocs, serverTimestamp,
} from "firebase/firestore";
import { auth, db, isConfigured } from "@/lib/firebase";
import { useAuth } from "../providers";
import { formatPhoneForWhatsApp } from "@/lib/whatsapp";
import {
  Calendar, User, Briefcase, Link as LinkIcon, Phone, Mail, Lock,
  Loader2, AlertCircle, CalendarCheck, ChevronRight,
} from "lucide-react";

type Mode = "professional" | "customer";

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex flex-col justify-center items-center bg-slate-950">
        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  const [mode, setMode] = useState<Mode>(
    searchParams.get("mode") === "customer" ? "customer" : "professional"
  );

  // Shared fields
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Professional-only fields
  const [nomeNegocio, setNomeNegocio] = useState("");
  const [slugPublico, setSlugPublico] = useState("");
  const [telefoneWhatsapp, setTelefoneWhatsapp] = useState("");

  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Auto-slugify business name
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
      setSlugPublico(clean);
    }
  }, [nomeNegocio]);

  // Redirect already-logged-in users
  useEffect(() => {
    if (!loading && user) router.push("/portal");
  }, [user, loading, router]);

  // Bloquear registro profissional sem token de ativação
  useEffect(() => {
    if (loading) return;
    if (mode === "professional" && !searchParams.get("token")) {
      router.replace("/planos?aviso=registro");
    }
  }, [loading, mode, searchParams, router]);

  const handleSubmitCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFormLoading(true);

    if (!isConfigured) {
      setError("Firebase não configurado. Configure as credenciais no arquivo .env.local.");
      setFormLoading(false);
      return;
    }
    if (!nome || !email || !password) {
      setError("Preencha todos os campos.");
      setFormLoading(false);
      return;
    }
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      setFormLoading(false);
      return;
    }

    try {
      const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);
      const uid = newUser.uid;
      const ts = serverTimestamp();

      await Promise.all([
        setDoc(doc(db, "accounts", uid), {
          uid, email, displayName: nome.trim(),
          accountTypes: ["customer"],
          createdAt: ts, updatedAt: ts,
        }),
        setDoc(doc(db, "customerAccounts", uid), {
          uid, name: nome.trim(), email,
          createdAt: ts, updatedAt: ts,
        }),
      ]);

      setSuccess(true);
      setTimeout(() => router.push("/customer/appointments"), 1500);
    } catch (err: any) {
      if (err.code === "auth/email-already-in-use") setError("E-mail já cadastrado.");
      else if (err.code === "auth/weak-password") setError("A senha deve ter pelo menos 6 caracteres.");
      else if (err.code === "auth/invalid-email") setError("E-mail inválido.");
      else setError("Erro ao criar conta: " + err.message);
      setFormLoading(false);
    }
  };

  const handleSubmitProfessional = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFormLoading(true);

    if (!isConfigured) {
      setError("Firebase não configurado.");
      setFormLoading(false);
      return;
    }
    if (!nome || !nomeNegocio || !slugPublico || !telefoneWhatsapp || !email || !password) {
      setError("Preencha todos os campos obrigatórios.");
      setFormLoading(false);
      return;
    }

    const cleanSlug = slugPublico.toLowerCase().replace(/[^a-z0-9-]/g, "").trim();
    if (!cleanSlug) {
      setError("Slug inválido. Use apenas letras, números e hifens.");
      setFormLoading(false);
      return;
    }

    const cleanPhone = formatPhoneForWhatsApp(telefoneWhatsapp);
    if (cleanPhone.length < 10) {
      setError("Telefone inválido. Insira um número com DDD (Ex: 11 99999-9999).");
      setFormLoading(false);
      return;
    }

    try {
      // Check slug uniqueness
      const q = query(collection(db, "professionals"), where("slugPublico", "==", cleanSlug));
      if (!(await getDocs(q)).empty) {
        setError("Este slug público já está em uso.");
        setFormLoading(false);
        return;
      }

      const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);
      const uid = newUser.uid;
      const ts = serverTimestamp();

      await Promise.all([
        setDoc(doc(db, "accounts", uid), {
          uid, email, displayName: nome.trim(),
          accountTypes: ["professional"],
          createdAt: ts, updatedAt: ts,
        }),
        setDoc(doc(db, "professionals", uid), {
          id: uid, userId: uid,
          nome: nome.trim(),
          nomeNegocio: nomeNegocio.trim(),
          slugPublico: cleanSlug,
          telefoneWhatsapp: cleanPhone,
          descricaoCurta: "Seja bem-vindo ao meu canal de pré-agendamentos!",
          fotoLogoUrl: "",
          corPrincipal: "#6366f1",
          professionalStatus: "trial",
          plan: "trial",
          trialStartedAt: ts,
          trialEndsAt: null,
          createdAt: ts, updatedAt: ts,
        }),
      ]);

      setSuccess(true);
      setTimeout(() => router.push("/portal"), 1500);
    } catch (err: any) {
      if (err.code === "auth/email-already-in-use") setError("E-mail já cadastrado.");
      else if (err.code === "auth/weak-password") setError("Senha fraca. Mínimo 6 caracteres.");
      else if (err.code === "auth/invalid-email") setError("E-mail inválido.");
      else setError("Erro ao criar conta: " + err.message);
      setFormLoading(false);
    }
  };

  if (loading || (user && !success)) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-slate-950">
        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
        <p className="mt-4 text-slate-400 font-medium">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col justify-center items-center px-4 py-12 md:py-20 bg-slate-950 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-lg z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-500/30 mb-4 ring-1 ring-indigo-400/30">
            <Calendar className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Criar conta no Retoria
          </h1>
        </div>

        {/* Mode selector */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={() => setMode("customer")}
            className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all text-sm font-semibold ${
              mode === "customer"
                ? "bg-emerald-600/20 border-emerald-500/50 text-emerald-300"
                : "bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
            }`}
          >
            <CalendarCheck className="h-5 w-5" />
            <span>Sou cliente</span>
            <span className="text-[11px] font-normal opacity-70 text-center leading-tight">
              Quero agendar com profissionais
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMode("professional")}
            className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all text-sm font-semibold ${
              mode === "professional"
                ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-300"
                : "bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
            }`}
          >
            <Briefcase className="h-5 w-5" />
            <span>Sou profissional</span>
            <span className="text-[11px] font-normal opacity-70 text-center leading-tight">
              Quero receber agendamentos
            </span>
          </button>
        </div>

        {/* Card */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl ring-1 ring-white/5">
          {!isConfigured && (
            <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex gap-3">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p>Configure as credenciais Firebase no arquivo <code>.env.local</code>.</p>
            </div>
          )}
          {error && (
            <div className="mb-5 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex gap-3 items-center">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p className="font-medium">{error}</p>
            </div>
          )}
          {success && (
            <div className="mb-5 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex gap-3 items-center">
              <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
              <p className="font-medium">Cadastro realizado! Redirecionando...</p>
            </div>
          )}

          {/* ── CUSTOMER FORM ── */}
          {mode === "customer" && (
            <form onSubmit={handleSubmitCustomer} className="space-y-4">
              <InputField icon={<User />} type="text" placeholder="Seu nome completo" value={nome} onChange={setNome} />
              <InputField icon={<Mail />} type="email" placeholder="E-mail" value={email} onChange={setEmail} />
              <InputField icon={<Lock />} type="password" placeholder="Senha (mínimo 6 caracteres)" value={password} onChange={setPassword} />
              <SubmitButton loading={formLoading} success={success} label="Criar conta de cliente" />
            </form>
          )}

          {/* ── PROFESSIONAL FORM ── */}
          {mode === "professional" && (
            <form onSubmit={handleSubmitProfessional} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Dados do Negócio
                </label>
                <div className="space-y-4">
                  <InputField icon={<User />} type="text" placeholder="Seu nome completo" value={nome} onChange={setNome} />
                  <InputField icon={<Briefcase />} type="text" placeholder="Nome do negócio (Ex: João Barbearia)" value={nomeNegocio} onChange={setNomeNegocio} />
                  <div className="space-y-1.5">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                        <LinkIcon className="h-5 w-5" />
                      </div>
                      <input
                        type="text"
                        required
                        value={slugPublico}
                        onChange={(e) => setSlugPublico(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                        placeholder="slug-do-seu-link"
                        className="w-full pl-10 pr-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-100 placeholder-slate-500 text-sm transition-all"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 px-1">
                      Seu link: <span className="text-indigo-400 font-mono">/p/{slugPublico || "seu-link"}</span>
                    </p>
                  </div>
                  <InputField icon={<Phone />} type="text" placeholder="WhatsApp com DDD (Ex: 11 99999-9999)" value={telefoneWhatsapp} onChange={setTelefoneWhatsapp} />
                </div>
              </div>
              <hr className="border-slate-800" />
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Acesso
                </label>
                <div className="space-y-4">
                  <InputField icon={<Mail />} type="email" placeholder="E-mail de acesso" value={email} onChange={setEmail} />
                  <InputField icon={<Lock />} type="password" placeholder="Senha (mínimo 6 caracteres)" value={password} onChange={setPassword} />
                </div>
              </div>
              <SubmitButton loading={formLoading} success={success} label="Criar conta profissional" />
            </form>
          )}

          <p className="mt-6 text-center text-sm text-slate-400">
            Já tem conta?{" "}
            <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-all">
              Entrar agora
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function InputField({
  icon, type, placeholder, value, onChange,
}: {
  icon: React.ReactNode;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
        {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "h-5 w-5" })}
      </div>
      <input
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-100 placeholder-slate-500 text-sm transition-all"
      />
    </div>
  );
}

function SubmitButton({
  loading, success, label,
}: {
  loading: boolean;
  success: boolean;
  label: string;
}) {
  return (
    <button
      type="submit"
      disabled={loading || success}
      className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700/50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98] mt-2"
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><span>{label}</span><ChevronRight className="h-4 w-4" /></>}
    </button>
  );
}
