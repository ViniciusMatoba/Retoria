import React, { useState } from "react";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { useAuth } from "../../../providers";
import { ThemeConfig, gradientPresets, bgPatterns, validateImageFile } from "../../../../lib/themeUtils";
import { Upload, Loader2, Trash2, Sliders } from "lucide-react";

interface BackgroundEditorProps {
  currentConfig: ThemeConfig;
  onChangeField: (key: keyof ThemeConfig, val: any) => void;
}

export default function BackgroundEditor({
  currentConfig,
  onChangeField
}: BackgroundEditorProps) {
  const { user } = useAuth();
  const [uploadLoading, setUploadLoading] = useState(false);
  const [error, setError] = useState("");

  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const res = validateImageFile(file, 3); // 3MB limit for background
    if (!res.valid) {
      alert(res.error);
      return;
    }

    setUploadLoading(true);
    setError("");

    try {
      const storagePath = `backgrounds/${user.uid}/main`;
      const fileRef = ref(storage, storagePath);
      await uploadBytes(fileRef, file);
      const downloadUrl = await getDownloadURL(fileRef);
      
      onChangeField("backgroundImageUrl", downloadUrl);
      onChangeField("backgroundStoragePath", storagePath);
      onChangeField("backgroundUpdatedAt", Date.now());
      onChangeField("backgroundType", "image"); // Switch to image automatically
    } catch (err: any) {
      console.error("Background upload error:", err);
      setError("Erro ao enviar imagem de fundo: " + err.message);
    } finally {
      setUploadLoading(false);
    }
  };

  const handleRemoveBackground = async () => {
    if (!currentConfig.backgroundStoragePath) return;
    if (!window.confirm("Deseja remover a imagem de fundo? A imagem será apagada do Storage.")) return;

    setUploadLoading(true);
    setError("");

    try {
      const fileRef = ref(storage, currentConfig.backgroundStoragePath);
      await deleteObject(fileRef);
    } catch (err: any) {
      // Ignore if not found
      if (err.code !== "storage/object-not-found") {
        console.error("Background delete error:", err);
      }
    } finally {
      onChangeField("backgroundImageUrl", null);
      onChangeField("backgroundStoragePath", null);
      onChangeField("backgroundUpdatedAt", Date.now());
      onChangeField("backgroundType", "solid");
      setUploadLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-200">Plano de Fundo (Background)</h3>
        <p className="text-xs text-slate-500">Configure o estilo de fundo que os clientes verão ao acessar sua página pública.</p>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl">
          {error}
        </div>
      )}

      {/* Select Background Type */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Tipo de Fundo</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {["solid", "gradient", "preset", "image"].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onChangeField("backgroundType", type)}
              className={`
                py-2.5 px-3 rounded-xl border text-xs font-bold capitalize transition-all cursor-pointer
                ${currentConfig.backgroundType === type 
                  ? "bg-indigo-600 border-indigo-500 text-white" 
                  : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                }
              `}
            >
              {type === "solid" && "Cor Sólida"}
              {type === "gradient" && "Gradiente"}
              {type === "preset" && "Padrões CSS"}
              {type === "image" && "Imagem"}
            </button>
          ))}
        </div>
      </div>

      {/* Conditional Inputs based on Type */}

      {/* 1. SOLID */}
      {currentConfig.backgroundType === "solid" && (
        <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl space-y-3">
          <p className="text-xs text-slate-400">O fundo exibirá a cor geral configurada na aba <strong>Cores</strong>.</p>
          <div className="flex items-center gap-3">
            <span className="h-6 w-6 rounded-lg border border-slate-800" style={{ backgroundColor: currentConfig.backgroundColor }} />
            <span className="text-xs text-slate-500 font-mono">Fundo ativo: {currentConfig.backgroundColor}</span>
          </div>
        </div>
      )}

      {/* 2. GRADIENT */}
      {currentConfig.backgroundType === "gradient" && (
        <div className="space-y-2.5">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Selecione o Gradiente</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries(gradientPresets).map(([key, value]) => (
              <button
                key={key}
                type="button"
                onClick={() => onChangeField("backgroundGradient", key)}
                className={`
                  p-3 rounded-2xl border text-left space-y-2 transition-all cursor-pointer overflow-hidden
                  ${currentConfig.backgroundGradient === key 
                    ? "bg-slate-900 border-indigo-500 shadow-md" 
                    : "bg-slate-950/40 border-slate-800 hover:border-slate-750"
                  }
                `}
              >
                <span className="font-bold text-xs capitalize text-slate-200">{key}</span>
                <div className="h-6 w-full rounded-lg border border-black/10 shrink-0" style={{ background: value }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. PRESET */}
      {currentConfig.backgroundType === "preset" && (
        <div className="space-y-2.5">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Selecione o Padrão CSS</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(bgPatterns).map(([key, pat]) => (
              <button
                key={key}
                type="button"
                onClick={() => onChangeField("backgroundPreset", key)}
                className={`
                  p-3 rounded-2xl border text-left flex items-center justify-between gap-4 transition-all cursor-pointer overflow-hidden
                  ${currentConfig.backgroundPreset === key 
                    ? "bg-slate-900 border-indigo-500 shadow-md" 
                    : "bg-slate-950/40 border-slate-800 hover:border-slate-750"
                  }
                `}
              >
                <span className="font-bold text-xs text-slate-200">{pat.label}</span>
                <div className="h-10 w-16 rounded-lg border border-black/10 shrink-0" style={{ background: pat.css }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4. IMAGE */}
      {currentConfig.backgroundType === "image" && (
        <div className="space-y-4">
          {currentConfig.backgroundImageUrl ? (
            <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl space-y-4">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative aspect-[16/9] w-full sm:w-40 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentConfig.backgroundImageUrl + "?v=" + currentConfig.backgroundUpdatedAt}
                    alt="Fundo"
                    className="h-full w-full object-cover"
                  />
                  {uploadLoading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />
                    </div>
                  )}
                </div>

                <div className="text-center sm:text-left space-y-1">
                  <h4 className="font-bold text-xs text-slate-200">Imagem Ativa</h4>
                  <p className="text-[10px] text-slate-500">O arquivo está salvo em backgrounds/{user?.uid}/main.</p>
                  <div className="flex gap-2 justify-center sm:justify-start pt-1.5">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-indigo-500/40 text-slate-300 hover:text-slate-100 text-xs font-semibold rounded-lg transition-all">
                      Substituir
                      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleBackgroundUpload} className="hidden" />
                    </label>
                    <button
                      type="button"
                      onClick={handleRemoveBackground}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600/10 hover:bg-red-650/20 text-red-400 border border-red-500/20 text-xs font-semibold rounded-lg transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Excluir</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Background Options */}
              <div className="border-t border-slate-850 pt-4 space-y-4">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Sliders className="h-4 w-4 text-indigo-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Ajustes da Imagem de Fundo</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Position */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Posição</label>
                    <select
                      value={currentConfig.backgroundPosition}
                      onChange={(e) => onChangeField("backgroundPosition", e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs font-semibold"
                    >
                      <option value="center">Centralizado</option>
                      <option value="top">Topo</option>
                      <option value="bottom">Base</option>
                      <option value="left">Esquerda</option>
                      <option value="right">Direita</option>
                    </select>
                  </div>

                  {/* Size */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ajuste de Escala</label>
                    <select
                      value={currentConfig.backgroundSize}
                      onChange={(e) => onChangeField("backgroundSize", e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs font-semibold"
                    >
                      <option value="cover">Preencher (Cover)</option>
                      <option value="contain">Conter (Contain)</option>
                    </select>
                  </div>

                  {/* Attachment */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Efeito de Rolagem</label>
                    <select
                      value={currentConfig.backgroundAttachment}
                      onChange={(e) => onChangeField("backgroundAttachment", e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs font-semibold"
                    >
                      <option value="scroll">Normal (Rolagem)</option>
                      <option value="fixed">Fixo (Parallax - Desktop)</option>
                    </select>
                    <span className="text-[9px] text-slate-500 block leading-normal">
                      💡 O efeito Fixo é desativado no mobile para otimizar desempenho.
                    </span>
                  </div>
                </div>

                {/* Overlays */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <span>Escurecer / Clarear Fundo (Overlay)</span>
                      <span className="text-slate-350">{currentConfig.backgroundOverlay}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="80"
                      step="10"
                      value={currentConfig.backgroundOverlay}
                      onChange={(e) => onChangeField("backgroundOverlay", parseInt(e.target.value, 10))}
                      className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cor da Camada (Overlay Color)</label>
                    <div className="flex gap-2">
                      {["dark", "light"].map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => onChangeField("backgroundOverlayColor", mode)}
                          className={`
                            flex-1 py-1.5 px-3 rounded-lg border text-xs font-bold capitalize transition-all cursor-pointer
                            ${currentConfig.backgroundOverlayColor === mode 
                              ? "bg-indigo-600 border-indigo-500 text-white" 
                              : "bg-slate-950/60 border-slate-800 text-slate-400"
                            }
                          `}
                        >
                          {mode === "dark" ? "Escuro" : "Claro"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center aspect-[16/9] w-full border-2 border-dashed border-slate-800 rounded-2xl bg-slate-950/20 cursor-pointer hover:border-slate-700 transition-all">
              <div className="flex flex-col items-center text-center p-6">
                {uploadLoading ? (
                  <>
                    <Loader2 className="h-8 w-8 text-indigo-500 animate-spin mb-2" />
                    <span className="text-xs font-bold text-slate-400">Enviando imagem...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-slate-500 mb-2" />
                    <span className="text-xs font-bold text-slate-400">Upload de Imagem de Fundo</span>
                    <span className="text-[10px] text-slate-550 mt-1">JPEG, PNG ou WEBP de até 3MB</span>
                  </>
                )}
              </div>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleBackgroundUpload} className="hidden" disabled={uploadLoading} />
            </label>
          )}
        </div>
      )}
    </div>
  );
}
