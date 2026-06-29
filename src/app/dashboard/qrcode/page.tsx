"use client";

import React, { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { useAuth } from "../../providers";
import { Download, Copy, Check, QrCode, ExternalLink, Smartphone } from "lucide-react";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://retoria.vercel.app";

export default function QrCodePage() {
  const { profile } = useAuth();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [style, setStyle] = useState<"dark" | "light">("dark");
  const [size, setSize] = useState(280);

  const slug = profile?.slugPublico ?? "";
  const pageUrl = `${BASE_URL}/p/${slug}`;
  const businessName = profile?.nomeNegocio ?? "";

  const fgColor = style === "dark" ? "#ffffff" : "#0f172a";
  const bgColor = style === "dark" ? "#0f172a" : "#ffffff";
  const primaryColor = profile?.themeConfig?.primaryColor ?? profile?.corPrincipal ?? "#6366f1";

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(pageUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const canvas = canvasRef.current?.querySelector("canvas");
    if (!canvas) return;

    // Create padded export canvas
    const padding = 32;
    const labelH = 56;
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = canvas.width + padding * 2;
    exportCanvas.height = canvas.height + padding * 2 + labelH;
    const ctx = exportCanvas.getContext("2d")!;

    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // QR code
    ctx.drawImage(canvas, padding, padding);

    // Business name label
    ctx.fillStyle = fgColor;
    ctx.font = `bold 18px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(businessName || "Agendar agora", exportCanvas.width / 2, canvas.height + padding + 28);

    // Sub-label
    ctx.font = `13px system-ui, sans-serif`;
    ctx.fillStyle = style === "dark" ? "#94a3b8" : "#64748b";
    ctx.fillText("Escaneie para agendar", exportCanvas.width / 2, canvas.height + padding + 48);

    const link = document.createElement("a");
    link.download = `qrcode-${slug || "agendamento"}.png`;
    link.href = exportCanvas.toDataURL("image/png");
    link.click();
  };

  if (!slug) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
        <QrCode className="h-10 w-10 text-slate-600" />
        <p className="text-slate-400 font-semibold">Configure seu link público primeiro</p>
        <p className="text-sm text-slate-500">Acesse <strong>Editar Perfil</strong> e defina o endereço da sua página.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">QR Code de Agendamento</h1>
        <p className="text-sm text-slate-400 mt-1">
          Disponibilize esse QR code no balcão, nas redes sociais ou em materiais impressos. Ao escanear, o cliente acessa sua página de agendamento diretamente.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

        {/* QR Code preview */}
        <div className="flex flex-col items-center gap-4 p-6 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div
            ref={canvasRef}
            className="rounded-2xl p-5 shadow-2xl transition-colors duration-200"
            style={{ backgroundColor: bgColor }}
          >
            <QRCodeCanvas
              value={pageUrl}
              size={size}
              fgColor={fgColor}
              bgColor={bgColor}
              level="H"
              includeMargin={false}
              imageSettings={{
                src: "",
                excavate: false,
                width: 0,
                height: 0,
              }}
            />
          </div>

          {/* Business name below QR */}
          <div className="text-center">
            <p className="font-bold text-slate-100 text-sm">{businessName}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Escaneie para agendar</p>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-5">

          {/* Link */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Link da página</label>
            <div className="flex items-center gap-2 p-3 bg-slate-950 border border-slate-800 rounded-xl">
              <span className="text-xs text-indigo-400 font-mono flex-1 truncate">{pageUrl}</span>
              <a
                href={pageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-500 hover:text-slate-300 transition-colors shrink-0"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {/* Style toggle */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Estilo do QR Code</label>
            <div className="flex gap-2">
              {(["dark", "light"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStyle(s)}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                    style === s
                      ? "bg-indigo-600 border-indigo-500 text-white"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  {s === "dark" ? "Fundo escuro" : "Fundo branco"}
                </button>
              ))}
            </div>
          </div>

          {/* Size slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tamanho</label>
              <span className="text-[10px] text-slate-500">{size}px</span>
            </div>
            <input
              type="range"
              min={160}
              max={400}
              step={20}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between text-[9px] text-slate-600">
              <span>Pequeno</span>
              <span>Grande</span>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={handleDownload}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-indigo-500/20"
            >
              <Download className="h-4 w-4" />
              Baixar imagem (PNG)
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-semibold rounded-xl transition-all active:scale-[0.98]"
            >
              {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              {copied ? "Link copiado!" : "Copiar link"}
            </button>
          </div>
        </div>
      </div>

      {/* Usage tips */}
      <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-2xl space-y-3">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Como usar</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: "🖨️", title: "Material impresso", desc: "Imprima e coloque no balcão de atendimento ou em panfletos." },
            { icon: "📱", title: "Redes sociais", desc: "Poste na bio do Instagram ou no Stories para facilitar o agendamento." },
            { icon: "💬", title: "WhatsApp / Links", desc: "Copie o link e envie diretamente para os clientes pelo WhatsApp." },
          ].map((tip) => (
            <div key={tip.title} className="flex gap-2.5">
              <span className="text-lg shrink-0">{tip.icon}</span>
              <div>
                <p className="text-xs font-bold text-slate-300">{tip.title}</p>
                <p className="text-[10px] text-slate-500 leading-relaxed mt-0.5">{tip.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
