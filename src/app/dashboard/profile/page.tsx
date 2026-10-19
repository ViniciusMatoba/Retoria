"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import ImageCropModal from "@/components/ImageCropModal";
import { doc, updateDoc, collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "../../providers";
import { formatPhoneFriendly, formatPhoneForWhatsApp, maskPhone } from "@/lib/whatsapp";
import {
  PublicAddress,
  ServiceLocationType,
  SERVICE_LOCATION_LABELS,
  isValidPhone,
  validateCoordinates,
  cleanInstagramUsername,
} from "@/lib/contactUtils";
import ThemePreview from "@/app/dashboard/personalization/components/ThemePreview";
import { getDefaultThemeConfig, type ThemeConfig } from "@/lib/themeUtils";
import { useAppModal } from "@/components/ModalProvider";
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
  MessageSquare,
} from "lucide-react";
import Link from "next/link";

const Instagram = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

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
  const { showSuccessModal } = useAppModal();

  // ── Core fields ──────────────────────────────────────────────────────────
  const [nome, setNome] = useState("");
  const [nomeNegocio, setNomeNegocio] = useState("");
  const [slugPublico, setSlugPublico] = useState("");
  const [telefoneWhatsapp, setTelefoneWhatsapp] = useState("");
  const [descricaoCurta, setDescricaoCurta] = useState("");
  const [fotoLogoUrl, setFotoLogoUrl] = useState("");
  const [corPrincipal, setCorPrincipal] = useState("#6366f1");
  const [instagram, setInstagram] = useState("");

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
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [showPublicInstagram, setShowPublicInstagram] = useState(false);

  // ── Theme image settings ──────────────────────────────────────────────────
  const [showProfileImage, setShowProfileImage] = useState(true);
  const [profileImageSize, setProfileImageSize] = useState<"sm" | "md" | "lg" | "xl">("md");
  const [showServiceImages, setShowServiceImages] = useState(true);

  // ── Message templates ─────────────────────────────────────────────────────
  const DEFAULT_TEMPLATES: Record<string, string> = {
    "Novo":             "Olá {nome}! Recebi seu pedido de agendamento para {servico} em {data} às {horario}. Vou confirmar em breve! 😊",
    "Em contato":       "Olá {nome}, estou entrando em contato sobre seu agendamento de {servico} em {data} às {horario}. Podemos conversar?",
    "Agendado":         "Olá {nome}! Seu agendamento de {servico} foi realizado para {data} às {horario}. Qualquer imprevisto, é só nos avisar! 📅",
    "Lembrete":         "Olá {nome}! Passando para lembrar do seu agendamento de {servico} em {data} às {horario}. Posso confirmar sua presença? 😊",
    "Confirmado":       "Olá {nome}! Seu agendamento de {servico} está confirmado para {data} às {horario}. Te esperamos! 🎉",
    "Atendido":         "Olá {nome}, foi um prazer atendê-lo(a) hoje! Espero que tenha gostado do {servico}. Até a próxima! 😄",
    "Cancelado":        "Olá {nome}, precisamos cancelar o agendamento de {servico} previsto para {data} às {horario}. Lamentamos o inconveniente. Entre em contato para remarcar!",
    "Perdido":          "Olá {nome}, tentei contato mas não consegui confirmar seu agendamento de {servico} em {data}. Caso queira reagendar, estou à disposição!",
    "Não compareceu":   "Olá {nome}, sentimos sua falta no agendamento de {servico} em {data} às {horario}. Caso queira remarcar, é só nos chamar!",
  };
  const [messageTemplates, setMessageTemplates] = useState<Record<string, string>>({ ...DEFAULT_TEMPLATES });
  const [templatesSaving, setTemplatesSaving] = useState(false);
  const [templatesSaved, setTemplatesSaved] = useState(false);

  // ── Profile tab ───────────────────────────────────────────────────────────
  const [activeProfileTab, setActiveProfileTab] = useState<"perfil" | "mensagens">("perfil");

  // ── UI state ──────────────────────────────────────────────────────────────
  const [formLoading, setFormLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showCoordsPanel, setShowCoordsPanel] = useState(false);
  const [privacyWarning, setPrivacyWarning] = useState<string | null>(null);
  const [savingToggle, setSavingToggle] = useState<string | null>(null);
  const [toggleSaved, setToggleSaved] = useState<string | null>(null);
  const [realServices, setRealServices] = useState<any[]>([]);

  // Carrega serviços reais para o preview
  useEffect(() => {
    if (!user) return;
    getDocs(query(
      collection(db, "professionals", user.uid, "services"),
      where("ativo", "==", true),
      orderBy("nome", "asc")
    )).then(snap => {
      setRealServices(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }).catch(() => {});
  }, [user]);

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
    setInstagram(profile.instagram || "");

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
    setShowMiniMap(profile.showMiniMap ?? false);
    setShowPublicInstagram(profile.showPublicInstagram ?? false);

    const tc = profile.themeConfig ?? getDefaultThemeConfig();
    setShowProfileImage(tc.showProfileImage ?? true);
    setProfileImageSize(tc.profileImageSize ?? "md");
    setShowServiceImages(tc.showServiceImages ?? true);

    if (profile.messageTemplates) {
      setMessageTemplates({ ...DEFAULT_TEMPLATES, ...profile.messageTemplates });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-selected after crop cancel
    e.target.value = "";
    const objectUrl = URL.createObjectURL(file);
    setCropSrc(objectUrl);
  };

  const handleCropConfirm = async (blob: Blob) => {
    if (!user) return;
    setCropSrc(null);
    setUploadLoading(true);
    setError("");
    setSuccess("");
    try {
      const storageRef = ref(storage, `logos/${user.uid}/logo`);
      await uploadBytes(storageRef, blob);
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
      case "showMiniMap": setShowMiniMap(value); break;
      case "showPublicInstagram": setShowPublicInstagram(value); break;
    }
    setSavingToggle(field);
    setToggleSaved(null);
    try {
      await updateDoc(doc(db, "professionals", user.uid), { [field]: value });
      await refreshProfile();
      setToggleSaved(field);
      setTimeout(() => setToggleSaved(null), 1500);
    } catch (err: any) {
      console.error("Toggle save error:", err);
    } finally {
      setSavingToggle(null);
    }
  }, [user, refreshProfile]);

  const handleThemeImageField = useCallback(async (patch: Partial<Pick<ThemeConfig, "showProfileImage" | "profileImageSize" | "showServiceImages">>) => {
    if (!user || !profile) return;
    const current = profile.themeConfig ?? getDefaultThemeConfig();
    const updated = { ...current, ...patch };
    if (patch.showProfileImage !== undefined) setShowProfileImage(patch.showProfileImage);
    if (patch.profileImageSize !== undefined) setProfileImageSize(patch.profileImageSize);
    if (patch.showServiceImages !== undefined) setShowServiceImages(patch.showServiceImages);
    try {
      await updateDoc(doc(db, "professionals", user.uid), { themeConfig: updated });
      await refreshProfile();
    } catch (err) {
      console.error("Theme image save error:", err);
    }
  }, [user, profile, refreshProfile]);

  const handleAddressField = (key: keyof PublicAddress, value: string | number | null) => {
    setPublicAddress((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveSlotSuggestion = async (value: { enabled: boolean; requestMessage: string; quickReply: string }) => {
    if (!user) return;
    await updateDoc(doc(db, "professionals", user.uid), { slotSuggestion: value });
    await refreshProfile();
  };

  const handleSaveTemplates = async () => {
    if (!user) return;
    setTemplatesSaving(true);
    try {
      await updateDoc(doc(db, "professionals", user.uid), { messageTemplates });
      setTemplatesSaved(true);
      setTimeout(() => setTemplatesSaved(false), 3000);
    } catch {
      // silently ignore
    } finally {
      setTemplatesSaving(false);
    }
  };

  // Substitui variáveis no template com dados reais
  const applyTemplate = (status: string, data: { nome: string; servico: string; data: string; horario: string; profissional: string; endereco?: string }) => {
    const tpl = messageTemplates[status] || DEFAULT_TEMPLATES[status] || "";
    return tpl
      .replace(/{nome}/g, data.nome)
      .replace(/{servico}/g, data.servico)
      .replace(/{data}/g, data.data)
      .replace(/{horario}/g, data.horario)
      .replace(/{profissional}/g, data.profissional)
      .replace(data.endereco ? /{endereco}/g : /,?\s*{endereco}/g, data.endereco ?? "")
      .trim();
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

    const cleanInsta = cleanInstagramUsername(instagram);

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
        instagram: cleanInsta || null,
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
        showMiniMap,
        showPublicInstagram,
        updatedAt: new Date(),
      });

      await refreshProfile();
      setInstagram(cleanInsta);
      setPrivacyWarning(null);
      showSuccessModal({
        title: "Sucesso",
        description: "Perfil atualizado com sucesso!",
      });
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
    <>
    {cropSrc && (
      <ImageCropModal
        src={cropSrc}
        aspect={1}
        title="Ajustar logo / foto"
        onConfirm={(blob) => handleCropConfirm(blob)}
        onClose={() => { URL.revokeObjectURL(cropSrc); setCropSrc(null); }}
      />
    )}
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

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl w-fit gap-1">
        <button
          type="button"
          onClick={() => setActiveProfileTab("perfil")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeProfileTab === "perfil" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}
        >
          <User className="h-4 w-4" />
          Perfil
        </button>
        <button
          type="button"
          onClick={() => setActiveProfileTab("mensagens")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeProfileTab === "mensagens" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}
        >
          <MessageSquare className="h-4 w-4" />
          Mensagens
        </button>
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

      {activeProfileTab === "perfil" && <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* ── Editor Form ────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSaveProfile} className="space-y-6">

            {/* ── Section: Logo ─────────────────────────────────────────── */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-5 md:p-6 backdrop-blur-sm">
              <div className="flex flex-col sm:flex-row items-center gap-5 pb-2">
                <div className="relative h-20 w-20 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                  {fotoLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={fotoLogoUrl} alt="Logo" className="h-full w-full object-cover object-center" />
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
                    <input ref={logoInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
              </div>
            </div>

            {/* ── Section: Imagens / Fotos ──────────────────────────────── */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-5 md:p-6 backdrop-blur-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-300">Imagens / Fotos</h2>

              {/* showProfileImage */}
              <ToggleRow
                label="Exibir foto/logo na página pública"
                hint="Mostra ou oculta sua foto circular no topo da página de agendamento."
                checked={showProfileImage}
                onChange={(v) => handleThemeImageField({ showProfileImage: v })}
                saving={false}
                saved={false}
              />

              {/* profileImageSize */}
              {showProfileImage && (
                <div>
                  <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Tamanho da Foto / Logo</span>
                  <div className="grid grid-cols-4 gap-2">
                    {(["sm", "md", "lg", "xl"] as const).map((size) => {
                      const labels: Record<string, string> = { sm: "Pequeno", md: "Médio", lg: "Grande", xl: "Extra" };
                      const active = profileImageSize === size;
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => handleThemeImageField({ profileImageSize: size })}
                          className={`py-2 rounded-xl text-xs font-bold transition-all border ${active ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600"}`}
                        >
                          {labels[size]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* showServiceImages */}
              <ToggleRow
                label="Exibir imagens dos serviços"
                hint="Mostra a foto de capa do procedimento nos cards de agendamento público."
                checked={showServiceImages}
                onChange={(v) => handleThemeImageField({ showServiceImages: v })}
                saving={false}
                saved={false}
              />
            </div>

            {/* ── Section: Identity ─────────────────────────────────────── */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-5 md:p-6 backdrop-blur-sm space-y-5">
              <h2 className="text-sm font-bold text-slate-300">Identidade</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Nome do Negócio</label>
                    <span className={`text-[10px] font-mono ${nomeNegocio.length > 70 ? "text-red-400" : "text-slate-600"}`}>{nomeNegocio.length}/80</span>
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500"><Briefcase className="h-4 w-4" /></span>
                    <input type="text" required maxLength={80} value={nomeNegocio} onChange={(e) => setNomeNegocio(e.target.value)} placeholder="Ex: Barber Shop" className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-100 text-sm transition-all" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Seu Nome Completo</label>
                    <span className={`text-[10px] font-mono ${nome.length > 70 ? "text-red-400" : "text-slate-600"}`}>{nome.length}/80</span>
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500"><User className="h-4 w-4" /></span>
                    <input type="text" required maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: João da Silva" className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-100 text-sm transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Link Público (Slug)</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500"><LinkIcon className="h-4 w-4" /></span>
                    <input type="text" required maxLength={50} value={slugPublico} onChange={(e) => setSlugPublico(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="link-da-pagina" className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-100 text-sm transition-all" />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 pl-1">Seu link: <span className="font-mono text-indigo-400">/p/{slugPublico || "link"}</span></p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">WhatsApp de Agendamento *</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500"><Phone className="h-4 w-4" /></span>
                    <input type="tel" required maxLength={20} value={telefoneWhatsapp} onChange={(e) => setTelefoneWhatsapp(maskPhone(e.target.value))} placeholder="(11) 99999-9999" className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-100 text-sm transition-all" />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 pl-1">Usado para receber agendamentos. Pode ser exibido publicamente abaixo.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Instagram Profissional</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500"><Instagram className="h-4 w-4" /></span>
                    <input type="text" maxLength={60} value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="Ex: @seu.perfil" className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-100 text-sm transition-all" />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 pl-1">Opcional. Exibe um botão com link para o seu Instagram na página pública.</p>
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
                <ToggleRow
                  label="Exibir endereço na página pública"
                  checked={showPublicAddress}
                  onChange={(v) => handleToggle("showPublicAddress", v)}
                  hint="O endereço ficará visível para qualquer visitante."
                  saving={savingToggle === "showPublicAddress"}
                  saved={toggleSaved === "showPublicAddress"}
                />
                <ToggleRow
                  label="Exibir mini mapa (Google Maps)"
                  checked={showMiniMap}
                  onChange={(v) => handleToggle("showMiniMap", v)}
                  disabled={!showPublicAddress}
                  hint={!showPublicAddress ? "Ative 'Exibir endereço' primeiro" : "Incorpora um mapa abaixo do endereço."}
                  saving={savingToggle === "showMiniMap"}
                  saved={toggleSaved === "showMiniMap"}
                />
                <ToggleRow
                  label="Exibir Instagram na página pública"
                  checked={showPublicInstagram}
                  onChange={(v) => handleToggle("showPublicInstagram", v)}
                  disabled={!instagram}
                  hint={!instagram ? "Preencha seu Instagram acima para ativar" : undefined}
                  saving={savingToggle === "showPublicInstagram"}
                  saved={toggleSaved === "showPublicInstagram"}
                />
              </div>

              {privacyWarning && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm flex gap-3 items-start">
                  <Info className="h-5 w-5 shrink-0 mt-0.5" /><p className="font-medium">{privacyWarning}</p>
                </div>
              )}
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
            themeConfig={{ ...(profile?.themeConfig ?? getDefaultThemeConfig()), showProfileImage, profileImageSize, showServiceImages }}
            businessName={nomeNegocio}
            professionalName={nome}
            fotoLogoUrl={fotoLogoUrl}
            descricaoCurta={descricaoCurta}
            services={realServices}
            showResponsibleName={showResponsibleName}
            showWelcomeMessage={showWelcomeMessage}
            showPublicPhone={showPublicPhone}
            showPublicWhatsApp={showPublicWhatsApp}
            showPublicAddress={showPublicAddress}
            showMiniMap={showMiniMap}
            showPublicInstagram={showPublicInstagram}
            publicPhone={formatPhoneForWhatsApp(publicPhone)}
            telefoneWhatsapp={formatPhoneForWhatsApp(telefoneWhatsapp)}
            instagram={cleanInstagramUsername(instagram)}
            addressText={[
              publicAddress.street && `${publicAddress.street}${publicAddress.number ? ", " + publicAddress.number : ""}`,
              publicAddress.city,
              publicAddress.state,
            ].filter(Boolean).join(" - ")}
          />
        </div>

      </div>}

      {/* ── Aba Mensagens ──────────────────────────────────────────────────── */}
      {activeProfileTab === "mensagens" && (
        <MessageTemplatesTab
          templates={messageTemplates}
          onChange={setMessageTemplates}
          onSave={handleSaveTemplates}
          saving={templatesSaving}
          saved={templatesSaved}
          hasAddress={
            (serviceLocationType === "physical" || serviceLocationType === "both") &&
            !!(publicAddress.street?.trim())
          }
          addressText={[
            publicAddress.street && `${publicAddress.street}${publicAddress.number ? ", " + publicAddress.number : ""}`,
            publicAddress.city,
            publicAddress.state,
          ].filter(Boolean).join(" - ")}
          profissionalName={nomeNegocio || nome}
        />
      )}
      {activeProfileTab === "mensagens" && (
        <SlotSuggestionSettings
          initial={profile?.slotSuggestion}
          onSave={handleSaveSlotSuggestion}
        />
      )}

    </div>
    </>
  );
}

// ── Message Templates Tab ─────────────────────────────────────────────────────

const TEMPLATE_VARS = ["{nome}", "{servico}", "{data}", "{horario}", "{profissional}", "{endereco}"];

const TEMPLATE_CATEGORIES = [
  {
    label: "Confirmação",
    statuses: ["Novo", "Agendado", "Confirmado"],
  },
  {
    label: "Acompanhamento",
    statuses: ["Em contato", "Lembrete"],
  },
  {
    label: "Encerramento",
    statuses: ["Atendido", "Cancelado", "Perdido", "Não compareceu"],
  },
];

const DEFAULT_REQUEST_MESSAGE = "Olá! Gostaria de agendar {servico}, mas nenhum dos horários sugeridos serve para mim. Poderia me enviar outras opções de horário?";
const DEFAULT_QUICK_REPLY = "Olá! Claro, tenho estas outras opções de horário:\n• \n• \n• \nQual delas fica melhor para você? 😊";

function SlotSuggestionSettings({ initial, onSave }: {
  initial?: { enabled: boolean; requestMessage?: string; quickReply?: string };
  onSave: (v: { enabled: boolean; requestMessage: string; quickReply: string }) => Promise<void>;
}) {
  const [enabled, setEnabled] = useState(initial?.enabled !== false);
  const [requestMessage, setRequestMessage] = useState(initial?.requestMessage || DEFAULT_REQUEST_MESSAGE);
  const [quickReply, setQuickReply] = useState(initial?.quickReply || DEFAULT_QUICK_REPLY);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  const flash = (msg: string) => { setFeedback(msg); setTimeout(() => setFeedback(""), 3000); };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ enabled, requestMessage: requestMessage.trim(), quickReply: quickReply.trim() });
      flash("Salvo!");
    } catch {
      flash("Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(quickReply);
      flash("Resposta rápida copiada!");
    } catch {
      flash("Não foi possível copiar.");
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-5">
      <div>
        <h3 className="text-base font-bold text-slate-100">Sugestão de horários</h3>
        <p className="text-xs text-slate-400 mt-1">
          Quando ativado, o cliente vê apenas os 3 próximos horários livres e pode pedir outras opções pelo WhatsApp.
          Desativado, ele vê o calendário completo.
        </p>
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4" />
        <span className="text-sm text-slate-200">Mostrar só os 3 próximos horários livres</span>
      </label>

      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Mensagem do cliente pedindo outro horário</label>
        <textarea
          value={requestMessage}
          onChange={(e) => setRequestMessage(e.target.value)}
          rows={3}
          maxLength={500}
          className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
        />
        <p className="text-[11px] text-slate-500">Use {"{servico}"} para inserir o serviço escolhido pelo cliente.</p>
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Resposta rápida do profissional</label>
        <textarea
          value={quickReply}
          onChange={(e) => setQuickReply(e.target.value)}
          rows={5}
          maxLength={500}
          className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
        />
        <p className="text-[11px] text-slate-500">Copie e cole no WhatsApp ao responder um pedido de outro horário, preenchendo as opções.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={handleSave} disabled={saving} className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {saving ? "Salvando..." : "Salvar"}
        </button>
        <button type="button" onClick={handleCopy} className="rounded-xl border border-slate-700 hover:bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200">
          Copiar resposta rápida
        </button>
        {feedback && <span className="text-xs text-slate-400">{feedback}</span>}
      </div>
    </div>
  );
}

interface MessageTemplatesTabProps {
  templates: Record<string, string>;
  onChange: (t: Record<string, string>) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
  hasAddress: boolean;
  addressText: string;
  profissionalName: string;
}

function MessageTemplatesTab({ templates, onChange, onSave, saving, saved, hasAddress, addressText, profissionalName }: MessageTemplatesTabProps) {
  const PREVIEW_DATA = {
    nome: "Maria Silva",
    servico: "Corte + Escova",
    data: "15/07/2026",
    horario: "14:30",
    profissional: profissionalName || "Seu Negócio",
    endereco: hasAddress ? addressText : undefined,
  };

  const getPreview = (tpl: string) => {
    return tpl
      .replace(/{nome}/g, PREVIEW_DATA.nome)
      .replace(/{servico}/g, PREVIEW_DATA.servico)
      .replace(/{data}/g, PREVIEW_DATA.data)
      .replace(/{horario}/g, PREVIEW_DATA.horario)
      .replace(/{profissional}/g, PREVIEW_DATA.profissional)
      .replace(PREVIEW_DATA.endereco ? /{endereco}/g : /,?\s*{endereco}/g, PREVIEW_DATA.endereco ?? "")
      .trim();
  };

  const insertVar = (status: string, variable: string, ref: React.RefObject<HTMLTextAreaElement | null>) => {
    const el = ref.current;
    if (!el) {
      onChange({ ...templates, [status]: (templates[status] || "") + variable });
      return;
    }
    const start = el.selectionStart ?? (templates[status] || "").length;
    const end = el.selectionEnd ?? start;
    const current = templates[status] || "";
    const next = current.slice(0, start) + variable + current.slice(end);
    onChange({ ...templates, [status]: next });
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">Configure o texto que aparecerá pré-preenchido no WhatsApp para cada status do agendamento.</p>
          <p className="text-xs text-slate-500 mt-1">Clique nas variáveis para inserir no cursor. O preview mostra o resultado com dados de exemplo.</p>
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="shrink-0 flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold text-sm rounded-xl transition-all shadow shadow-indigo-500/20"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
          {saved ? "Salvo!" : "Salvar Mensagens"}
        </button>
      </div>

      {!hasAddress && (
        <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-xs">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>A variável <strong>{"{endereco}"}</strong> será removida automaticamente das mensagens pois você não tem atendimento presencial cadastrado. Para incluí-la, configure o endereço em <strong>Perfil → Local de Atendimento</strong>.</span>
        </div>
      )}

      {TEMPLATE_CATEGORIES.map((cat) => (
        <div key={cat.label} className="space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">{cat.label}</h3>
          {cat.statuses.map((status) => (
            <TemplateEditor
              key={status}
              status={status}
              value={templates[status] || ""}
              onChange={(v) => onChange({ ...templates, [status]: v })}
              preview={getPreview(templates[status] || "")}
              onInsertVar={(v, ref) => insertVar(status, v, ref)}
              showAddressVar={hasAddress}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

interface TemplateEditorProps {
  status: string;
  value: string;
  onChange: (v: string) => void;
  preview: string;
  onInsertVar: (v: string, ref: React.RefObject<HTMLTextAreaElement | null>) => void;
  showAddressVar: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  "Novo":           "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  "Em contato":     "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "Lembrete":       "bg-violet-500/10 text-violet-400 border-violet-500/20",
  "Agendado":       "bg-sky-500/10 text-sky-400 border-sky-500/20",
  "Confirmado":     "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "Atendido":       "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "Cancelado":      "bg-red-500/10 text-red-400 border-red-500/20",
  "Perdido":        "bg-slate-500/10 text-slate-400 border-slate-500/20",
  "Não compareceu": "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

function TemplateEditor({ status, value, onChange, preview, onInsertVar, showAddressVar }: TemplateEditorProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const vars = showAddressVar ? TEMPLATE_VARS : TEMPLATE_VARS.filter(v => v !== "{endereco}");

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${STATUS_COLORS[status] || "bg-slate-800 text-slate-400 border-slate-700"}`}>
          {status}
        </span>
      </div>

      {/* Chips de variáveis */}
      <div className="flex flex-wrap gap-1.5">
        {vars.map(v => (
          <button
            key={v}
            type="button"
            onClick={() => onInsertVar(v, textareaRef)}
            className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white border border-slate-700 hover:border-indigo-500 rounded-md transition-all"
          >
            {v}
          </button>
        ))}
      </div>

      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={3}
        maxLength={500}
        className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:border-indigo-500 transition-colors"
        placeholder={`Mensagem para status "${status}"...`}
      />

      {/* Preview */}
      {preview && (
        <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-xl p-3">
          <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-1.5">Preview (dados de exemplo)</p>
          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{preview}</p>
        </div>
      )}

      <p className="text-[10px] text-slate-600 text-right">{value.length}/500</p>
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
