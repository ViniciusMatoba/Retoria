"use client";

import React, { useEffect, useState, useCallback } from "react";
import { doc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "../../providers";
import { formatPhoneFriendly, formatPhoneForWhatsApp } from "@/lib/whatsapp";
import {
  PublicAddress,
  ServiceLocationType,
  SERVICE_LOCATION_LABELS,
  isValidPhone,
  validateCoordinates,
} from "@/lib/contactUtils";
import ThemePreview from "@/app/dashboard/personalization/components/ThemePreview";
import { getDefaultThemeConfig } from "@/lib/themeUtils";
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
  Eye,
  MapPin,
  ChevronDown,
  ChevronUp,
  Info,
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
  { value: "#14b8a6", label: "Teal" },
];

const SERVICE_LOCATION_OPTIONS: { value: ServiceLocationType; label: string }[] = [
  { value: "physical", label: "Atendimento presencial" },
  { value: "online", label: "Atendimento on-line" },
  { value: "both", label: "Presencial e on-line" },
  { value: "mobile", label: "Atendimento em domicílio" },
];

const WELCOME_MAX = 240;

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();

  // ── Core fields ──────────────────────────────────────────────────────────
  const [nome, setNome] = useState("");
  const [nomeNegocio, setNomeNegocio] = useState("");
  const [slugPublico, setSlugPublico] = useState("");
  const [telefoneWhatsapp, setTelefoneWhatsapp] = useState("");
  const [descricaoCurta, setDescricaoCurta] = useState("");
  const [fotoLogoUrl, setFotoLogoUrl] = useState("");
  const [corPrincipal, setCorPrincipal] = useState("#6366f1");

  // ── Public info fields ────────────────────────────────────────────────────
  const [publicPhone, setPublicPhone] = useState("");
  const [serviceLocationType, setServiceLocationType] = useState<ServiceLocationType>("physical");
  const [publicAddress, setPublicAddress] = useState<PublicAddress>({
    street: "", number: "", complement: "", neighborhood: "",
    city: "", state: "", postalCode: "", country: "Brasil",
    latitude: null, longitude: null,
  });

  // ── Visibility flags ──────────────────────────────────────────────────────
  const [showResponsibleName, setShowResponsibleName] = useState(true);
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(true);
  const [showPublicPhone, setShowPublicPhone] = useState(false);
  const [showPublicWhatsApp, setShowPublicWhatsApp] = useState(false);
  const [showPublicAddress, setShowPublicAddress] = useState(false);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [formLoading, setFormLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showCoordsPanel, setShowCoordsPanel] = useState(false);
  const [privacyWarning, setPrivacyWarning] = useState<string | null>(null);
  const [savingToggle, setSavingToggle] = useState<string | null>(null);
  const [toggleSaved, setToggleSaved] = useState<string | null>(null);

  // ── Load profile ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!profile) return;
    setNome(profile.nome || "");
    setNomeNegocio(profile.nomeNegocio || "");
    setSlugPublico(profile.slugPublico || "");
    setTelefoneWhatsapp(formatPhoneFriendly(profile.telefoneWhatsapp || ""));
    setDescricaoCurta(profile.descricaoCurta || "");
    setFotoLogoUrl(profile.fotoLogoUrl || "");
    setCorPrincipal(profile.corPrincipal || "#6366f1");

    setPublicPhone(formatPhoneFriendly(profile.publicPhone || ""));
    setServiceLocationType((profile.serviceLocationType as ServiceLocationType) || "physical");
    if (profile.publicAddress) {
      setPublicAddress({ ...publicAddress, ...profile.publicAddress });
    }

    setShowResponsibleName(profile.showResponsibleName ?? true);
    setShowWelcomeMessage(profile.showWelcomeMessage ?? true);
    setShowPublicPhone(profile.showPublicPhone ?? false);
    setShowPublicWhatsApp(profile.showPublicWhatsApp ?? false);
    setShowPublicAddress(profile.showPublicAddress ?? false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setError("Erro ao enviar foto: " + err.message);
    } finally {
      setUploadLoading(false);
    }
  };


  // Auto-save individual toggle flags directly to Firestore
  const handleToggle = useCallback(async (field: string, value: boolean) => {
    if (!user) return;
    // Update local state immediately
    switch (field) {
      case "showResponsibleName": setShowResponsibleName(value); break;
      case "showWelcomeMessage": setShowWelcomeMessage(value); break;
      case "showPublicPhone": setShowPublicPhone(value); break;
      case "showPublicWhatsApp": setShowPublicWhatsApp(value); break;
      case "showPublicAddress": {
        setShowPublicAddress(value);
        if (value) setPrivacyWarning("Este endereço ficará visível para qualquer pessoa que acessar sua página pública.");
        else setPrivacyWarning(null);
        break;
      }
    }
    setSavingToggle(field);
    setToggleSaved(null);
    try {
      await updateDoc(doc(db, "professionals", user.uid), { [field]: value });
      setToggleSaved(field);
      setTimeout(() => setToggleSaved(null), 1500);
    } catch (err: any) {
      console.error("Toggle save error:", err);
    } finally {
      setSavingToggle(null);
    }
  }, [user]);

  const handleAddressField = (key: keyof PublicAddress, value: string | number | null) => {
    setPublicAddress((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    setError("");
    setSuccess("");
    setFormLoading(true);

    const cleanSlug = slugPublico.toLowerCase().replace(/[^a-z0-9-]/g, "").trim();
    if (!cleanSlug) { setError("Slug inválido."); setFormLoading(false); return; }

    const cleanPhone = formatPhoneForWhatsApp(telefoneWhatsapp);
    if (cleanPhone.length < 10) { setError("WhatsApp inválido. Inclua DDD."); setFormLoading(false); return; }

    // Validate optional public phone
    const cleanPublicPhone = publicPhone ? formatPhoneForWhatsApp(publicPhone) : "";
    if (showPublicPhone && cleanPublicPhone && !isValidPhone(cleanPublicPhone)) {
      setError("Telefone de contato público inválido.");
      setFormLoading(false);
      return;
    }

    // Validate coordinates if provided
    const lat = publicAddress.latitude;
    const lng = publicAddress.longitude;
    if ((lat != null || lng != null) && !validateCoordinates(lat, lng)) {
      setError("Coordenadas inválidas. Latitude: -90 a 90. Longitude: -180 a 180.");
      setFormLoading(false);
      return;
    }

    // Validate welcome message length
    const cleanMsg = descricaoCurta.replace(/<[^>]*>/g, "").trim();
    if (cleanMsg.length > WELCOME_MAX) {
      setError(`A mensagem de boas-vindas deve ter no máximo ${WELCOME_MAX} caracteres.`);
      setFormLoading(false);
      return;
    }

    try {
      if (cleanSlug !== profile.slugPublico) {
        const q = query(collection(db, "professionals"), where("slugPublico", "==", cleanSlug));
        const snap = await getDocs(q);
        if (!snap.empty) { setError("Este link público já está em uso."); setFormLoading(false); return; }
      }

      const profDocRef = doc(db, "professionals", user.uid);
      await updateDoc(profDocRef, {
        nome: nome.trim(),
        nomeNegocio: nomeNegocio.trim(),
        slugPublico: cleanSlug,
        telefoneWhatsapp: cleanPhone,
        descricaoCurta: cleanMsg,
        fotoLogoUrl,
        corPrincipal,
        // Public info
        publicPhone: cleanPublicPhone || null,
        serviceLocationType,
        publicAddress: showPublicAddress ? {
          street: publicAddress.street.trim(),
          number: publicAddress.number.trim(),
          complement: publicAddress.complement?.trim() || null,
          neighborhood: publicAddress.neighborhood?.trim() || null,
          city: publicAddress.city.trim(),
          state: publicAddress.state.trim(),
          postalCode: publicAddress.postalCode?.trim() || null,
          country: publicAddress.country || "Brasil",
          latitude: lat ?? null,
          longitude: lng ?? null,
        } : null,
        // Visibility
        showResponsibleName,
        showWelcomeMessage,
        showPublicPhone: showPublicPhone && !!cleanPublicPhone,
        showPublicWhatsApp,
        showPublicAddress,
        updatedAt: new Date(),
      });

      await refreshProfile();
      setPrivacyWarning(null);
      setSuccess("Perfil atualizado com sucesso!");
    } catch (err: any) {
      setError("Erro ao salvar perfil: " + err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const getInitials = () => {
    if (!nomeNegocio) return "AZ";
    return nomeNegocio.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  };

  const welcomeLen = descricaoCurta.replace(/<[^>]*>/g, "").trim().length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Configurações do Perfil</h1>
          <p className="text-sm text-slate-400">Edite as informações exibidas na sua página pública de pré-agendamento.</p>
        </div>
        {profile?.slugPublico && (
          <Link href={`/p/${profile.slugPublico}`} target="_blank" className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold rounded-xl text-sm border border-slate-800 transition-all self-start sm:self-auto">
            <Eye className="h-4 w-4" />
            <span>Visualizar Página Pública</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex gap-3 items-center">
          <AlertCircle className="h-5 w-5 shrink-0" /><p className="font-medium">{error}</p>
        </div>
      )}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex gap-3 items-center">
          <Check className="h-5 w-5 shrink-0" /><p className="font-medium">{success}</p>
        </div>
      )}
      {privacyWarning && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm flex gap-3 items-start">
          <Info className="h-5 w-5 shrink-0 mt-0.5" /><p className="font-medium">{privacyWarning}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* ── Editor Form ────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSaveProfile} className="space-y-6">

            {/* ── Section: Logo ─────────────────────────────────────────── */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-5 md:p-6 backdrop-blur-sm">
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
                  <p className="text-xs text-slate-500 max-w-xs">PNG, JPG de até 2MB.</p>
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 border border-slate-800 hover:border-indigo-500/40 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-lg transition-all">
                    <Upload className="h-3.5 w-3.5" />
                    <span>Upload de Foto</span>
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
              </div>
            </div>

            {/* ── Section: Identity ─────────────────────────────────────── */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-5 md:p-6 backdrop-blur-sm space-y-5">
              <h2 className="text-sm font-bold text-slate-300">Identidade</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Nome do Negócio</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500"><Briefcase className="h-4 w-4" /></span>
                    <input type="text" required value={nomeNegocio} onChange={(e) => setNomeNegocio(e.target.value)} placeholder="Ex: Barber Shop" className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-100 text-sm transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Seu Nome Completo</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500"><User className="h-4 w-4" /></span>
                    <input type="text" required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: João da Silva" className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-100 text-sm transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Link Público (Slug)</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500"><LinkIcon className="h-4 w-4" /></span>
                    <input type="text" required value={slugPublico} onChange={(e) => setSlugPublico(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="link-da-pagina" className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-100 text-sm transition-all" />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 pl-1">Seu link: <span className="font-mono text-indigo-400">/p/{slugPublico || "link"}</span></p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">WhatsApp de Agendamento *</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500"><Phone className="h-4 w-4" /></span>
                    <input type="text" required value={telefoneWhatsapp} onChange={(e) => setTelefoneWhatsapp(e.target.value)} placeholder="Ex: (11) 99999-9999" className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-100 text-sm transition-all" />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 pl-1">Usado para receber agendamentos. Pode ser exibido publicamente abaixo.</p>
                </div>
              </div>

              {/* Welcome message */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Mensagem de Boas-vindas</label>
                  <span className={`text-[10px] font-mono ${welcomeLen > WELCOME_MAX ? "text-red-400" : welcomeLen > WELCOME_MAX * 0.85 ? "text-amber-400" : "text-slate-500"}`}>
                    {welcomeLen}/{WELCOME_MAX}
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute top-3 left-3 text-slate-500"><FileText className="h-4 w-4" /></span>
                  <textarea
                    value={descricaoCurta}
                    onChange={(e) => setDescricaoCurta(e.target.value)}
                    placeholder="Seja bem-vindo! Escolha um serviço e encontre o melhor horário para você."
                    rows={3}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-100 text-sm transition-all resize-none"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1 pl-1">Exibida no topo da sua página pública. Apenas texto, sem formatação.</p>
              </div>
            </div>


            {/* ── Section: Contato público ─────────────────────────────── */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-5 md:p-6 backdrop-blur-sm space-y-5">
              <h2 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                <Phone className="h-4 w-4 text-slate-400" />
                Contato Público
              </h2>

              {/* Telefone de voz separado */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Telefone de Contato (voz)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500"><Phone className="h-4 w-4" /></span>
                  <input type="text" value={publicPhone} onChange={(e) => setPublicPhone(e.target.value)} placeholder="Ex: (11) 3333-3333" className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-100 text-sm transition-all" />
                </div>
                <p className="text-[10px] text-slate-500 mt-1 pl-1">Opcional. Para ligações, diferente do WhatsApp de agendamento.</p>
              </div>

              {/* Visibility toggles */}
              <div className="space-y-3">
                <ToggleRow
                  label="Exibir nome do responsável"
                  checked={showResponsibleName}
                  onChange={(v) => handleToggle("showResponsibleName", v)}
                  saving={savingToggle === "showResponsibleName"}
                  saved={toggleSaved === "showResponsibleName"}
                />
                <ToggleRow
                  label="Exibir mensagem de boas-vindas"
                  checked={showWelcomeMessage}
                  onChange={(v) => handleToggle("showWelcomeMessage", v)}
                  saving={savingToggle === "showWelcomeMessage"}
                  saved={toggleSaved === "showWelcomeMessage"}
                />
                <ToggleRow
                  label="Exibir telefone de contato publicamente"
                  checked={showPublicPhone}
                  onChange={(v) => handleToggle("showPublicPhone", v)}
                  disabled={!publicPhone}
                  hint={!publicPhone ? "Preencha o telefone acima para ativar" : undefined}
                  saving={savingToggle === "showPublicPhone"}
                  saved={toggleSaved === "showPublicPhone"}
                />
                <ToggleRow
                  label="Exibir WhatsApp de agendamento publicamente"
                  checked={showPublicWhatsApp}
                  onChange={(v) => handleToggle("showPublicWhatsApp", v)}
                  saving={savingToggle === "showPublicWhatsApp"}
                  saved={toggleSaved === "showPublicWhatsApp"}
                />
              </div>
            </div>

            {/* ── Section: Local de atendimento ────────────────────────── */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-5 md:p-6 backdrop-blur-sm space-y-5">
              <h2 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-slate-400" />
                Local de Atendimento
              </h2>

              {/* Type selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Tipo de atendimento</label>
                <div className="grid grid-cols-2 gap-2">
                  {SERVICE_LOCATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setServiceLocationType(opt.value)}
                      className={`px-3 py-2.5 rounded-xl border text-xs font-semibold text-left transition-all ${serviceLocationType === opt.value ? "border-indigo-500 bg-indigo-500/10 text-indigo-300" : "border-slate-800 text-slate-400 hover:border-slate-700"}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Address fields — shown when physical / both */}
              {(serviceLocationType === "physical" || serviceLocationType === "both") && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Logradouro</label>
                      <input type="text" value={publicAddress.street} onChange={(e) => handleAddressField("street", e.target.value)} placeholder="Ex: Rua das Flores" className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-100 text-sm transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Número</label>
                      <input type="text" value={publicAddress.number} onChange={(e) => handleAddressField("number", e.target.value)} placeholder="Ex: 123" className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-100 text-sm transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Complemento</label>
                      <input type="text" value={publicAddress.complement || ""} onChange={(e) => handleAddressField("complement", e.target.value)} placeholder="Ex: Sala 2" className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-100 text-sm transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Bairro</label>
                      <input type="text" value={publicAddress.neighborhood || ""} onChange={(e) => handleAddressField("neighborhood", e.target.value)} placeholder="Ex: Centro" className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-100 text-sm transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Cidade *</label>
                      <input type="text" value={publicAddress.city} onChange={(e) => handleAddressField("city", e.target.value)} placeholder="Ex: São Paulo" className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-100 text-sm transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Estado (sigla) *</label>
                      <input type="text" value={publicAddress.state} onChange={(e) => handleAddressField("state", e.target.value.toUpperCase().slice(0, 2))} placeholder="SP" maxLength={2} className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-100 text-sm transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">CEP</label>
                      <input type="text" value={publicAddress.postalCode || ""} onChange={(e) => handleAddressField("postalCode", e.target.value)} placeholder="Ex: 01310-100" className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-100 text-sm transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">País</label>
                      <input type="text" value={publicAddress.country} onChange={(e) => handleAddressField("country", e.target.value)} placeholder="Brasil" className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-100 text-sm transition-all" />
                    </div>
                  </div>

                  {/* Coords panel */}
                  <div className="border border-slate-800 rounded-2xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowCoordsPanel(!showCoordsPanel)}
                      className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-slate-400 hover:text-slate-300 transition-colors"
                    >
                      <span>Localização precisa (opcional)</span>
                      {showCoordsPanel ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                    {showCoordsPanel && (
                      <div className="px-4 pb-4 grid grid-cols-2 gap-4 border-t border-slate-800">
                        <div className="pt-4">
                          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Latitude</label>
                          <input
                            type="number"
                            step="any"
                            min={-90}
                            max={90}
                            value={publicAddress.latitude ?? ""}
                            onChange={(e) => handleAddressField("latitude", e.target.value ? parseFloat(e.target.value) : null)}
                            placeholder="-23.5505"
                            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-100 text-sm transition-all"
                          />
                        </div>
                        <div className="pt-4">
                          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Longitude</label>
                          <input
                            type="number"
                            step="any"
                            min={-180}
                            max={180}
                            value={publicAddress.longitude ?? ""}
                            onChange={(e) => handleAddressField("longitude", e.target.value ? parseFloat(e.target.value) : null)}
                            placeholder="-46.6333"
                            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-100 text-sm transition-all"
                          />
                        </div>
                        <p className="col-span-2 text-[10px] text-slate-500">Melhora a precisão dos links para Google Maps e Waze.</p>
                      </div>
                    )}
                  </div>

                  <ToggleRow
                    label="Exibir endereço na página pública"
                    checked={showPublicAddress}
                    onChange={(v) => handleToggle("showPublicAddress", v)}
                    hint="Ativar tornará o endereço visível para qualquer visitante."
                    saving={savingToggle === "showPublicAddress"}
                    saved={toggleSaved === "showPublicAddress"}
                  />
                </div>
              )}
            </div>

            {/* ── Submit ────────────────────────────────────────────────── */}
            <button
              type="submit"
              disabled={formLoading}
              className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700/50 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {formLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Salvar Perfil"}
            </button>
          </form>
        </div>

        {/* ── Preview card ───────────────────────────────────────────────── */}
        <div className="lg:col-span-1">
          <ThemePreview
            themeConfig={profile?.themeConfig ?? getDefaultThemeConfig()}
            businessName={nomeNegocio}
            professionalName={nome}
            fotoLogoUrl={fotoLogoUrl}
            descricaoCurta={descricaoCurta}
            showResponsibleName={showResponsibleName}
            showWelcomeMessage={showWelcomeMessage}
          />
        </div>

      </div>
    </div>
  );
}

// ── Shared toggle component ───────────────────────────────────────────────────

interface ToggleRowProps {
  label: string;
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
  hint?: string;
  saving?: boolean;
  saved?: boolean;
}

function ToggleRow({ label, checked, onChange, disabled, hint, saving, saved }: ToggleRowProps) {
  return (
    <div className={`flex items-center justify-between gap-3 py-0.5 ${disabled ? "opacity-50" : ""}`}>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-300">{label}</p>
        {hint && <p className="text-[10px] text-slate-500 mt-0.5">{hint}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {saving && <Loader2 className="h-3 w-3 text-indigo-400 animate-spin" />}
        {saved && !saving && <Check className="h-3 w-3 text-emerald-400" />}
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled || saving}
          onClick={() => !disabled && !saving && onChange(!checked)}
          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${checked ? "bg-indigo-600" : "bg-slate-600"} ${disabled || saving ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? "translate-x-5" : "translate-x-0"}`}
          />
        </button>
      </div>
    </div>
  );
}
