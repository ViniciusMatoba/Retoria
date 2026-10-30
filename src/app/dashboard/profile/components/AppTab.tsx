"use client";

import React, { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Smartphone, Upload, Copy, Check, Loader2, AlertCircle, ExternalLink } from "lucide-react";
import ImageCropModal from "@/components/ImageCropModal";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "../../../providers";

const APP_NAME_MAX = 30;

// Redimensiona o recorte para um PNG quadrado de 512px (formato exigido para ícone de app).
async function toSquarePng(blob: Blob, size = 512): Promise<Blob> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Imagem inválida"));
      i.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponível");
    ctx.drawImage(img, 0, 0, size, size);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar PNG"))), "image/png")
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function AppTab() {
  const { user, profile } = useAuth();
  const [appName, setAppName] = useState("");
  const [appIconUrl, setAppIconUrl] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "professionals", user.uid))
      .then((snap) => {
        const d = snap.data() ?? {};
        setAppName(d.appName ?? "");
        setAppIconUrl(d.appIconUrl ?? "");
      })
      .finally(() => setLoaded(true));
  }, [user]);

  const slug = profile?.slugPublico ?? "";
  const shareLink = typeof window !== "undefined" && slug ? `${window.location.origin}/p/${slug}` : "";
  const effectiveName = appName.trim() || profile?.nomeNegocio || profile?.nome || "Meu app";

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { setError("Use uma imagem JPG, PNG ou WebP."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("A imagem deve ter no máximo 5MB."); return; }
    setError("");
    setCropSrc(URL.createObjectURL(file));
  };

  const handleCropConfirm = async (blob: Blob) => {
    if (!user) return;
    setCropSrc(null);
    setUploading(true);
    setError("");
    setSuccess("");
    try {
      const png = await toSquarePng(blob);
      // Caminho já liberado nas regras do Storage para o dono (services/{uid}/{id}/cover, até 2MB, imagem).
      const storageRef = ref(storage, `services/${user.uid}/__appicon/cover`);
      await uploadBytes(storageRef, png, { contentType: "image/png" });
      setAppIconUrl(await getDownloadURL(storageRef));
      setSuccess("Ícone carregado! Clique em Salvar para aplicar.");
    } catch (err: any) {
      setError("Erro ao enviar o ícone: " + (err?.message ?? "tente novamente"));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await updateDoc(doc(db, "professionals", user.uid), {
        appName: appName.trim().slice(0, APP_NAME_MAX),
        appIconUrl,
        updatedAt: new Date(),
      });
      setSuccess("App atualizado! Clientes que já instalaram podem demorar a ver o novo nome/ícone.");
    } catch (err: any) {
      setError("Erro ao salvar: " + (err?.message ?? "tente novamente"));
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Não foi possível copiar. Selecione o link e copie manualmente.");
    }
  };

  if (!loaded) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 text-indigo-500 animate-spin" /></div>;
  }

  return (
    <>
      {cropSrc && (
        <ImageCropModal
          src={cropSrc}
          aspect={1}
          title="Ajustar ícone do app"
          onConfirm={(blob) => handleCropConfirm(blob)}
          onClose={() => { URL.revokeObjectURL(cropSrc); setCropSrc(null); }}
        />
      )}
      <div className="max-w-2xl space-y-6">
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-indigo-400" /> App para seus clientes
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Defina o nome e o ícone que aparecem na tela inicial do celular do cliente ao instalar o app, e compartilhe o link.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex gap-2 items-center">
              <AlertCircle className="h-4 w-4 shrink-0" /><p className="font-semibold">{error}</p>
            </div>
          )}
          {success && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">{success}</div>
          )}

          <div className="flex items-center gap-5">
            <div className="h-20 w-20 rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 flex items-center justify-center shrink-0">
              {appIconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={appIconUrl} alt="Ícone do app" className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl font-black text-slate-500">{effectiveName.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="space-y-1">
              <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-950 hover:bg-slate-800 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 cursor-pointer">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {appIconUrl ? "Trocar ícone" : "Enviar ícone"}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFile} disabled={uploading} />
              </label>
              <p className="text-[10px] text-slate-500">Imagem quadrada, de preferência 512×512. Sem ícone, usamos a inicial do nome.</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">Nome do app</label>
            <input
              type="text"
              value={appName}
              maxLength={APP_NAME_MAX}
              onChange={(e) => setAppName(e.target.value)}
              placeholder={profile?.nomeNegocio || profile?.nome || "Ex: Studio Maria"}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
            />
            <p className="text-[10px] text-slate-500">Até {APP_NAME_MAX} caracteres. Nomes curtos aparecem inteiros sob o ícone.</p>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || uploading}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar
          </button>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-3">
          <h3 className="text-sm font-bold text-white">Link para compartilhar</h3>
          {slug ? (
            <>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={shareLink}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 min-w-0 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-4 py-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copiado" : "Copiar"}
                </button>
              </div>
              <a href={shareLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold">
                Abrir como o cliente vê <ExternalLink className="h-3 w-3" />
              </a>
              <div className="text-[11px] text-slate-400 space-y-1 pt-2 border-t border-slate-800">
                <p><span className="font-bold text-slate-300">Android:</span> o cliente abre o link no Chrome e toca em &quot;Instalar app&quot;.</p>
                <p><span className="font-bold text-slate-300">iPhone:</span> abre no Safari, toca em Compartilhar e depois em &quot;Adicionar à Tela de Início&quot;.</p>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-500">Defina o link da sua página na aba Perfil para gerar o link do app.</p>
          )}
        </div>
      </div>
    </>
  );
}
