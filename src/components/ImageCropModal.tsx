"use client";

import React, { useState, useCallback, useRef } from "react";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";
import { X, ZoomIn, ZoomOut, RotateCcw, Check, Loader2, Move } from "lucide-react";

interface ImageCropModalProps {
  /** Object URL of the raw uploaded image */
  src: string;
  /** Target aspect ratio. Pass undefined for free-form (no lock). Default: 1 (square) */
  aspect?: number;
  /** Label shown in the header */
  title?: string;
  /** Min/max zoom (default 1–3) */
  minZoom?: number;
  maxZoom?: number;
  onConfirm: (croppedBlob: Blob, previewDataUrl: string) => void;
  onClose: () => void;
}

/**
 * Converts a crop area (pixel coordinates) into a Blob using an off-screen canvas.
 */
async function getCroppedBlob(
  imageSrc: string,
  pixelCrop: Area,
  outputWidth = 1200,
): Promise<{ blob: Blob; dataUrl: string }> {
  const image = await createImageBitmap(await (await fetch(imageSrc)).blob());

  const scaleX = image.width / (pixelCrop.width + pixelCrop.x <= image.width ? image.width : pixelCrop.width + pixelCrop.x);
  // Use natural dimensions — pixelCrop is already in natural pixels from react-easy-crop
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  const targetAspect = pixelCrop.width / pixelCrop.height;
  canvas.width = outputWidth;
  canvas.height = Math.round(outputWidth / targetAspect);

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  return new Promise((resolve, reject) => {
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    canvas.toBlob(
      (blob) => {
        if (!blob) { reject(new Error("Canvas toBlob failed")); return; }
        resolve({ blob, dataUrl });
      },
      "image/jpeg",
      0.92,
    );
  });
}

export default function ImageCropModal({
  src,
  aspect = 1,
  title = "Ajustar imagem",
  minZoom = 1,
  maxZoom = 4,
  onConfirm,
  onClose,
}: ImageCropModalProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [applying, setApplying] = useState(false);
  const [lockedAspect, setLockedAspect] = useState<number | undefined>(aspect);

  const onCropComplete = useCallback((_: Area, pixelArea: Area) => {
    setCroppedAreaPixels(pixelArea);
  }, []);

  const handleApply = async () => {
    if (!croppedAreaPixels) return;
    setApplying(true);
    try {
      const { blob, dataUrl } = await getCroppedBlob(src, croppedAreaPixels);
      onConfirm(blob, dataUrl);
    } catch (e) {
      console.error("Crop error:", e);
    } finally {
      setApplying(false);
    }
  };

  const aspectOptions = [
    { label: "1:1", value: 1 },
    { label: "4:3", value: 4 / 3 },
    { label: "16:9", value: 16 / 9 },
    { label: "3:4", value: 3 / 4 },
    { label: "Livre", value: undefined },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <Move className="h-4 w-4 text-indigo-400" />
            <h2 className="text-sm font-bold text-slate-100">{title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Aspect ratio pills */}
        <div className="flex items-center gap-2 px-5 pt-3 pb-2 shrink-0 flex-wrap">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-1">Proporção:</span>
          {aspectOptions.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setLockedAspect(opt.value)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                lockedAspect === opt.value
                  ? "bg-indigo-600 border-indigo-500 text-white"
                  : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Crop canvas area */}
        <div className="relative bg-slate-950 mx-5 rounded-xl overflow-hidden" style={{ height: 320 }}>
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={lockedAspect}
            minZoom={minZoom}
            maxZoom={maxZoom}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            style={{
              containerStyle: { borderRadius: "0.75rem" },
              mediaStyle: {},
              cropAreaStyle: {
                border: "2px solid rgba(99,102,241,0.8)",
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
              },
            }}
            showGrid
          />
        </div>

        {/* Zoom slider */}
        <div className="px-5 pt-3 pb-2 shrink-0 space-y-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setZoom(z => Math.max(minZoom, z - 0.1))}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <input
              type="range"
              min={minZoom}
              max={maxZoom}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-indigo-500"
            />
            <button
              type="button"
              onClick={() => setZoom(z => Math.min(maxZoom, z + 0.1))}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 px-0.5">
            <span>Zoom: {zoom.toFixed(1)}×</span>
            <span className="text-slate-600">Arraste para reposicionar · Pinça para zoom no mobile</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 pb-5 pt-2 shrink-0">
          <button
            type="button"
            onClick={() => { setCrop({ x: 0, y: 0 }); setZoom(1); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold rounded-xl transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Resetar
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={applying}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-wait text-white text-xs font-bold rounded-xl transition-colors shadow-lg shadow-indigo-500/20"
          >
            {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Aplicar recorte
          </button>
        </div>
      </div>
    </div>
  );
}
