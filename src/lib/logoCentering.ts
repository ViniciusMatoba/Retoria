// Centraliza o desenho do logo no quadrado ao enviar (Editar Perfil → foto/logo).
// Muitos logos vêm com o desenho deslocado dentro da imagem (sobra mais fundo de um lado).
// Se a imagem tem fundo liso (os 4 cantos com a mesma cor), recorta o fundo em volta do desenho
// e o recoloca no meio, com a mesma margem dos dois lados. Fotos (cantos diferentes) ficam como estão.
// Parte pura testada em scripts/test-logo-centering.ts; a parte com canvas roda só no navegador.

export type RGBA = [number, number, number, number];
export interface Bounds { x: number; y: number; w: number; h: number }

const TOLERANCE = 28; // diferença máxima por canal para contar como "fundo"
const MARGIN = 0.12; // margem em volta do desenho no quadrado final (12% de cada lado)

const px = (data: ArrayLike<number>, w: number, x: number, y: number): RGBA => {
  const i = (y * w + x) * 4;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
};

const near = (a: RGBA, b: RGBA, tol = TOLERANCE) => {
  // Transparência: dois pixels quase transparentes são iguais, seja qual for a cor
  if (a[3] < 16 && b[3] < 16) return true;
  return Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol && Math.abs(a[2] - b[2]) <= tol && Math.abs(a[3] - b[3]) <= tol;
};

// Cor de fundo, se os 4 cantos forem parecidos; senão null (é foto ou fundo com desenho).
export const uniformBackground = (data: ArrayLike<number>, w: number, h: number): RGBA | null => {
  const corners = [px(data, w, 0, 0), px(data, w, w - 1, 0), px(data, w, 0, h - 1), px(data, w, w - 1, h - 1)];
  return corners.every((c) => near(c, corners[0])) ? corners[0] : null;
};

// Retângulo do desenho (tudo que não é fundo). null se a imagem for só fundo.
export const contentBounds = (data: ArrayLike<number>, w: number, h: number, bg: RGBA): Bounds | null => {
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!near(px(data, w, x, y), bg)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
};

// Onde desenhar o recorte no quadrado final: centralizado, proporção mantida, com margem.
export const centeredPlacement = (b: Bounds, size: number, margin = MARGIN) => {
  const box = size * (1 - 2 * margin);
  const scale = Math.min(box / b.w, box / b.h);
  const w = Math.round(b.w * scale);
  const h = Math.round(b.h * scale);
  return { x: Math.round((size - w) / 2), y: Math.round((size - h) / 2), w, h };
};

// Vale a pena recentralizar? Só se o desenho estiver fora do centro ou com margens bem diferentes.
export const needsCentering = (b: Bounds, w: number, h: number) => {
  const offX = Math.abs(b.x - (w - (b.x + b.w)));
  const offY = Math.abs(b.y - (h - (b.y + b.h)));
  return offX > w * 0.02 || offY > h * 0.02;
};

// Navegador: devolve um PNG quadrado com o desenho centralizado, ou o próprio blob se não houver o que fazer.
export async function centerLogoBlob(blob: Blob, size = 512): Promise<Blob> {
  if (typeof document === "undefined" || typeof createImageBitmap === "undefined") return blob;
  try {
    const bmp = await createImageBitmap(blob);
    // Análise numa cópia pequena (rápida); o desenho final usa a imagem original
    const scan = Math.min(1, 256 / Math.max(bmp.width, bmp.height));
    const sw = Math.max(1, Math.round(bmp.width * scan));
    const sh = Math.max(1, Math.round(bmp.height * scan));
    const sc = document.createElement("canvas");
    sc.width = sw;
    sc.height = sh;
    const sctx = sc.getContext("2d", { willReadFrequently: true });
    if (!sctx) return blob;
    sctx.drawImage(bmp, 0, 0, sw, sh);
    const { data } = sctx.getImageData(0, 0, sw, sh);
    const bg = uniformBackground(data, sw, sh);
    if (!bg) return blob;
    const b = contentBounds(data, sw, sh, bg);
    if (!b || !needsCentering(b, sw, sh)) return blob;

    // Recorte na escala original (1 px de folga para não cortar antialias)
    const src = {
      x: Math.max(0, Math.floor((b.x - 1) / scan)),
      y: Math.max(0, Math.floor((b.y - 1) / scan)),
      w: Math.min(bmp.width, Math.ceil((b.w + 2) / scan)),
      h: Math.min(bmp.height, Math.ceil((b.h + 2) / scan)),
    };
    src.w = Math.min(src.w, bmp.width - src.x);
    src.h = Math.min(src.h, bmp.height - src.y);
    const dst = centeredPlacement(src, size);

    const out = document.createElement("canvas");
    out.width = size;
    out.height = size;
    const ctx = out.getContext("2d");
    if (!ctx) return blob;
    if (bg[3] >= 16) {
      ctx.fillStyle = `rgba(${bg[0]}, ${bg[1]}, ${bg[2]}, ${bg[3] / 255})`;
      ctx.fillRect(0, 0, size, size);
    }
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, src.x, src.y, src.w, src.h, dst.x, dst.y, dst.w, dst.h);
    return await new Promise<Blob>((resolve) => out.toBlob((r) => resolve(r ?? blob), "image/png"));
  } catch {
    return blob; // qualquer falha: envia a imagem como veio
  }
}
