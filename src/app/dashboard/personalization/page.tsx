"use client";

import React, { useEffect, useState } from "react";
import { doc, updateDoc, collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "../../providers";
import { 
  ThemeConfig, 
  getDefaultThemeConfig, 
  validateThemeConfig, 
  applyThemePreset,
  normalizeThemeConfig
} from "../../../lib/themeUtils";

import ThemePresetCatalog from "./components/ThemePresetCatalog";
import ThemeColorEditor from "./components/ThemeColorEditor";
import FontSelector from "./components/FontSelector";
import BackgroundEditor from "./components/BackgroundEditor";
import ComponentStyleEditor from "./components/ComponentStyleEditor";
import ThemePreview from "./components/ThemePreview";
import { getThemePresetById } from "@/lib/themePresetCatalog";
import type { Professional, Service, AvailableSlot } from "@/app/p/[slug]/components/PublicBookingExperience";
import { useAppModal } from "@/components/ModalProvider";

import {
  Palette,
  Sliders,
  Type,
  Image as ImageIcon,
  Sparkles,
  Save,
  RotateCcw,
  Undo,
  Loader2,
  AlertCircle,
  Check,
  Eye,
  RefreshCw
} from "lucide-react";

export default function PersonalizationPage() {
  const { user, profile, refreshProfile } = useAuth();
  const { showSuccessModal, showErrorModal, showConfirmationModal } = useAppModal();
  
  const [draftConfig, setDraftConfig] = useState<ThemeConfig | null>(null);
  const [sourcePresetId, setSourcePresetId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"presets" | "colors" | "fonts" | "background" | "components">("presets");
  const [mobilePane, setMobilePane] = useState<"edit" | "preview">("edit");

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [realServices, setRealServices] = useState<any[]>([]);

  // Carrega serviços reais do profissional para o preview
  useEffect(() => {
    if (!user) return;
    getDocs(query(
      collection(db, "professionals", user.uid, "services"),
      where("ativo", "==", true),
      orderBy("ordem", "asc")
    )).then(snap => {
      setRealServices(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }).catch(() => {});
  }, [user]);

  // Initialize draft config from profile
  useEffect(() => {
    if (profile) {
      setDraftConfig(normalizeThemeConfig(profile.themeConfig));
    }
  }, [profile]);

  if (!user || !profile || !draftConfig) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-16">
        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
        <p className="mt-4 text-slate-400 font-medium">Carregando configurações visuais...</p>
      </div>
    );
  }

  // Update specific fields
  const onChangeField = (key: keyof ThemeConfig, val: any) => {
    setError("");
    setSuccess("");
    setDraftConfig(prev => {
      if (!prev) return null;
      const updated = { ...prev, [key]: val };

      const presetModifyingKeys: Array<keyof ThemeConfig> = [
        "primaryColor", "secondaryColor", "accentColor",
        "backgroundColor", "surfaceColor", "textColor", "mutedTextColor",
        "headingFont", "bodyFont", "buttonStyle", "cardStyle", "cardRadius",
        "backgroundType", "backgroundPreset", "backgroundGradient"
      ];
      if (presetModifyingKeys.includes(key) && prev.preset !== "custom") {
        updated.preset = "custom";
        // preserve reference to original preset so user can restore it
        if (prev.preset && prev.preset !== "custom") {
          updated.sourcePresetId = prev.preset;
          setSourcePresetId(prev.preset);
        }
      }

      return updated;
    });
  };

  // Apply a full preset from the catalog
  const handleSelectPreset = (themeConfig: ThemeConfig, presetId: string) => {
    setError("");
    setSuccess("");
    setSourcePresetId(presetId);
    setDraftConfig({ ...themeConfig, preset: presetId, sourcePresetId: presetId });
  };

  // Restore the original catalog preset after manual edits
  const handleRestoreSourcePreset = () => {
    if (!sourcePresetId && !draftConfig?.sourcePresetId) return;
    const id = sourcePresetId ?? draftConfig?.sourcePresetId!;
    const catalogPreset = getThemePresetById(id);
    if (!catalogPreset) return;

    showConfirmationModal({
      title: `Restaurar o tema "${catalogPreset.name}"?`,
      description: "As edições manuais feitas no tema serão perdidas.",
      confirmLabel: "Restaurar",
      cancelLabel: "Cancelar",
      variant: "warning",
      onConfirm: () => {
        setDraftConfig({ ...catalogPreset.theme, preset: id, sourcePresetId: id });
        setError("");
        showSuccessModal({
          title: "Tema restaurado",
          description: "O tema original foi aplicado no rascunho. Salve para confirmar.",
        });
      }
    });
  };

  const handleSave = async () => {
    if (!user || !profile) return;
    setError("");
    setSuccess("");
    setIsSaving(true);

    const validation = validateThemeConfig(draftConfig);
    if (!validation.valid) {
      setError(validation.error || "Dados de personalização inválidos.");
      setIsSaving(false);
      return;
    }

    try {
      const docRef = doc(db, "professionals", user.uid);
      await updateDoc(docRef, {
        themeConfig: {
          ...draftConfig,
          updatedAt: new Date()
        }
      });
      await refreshProfile();
      
      const hasSlug = !!profile.slugPublico;
      showSuccessModal({
        title: "Tema salvo",
        description: "A personalização da sua página foi atualizada e já está disponível na página pública.",
        ...(hasSlug ? {
          confirmLabel: "Ver página pública",
          cancelLabel: "Entendi",
          onConfirm: () => {
            window.open(`/p/${profile.slugPublico}`, "_blank", "noopener,noreferrer");
          }
        } : {
          confirmLabel: "Entendi"
        })
      });
    } catch (err: any) {
      console.error("Save theme error:", err);
      showErrorModal({
        title: "Não foi possível salvar o tema",
        description: "A configuração pública anterior foi mantida. Revise as informações e tente novamente.",
        confirmLabel: "Fechar",
        cancelLabel: "Tentar novamente",
        onCancel: () => {
          handleSave();
        }
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    setError("");
    setSuccess("");

    const original = profile.themeConfig
      ? { ...getDefaultThemeConfig(), ...profile.themeConfig }
      : getDefaultThemeConfig();

    const hasChanges = JSON.stringify(draftConfig) !== JSON.stringify(original);

    if (!hasChanges) return;

    showConfirmationModal({
      title: "Descartar alterações?",
      description: "As mudanças feitas na personalização ainda não foram salvas.",
      confirmLabel: "Descartar",
      cancelLabel: "Continuar editando",
      variant: "danger",
      onConfirm: () => {
        if (profile.themeConfig) {
          setDraftConfig({ ...getDefaultThemeConfig(), ...profile.themeConfig });
        } else {
          setDraftConfig(getDefaultThemeConfig());
        }
      }
    });
  };

  const handleRestoreDefault = () => {
    const defaultConfig = getDefaultThemeConfig();
    const isDefaultAlready = JSON.stringify(draftConfig) === JSON.stringify(defaultConfig);

    if (isDefaultAlready) return;

    showConfirmationModal({
      title: "Restaurar tema padrão?",
      description: "A personalização no editor será substituída pelo tema padrão. Para publicar, ainda será necessário clicar em “Salvar Tema”.",
      confirmLabel: "Restaurar no editor",
      cancelLabel: "Cancelar",
      variant: "warning",
      onConfirm: () => {
        setDraftConfig(defaultConfig);
        setError("");
      }
    });
  };

  return (
    <div className="space-y-6">
      
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Personalização da Página</h1>
          <p className="text-sm text-slate-400">Personalize a identidade visual e o design da sua página pública de agendamentos.</p>
        </div>

        {/* Global Save/Discard Actions */}
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          {/* Restore original preset — only visible when user has customized a catalog preset */}
          {draftConfig?.preset === "custom" && (draftConfig?.sourcePresetId || sourcePresetId) && (
            <button
              type="button"
              onClick={handleRestoreSourcePreset}
              disabled={isSaving}
              className="px-3.5 py-2 bg-slate-950 hover:bg-slate-800 text-amber-400 hover:text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
              title="Restaurar configuração original do preset"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Restaurar Preset</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleRestoreDefault}
            disabled={isSaving}
            className="px-3.5 py-2 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-850 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
            title="Restaurar padrão Retoria"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Restaurar Padrão</span>
          </button>
          
          <button
            type="button"
            onClick={handleDiscard}
            disabled={isSaving}
            className="px-3.5 py-2 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-850 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <Undo className="h-3.5 w-3.5" />
            <span>Descartar</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700/50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98] flex items-center justify-center gap-1.5"
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                <span>Salvar Tema</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex gap-3 items-center">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="font-semibold text-xs md:text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex gap-3 items-center">
          <Check className="h-5 w-5 shrink-0" />
          <p className="font-semibold text-xs md:text-sm">{success}</p>
        </div>
      )}

      {/* Mobile Switch Pane Controls */}
      <div className="flex md:hidden bg-slate-900 border border-slate-800 p-1 rounded-xl">
        <button
          type="button"
          onClick={() => setMobilePane("edit")}
          className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all ${mobilePane === "edit" ? "bg-slate-950 text-white shadow-sm" : "text-slate-400"}`}
        >
          Editar Configurações
        </button>
        <button
          type="button"
          onClick={() => setMobilePane("preview")}
          className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${mobilePane === "preview" ? "bg-slate-950 text-white shadow-sm" : "text-slate-400"}`}
        >
          <Eye className="h-3.5 w-3.5" />
          <span>Ver Prévia</span>
        </button>
      </div>

      {/* Main Grid Editor + Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Editor Form Columns */}
        <div className={`lg:col-span-2 space-y-6 ${mobilePane === "edit" ? "block" : "hidden md:block"}`}>
          
          {/* Tab selectors */}
          <div className="flex overflow-x-auto pb-1 gap-2 pr-1 scrollbar-none border-b border-slate-850">
            {[
              { id: "presets", label: "Temas Prontos", icon: Sparkles },
              { id: "colors", label: "Cores", icon: Palette },
              { id: "fonts", label: "Fontes", icon: Type },
              { id: "background", label: "Plano de Fundo", icon: ImageIcon },
              { id: "components", label: "Elementos UI", icon: Sliders }
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`
                    py-2.5 px-4 rounded-t-xl border-b-2 text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer
                    ${active 
                      ? "border-indigo-500 text-indigo-400 bg-slate-950/20" 
                      : "border-transparent text-slate-500 hover:text-slate-300"
                    }
                  `}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Render Tab Editor content */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-5 md:p-6 backdrop-blur-sm min-h-[400px]">
            {activeTab === "presets" && (
              <ThemePresetCatalog
                currentPresetId={draftConfig.preset}
                professional={{
                  id: user.uid,
                  nome: profile.nome,
                  nomeNegocio: profile.nomeNegocio,
                  slugPublico: profile.slugPublico ?? "",
                  telefoneWhatsapp: profile.telefoneWhatsapp ?? "",
                  descricaoCurta: profile.descricaoCurta,
                  fotoLogoUrl: profile.fotoLogoUrl,
                  themeConfig: draftConfig,
                }}
                services={[]}
                slots={[]}
                onApply={handleSelectPreset}
              />
            )}
            {activeTab === "colors" && (
              <ThemeColorEditor
                currentConfig={draftConfig}
                onChangeColor={(key, val) => onChangeField(key, val)}
              />
            )}
            {activeTab === "fonts" && (
              <FontSelector
                currentConfig={draftConfig}
                onChangeFont={(key, val) => onChangeField(key, val)}
              />
            )}
            {activeTab === "background" && (
              <BackgroundEditor
                currentConfig={draftConfig}
                onChangeField={(key, val) => onChangeField(key, val)}
              />
            )}
            {activeTab === "components" && (
              <ComponentStyleEditor
                currentConfig={draftConfig}
                onChangeField={(key, val) => onChangeField(key, val)}
              />
            )}
          </div>
        </div>

        {/* Live Preview Column */}
        <div className={`lg:col-span-1 flex justify-center ${mobilePane === "preview" ? "block" : "hidden md:block"}`}>
          <ThemePreview
            themeConfig={draftConfig}
            businessName={profile.nomeNegocio}
            professionalName={profile.nome}
            fotoLogoUrl={profile.fotoLogoUrl || ""}
            descricaoCurta={profile.descricaoCurta || ""}
            services={realServices}
            showResponsibleName={profile.showResponsibleName ?? true}
            showWelcomeMessage={profile.showWelcomeMessage ?? true}
            showPublicPhone={profile.showPublicPhone ?? false}
            showPublicWhatsApp={profile.showPublicWhatsApp ?? false}
            showPublicAddress={profile.showPublicAddress ?? false}
            publicPhone={profile.publicPhone || ""}
            telefoneWhatsapp={profile.telefoneWhatsapp || ""}
            addressText={[
              profile.publicAddress?.street && `${profile.publicAddress.street}${profile.publicAddress.number ? ", " + profile.publicAddress.number : ""}`,
              profile.publicAddress?.city,
              profile.publicAddress?.state,
            ].filter(Boolean).join(" - ")}
          />
        </div>

      </div>
    </div>
  );
}
