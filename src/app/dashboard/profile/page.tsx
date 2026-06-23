"use client";

import React, { useEffect, useState } from "react";
import { doc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "../../providers";
import { formatPhoneFriendly, formatPhoneForWhatsApp } from "@/lib/whatsapp";
import { 
  User, 
  Briefcase, 
  Link as LinkIcon, 
  Phone, 
  FileText, 
  Palette, 
  Upload, 
  Loader2, 
  Check, 
  AlertCircle,
  ExternalLink,
  Eye
} from "lucide-react";
import Link from "next/link";

const prebuiltColors = [
  { value: "#6366f1", label: "Indigo" },
  { value: "#10b981", label: "Esmeralda" },
  { value: "#3b82f6", label: "Azul" },
  { value: "#8b5cf6", label: "Violeta" },
  { value: "#ec4899", label: "Rosa" },
  { value: "#f59e0b", label: "Âmbar" },
  { value: "#ef4444", label: "Vermelho" },
  { value: "#14b8a6", label: "Teal" }
];

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  
  const [nome, setNome] = useState("");
  const [nomeNegocio, setNomeNegocio] = useState("");
  const [slugPublico, setSlugPublico] = useState("");
  const [telefoneWhatsapp, setTelefoneWhatsapp] = useState("");
  const [descricaoCurta, setDescricaoCurta] = useState("");
  const [fotoLogoUrl, setFotoLogoUrl] = useState("");
  const [corPrincipal, setCorPrincipal] = useState("#6366f1");
  
  const [formLoading, setFormLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Load current values
  useEffect(() => {
    if (profile) {
      setNome(profile.nome || "");
      setNomeNegocio(profile.nomeNegocio || "");
      setSlugPublico(profile.slugPublico || "");
      setTelefoneWhatsapp(formatPhoneFriendly(profile.telefoneWhatsapp || ""));
      setDescricaoCurta(profile.descricaoCurta || "");
      setFotoLogoUrl(profile.fotoLogoUrl || "");
      setCorPrincipal(profile.corPrincipal || "#6366f1");
    }
  }, [profile]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadLoading(true);
    setError("");
    setSuccess("");

    try {
      const storageRef = ref(storage, `logos/${user.uid}/logo`);
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);
      setFotoLogoUrl(downloadUrl);
      setSuccess("Logo carregada! Lembre-se de salvar as alterações do perfil.");
    } catch (err: any) {
      console.error("Storage error:", err);
      setError("Erro ao enviar foto: " + err.message + ". Opcionalmente, configure as regras do Firebase Storage.");
    } finally {
      setUploadLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    setError("");
    setSuccess("");
    setFormLoading(true);

    const cleanSlug = slugPublico.toLowerCase().replace(/[^a-z0-9-]/g, "").trim();
    if (!cleanSlug) {
      setError("Slug inválido.");
      setFormLoading(false);
      return;
    }

    const cleanPhone = formatPhoneForWhatsApp(telefoneWhatsapp);
    if (cleanPhone.length < 10) {
      setError("WhatsApp inválido. Inclua DDD.");
      setFormLoading(false);
      return;
    }

    try {
      // If slug has changed, verify uniqueness
      if (cleanSlug !== profile.slugPublico) {
        const professionalsRef = collection(db, "professionals");
        const q = query(professionalsRef, where("slugPublico", "==", cleanSlug));
        const checkSnap = await getDocs(q);

        if (!checkSnap.empty) {
          setError("Este link público (slug) já está sendo utilizado por outro profissional.");
          setFormLoading(false);
          return;
        }
      }

      // Update document
      const profDocRef = doc(db, "professionals", user.uid);
      await updateDoc(profDocRef, {
        nome: nome.trim(),
        nomeNegocio: nomeNegocio.trim(),
        slugPublico: cleanSlug,
        telefoneWhatsapp: cleanPhone,
        descricaoCurta: descricaoCurta.trim(),
        fotoLogoUrl,
        corPrincipal,
        updatedAt: new Date()
      });

      await refreshProfile();
      setSuccess("Perfil atualizado com sucesso!");
    } catch (err: any) {
      console.error(err);
      setError("Erro ao salvar perfil: " + err.message);
    } finally {
      setFormLoading(false);
    }
  };

  // Get Initials for preview avatar fallback
  const getInitials = () => {
    if (!nomeNegocio) return "AZ";
    return nomeNegocio.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Configurações do Perfil</h1>
          <p className="text-sm text-slate-400">Edite as informações exibidas na sua página pública de pré-agendamento.</p>
        </div>
        {profile?.slugPublico && (
          <Link
            href={`/p/${profile.slugPublico}`}
            target="_blank"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold rounded-xl text-sm border border-slate-800 transition-all self-start sm:self-auto"
          >
            <Eye className="h-4 w-4" />
            <span>Visualizar Página Pública</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex gap-3 items-center">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex gap-3 items-center">
          <Check className="h-5 w-5 shrink-0" />
          <p className="font-medium">{success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Editor Form */}
        <div className="lg:col-span-2 bg-slate-900/40 border border-slate-800 rounded-3xl p-5 md:p-6 backdrop-blur-sm">
          <form onSubmit={handleSaveProfile} className="space-y-6">
            
            {/* Logo / Banner Section */}
            <div className="flex flex-col sm:flex-row items-center gap-5 pb-2">
              <div className="relative h-20 w-20 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                {fotoLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fotoLogoUrl} alt="Logo" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xl font-bold text-slate-500">{getInitials()}</span>
                )}
                {uploadLoading && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />
                  </div>
                )}
              </div>
              
              <div className="space-y-1 text-center sm:text-left">
                <h3 className="font-bold text-sm text-slate-200">Foto / Logo do Negócio</h3>
                <p className="text-xs text-slate-500 max-w-xs">PNG, JPG de até 2MB. A foto é salva no Firebase Storage.</p>
                <div className="flex justify-center sm:justify-start pt-1.5">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 border border-slate-800 hover:border-indigo-500/40 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-lg transition-all">
                    <Upload className="h-3.5 w-3.5" />
                    <span>Upload de Foto</span>
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
              </div>
            </div>

            <hr className="border-slate-800" />

            {/* Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Business Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Nome do Negócio</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500"><Briefcase className="h-4 w-4" /></span>
                  <input
                    type="text"
                    required
                    value={nomeNegocio}
                    onChange={(e) => setNomeNegocio(e.target.value)}
                    placeholder="Ex: Barber Shop"
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-100 text-sm transition-all"
                  />
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Seu Nome Completo</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500"><User className="h-4 w-4" /></span>
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: João da Silva"
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-100 text-sm transition-all"
                  />
                </div>
              </div>

              {/* Public Slug */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Link da Página Pública (Slug)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500"><LinkIcon className="h-4 w-4" /></span>
                  <input
                    type="text"
                    required
                    value={slugPublico}
                    onChange={(e) => setSlugPublico(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    placeholder="link-da-pagina"
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-100 text-sm transition-all"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1 pl-1">
                  Seu link: <span className="font-mono text-indigo-400">/p/{slugPublico || "link"}</span>
                </p>
              </div>

              {/* WhatsApp */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">WhatsApp de Contato</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500"><Phone className="h-4 w-4" /></span>
                  <input
                    type="text"
                    required
                    value={telefoneWhatsapp}
                    onChange={(e) => setTelefoneWhatsapp(e.target.value)}
                    placeholder="Ex: (11) 99999-9999"
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-100 text-sm transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Bio / Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Descrição Curta / Boas-vindas</label>
              <div className="relative">
                <span className="absolute top-3 left-3 text-slate-500"><FileText className="h-4 w-4" /></span>
                <textarea
                  value={descricaoCurta}
                  onChange={(e) => setDescricaoCurta(e.target.value)}
                  placeholder="Texto de boas-vindas exibido no topo da sua página..."
                  rows={3}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-100 text-sm transition-all resize-none"
                />
              </div>
            </div>

            <hr className="border-slate-800" />

            {/* Colors System */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Palette className="h-4 w-4 text-indigo-400" />
                <span>Cor Principal da Página</span>
              </label>
              <div className="flex flex-wrap gap-2 mb-4">
                {prebuiltColors.map(color => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setCorPrincipal(color.value)}
                    className="h-8 px-3 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5"
                    style={{ 
                      backgroundColor: `${color.value}15`, 
                      borderColor: corPrincipal === color.value ? color.value : "transparent",
                      color: color.value
                    }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color.value }} />
                    <span>{color.label}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={corPrincipal}
                  onChange={(e) => setCorPrincipal(e.target.value)}
                  className="h-9 w-9 rounded-lg border border-slate-800 bg-slate-950 p-1 cursor-pointer shrink-0"
                />
                <span className="text-xs text-slate-400 font-mono">Personalizar hexadecimal: {corPrincipal}</span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={formLoading}
              className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700/50 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {formLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "Salvar Perfil"
              )}
            </button>
          </form>
        </div>

        {/* Dynamic Card Preview */}
        <div className="lg:col-span-1 bg-slate-900/40 border border-slate-800 rounded-3xl p-5 md:p-6 backdrop-blur-sm space-y-6">
          <div>
            <h3 className="font-bold text-sm text-slate-400 uppercase tracking-wider mb-1">Visualização do Cliente</h3>
            <p className="text-xs text-slate-500">Como seu cartão principal aparecerá no topo da sua página pública.</p>
          </div>

          {/* Simulated Mobile Mockup Card */}
          <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-5 shadow-2xl relative overflow-hidden flex flex-col items-center text-center">
            {/* Color Accent Indicator */}
            <div className="absolute top-0 inset-x-0 h-2" style={{ backgroundColor: corPrincipal }} />

            {/* Avatar logo */}
            <div className="h-16 w-16 rounded-2xl border border-slate-800 bg-slate-900 flex items-center justify-center overflow-hidden mb-4 shadow-md mt-2">
              {fotoLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fotoLogoUrl} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <span className="text-lg font-extrabold" style={{ color: corPrincipal }}>{getInitials()}</span>
              )}
            </div>

            {/* Names */}
            <h2 className="text-lg font-bold text-slate-100 truncate w-full">{nomeNegocio || "Nome do Negócio"}</h2>
            <p className="text-xs text-slate-500 font-semibold mt-0.5 truncate w-full">Por {nome || "Seu Nome"}</p>
            
            {/* Bio */}
            <p className="text-xs text-slate-400 mt-3 line-clamp-3 leading-relaxed max-w-[200px]">
              {descricaoCurta || "Espaço reservado para as boas-vindas do seu cliente."}
            </p>

            {/* Phone */}
            <div className="mt-4 pt-3 border-t border-slate-800/60 w-full text-xs text-slate-500 flex items-center justify-center gap-1">
              <Phone className="h-3 w-3" />
              <span>{telefoneWhatsapp || "(00) 00000-0000"}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
