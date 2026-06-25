"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/app/providers";
import { CalendarCheck, CalendarX, Loader2, CheckCircle, XCircle } from "lucide-react";

export default function GoogleCalendarIntegration() {
  const { user } = useAuth();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Lê status de conexão em tempo real
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "professionals", user.uid, "integrations", "google");
    const unsub = onSnapshot(ref, (snap) => {
      setConnected(snap.exists() && snap.data()?.connected === true);
    });
    return () => unsub();
  }, [user]);

  // Lê ?google_connected=1 ou ?google_error=... na URL após o callback OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("google_connected") === "1") {
      setToast({ type: "success", msg: "Google Calendar conectado com sucesso!" });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("google_error")) {
      setToast({ type: "error", msg: "Erro ao conectar o Google Calendar. Tente novamente." });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Esconde o toast após 4 segundos
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleConnect = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/auth/google/connect", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setToast({ type: "error", msg: "Não foi possível iniciar a conexão." });
        setLoading(false);
      }
    } catch {
      setToast({ type: "error", msg: "Erro ao conectar. Tente novamente." });
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user || !confirm("Desconectar o Google Calendar? Novos agendamentos não criarão eventos automáticos.")) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      await fetch("/api/auth/google/disconnect", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setToast({ type: "success", msg: "Google Calendar desconectado." });
    } catch {
      setToast({ type: "error", msg: "Erro ao desconectar. Tente novamente." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Google Calendar icon */}
          <div className={`p-2.5 rounded-xl ${connected ? "bg-emerald-500/10" : "bg-slate-700/50"}`}>
            <CalendarCheck className={`h-5 w-5 ${connected ? "text-emerald-400" : "text-slate-400"}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Google Calendar</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {connected === null
                ? "Verificando..."
                : connected
                ? "Conectado — novos agendamentos criam eventos automaticamente"
                : "Desconectado — conecte para criar eventos automaticamente"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {connected === null ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
          ) : connected ? (
            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
              Desconectar
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
              Conectar
            </button>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`mt-3 flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${
          toast.type === "success"
            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            : "bg-red-500/10 text-red-400 border-red-500/20"
        }`}>
          {toast.type === "success"
            ? <CheckCircle className="h-3.5 w-3.5 shrink-0" />
            : <XCircle className="h-3.5 w-3.5 shrink-0" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
