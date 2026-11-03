import type { CSSProperties } from "react";

// Faixas alternadas da lista "Horários livres por dia": a linha da data recebe um tom da cor principal
// do tema e a linha dos horários um fundo neutro, para o cliente distinguir data de horário.

const DATE_ROW_ALPHA = 0.16;
const SLOTS_ROW_BACKGROUND = "rgba(128,128,128,0.06)";

export function hexToRgba(hex: string, alpha: number): string | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  let digits = match[1];
  if (digits.length === 3) digits = digits.split("").map((c) => c + c).join("");
  const r = parseInt(digits.slice(0, 2), 16);
  const g = parseInt(digits.slice(2, 4), 16);
  const b = parseInt(digits.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function getSlotDayStripeStyles(primaryColor: string): { dateRow: CSSProperties; slotsRow: CSSProperties } {
  return {
    dateRow: { backgroundColor: hexToRgba(primaryColor, DATE_ROW_ALPHA) ?? "rgba(128,128,128,0.16)" },
    slotsRow: { backgroundColor: SLOTS_ROW_BACKGROUND },
  };
}
