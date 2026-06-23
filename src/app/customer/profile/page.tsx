"use client";

import React, { useState } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "../../providers";
import { User, Mail, Phone, Save, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export default function CustomerProfilePage() {
  const { user, customerProfile, refreshCustomerProfile } = useAuth();

  const [name, setName] = useState(customerProfile?.name ?? "");
  const [phone, setPhone] = useState(customerProfile?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError("");
    setSaved(false);

    try {
      await updateDoc(doc(db, "customerAccounts", user.uid), {
        name: name.trim(),
        phone: phone.trim(),
        updatedAt: serverTimestamp(),
      });
      await refreshCustomerProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError("Erro ao salvar: " + e.message);
    }
    setSaving(false);
  };

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <User className="h-6 w-6 text-indigo-400" />
          Meu perfil
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Informações usadas para identificar você nos agendamentos.
        </p>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
        {error && (
          <div className="mb-5 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex gap-3 items-center">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}
        {saved && (
          <div className="mb-5 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex gap-3 items-center">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <p>Perfil atualizado com sucesso.</p>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          {/* E-mail (read-only) */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">E-mail</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-600">
                <Mail className="h-4 w-4" />
              </div>
              <input
                type="email"
                readOnly
                value={user?.email ?? ""}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-500 text-sm cursor-not-allowed"
              />
            </div>
            <p className="text-[11px] text-slate-600 mt-1 px-1">O e-mail não pode ser alterado aqui.</p>
          </div>

          {/* Nome */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Nome completo</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <User className="h-4 w-4" />
              </div>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                className="w-full pl-9 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-100 placeholder-slate-500 text-sm transition-all"
              />
            </div>
          </div>

          {/* Telefone */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Telefone (opcional)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Phone className="h-4 w-4" />
              </div>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 99999-9999"
                className="w-full pl-9 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-100 placeholder-slate-500 text-sm transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700/50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/20"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Save className="h-4 w-4" /><span>Salvar alterações</span></>}
          </button>
        </form>
      </div>
    </div>
  );
}
