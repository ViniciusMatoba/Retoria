// Grade de horários estilo Google Agenda (visões Dia e Semana do painel).
// Funções puras de zoom por pinça, posicionamento dos blocos e sobreposição, testadas em scripts/test-time-grid.ts.

export const MIN_HOUR_HEIGHT = 28;
export const MAX_HOUR_HEIGHT = 200;
export const DEFAULT_HOUR_HEIGHT = 64;

export const clampHourHeight = (h: number): number => {
  if (!Number.isFinite(h)) return DEFAULT_HOUR_HEIGHT;
  return Math.min(MAX_HOUR_HEIGHT, Math.max(MIN_HOUR_HEIGHT, h));
};

// Nova altura da hora durante a pinça: proporcional à distância entre os dedos.
export const pinchHourHeight = (startHeight: number, startDistance: number, currentDistance: number): number => {
  if (startDistance <= 0) return clampHourHeight(startHeight);
  return clampHourHeight(startHeight * (currentDistance / startDistance));
};

// Mantém o horário que está sob os dedos (focusY, px a partir do topo visível da grade) no mesmo lugar da tela.
export const anchoredScrollTop = (scrollTop: number, focusY: number, oldHeight: number, newHeight: number): number => {
  if (oldHeight <= 0) return scrollTop;
  return Math.max(0, ((scrollTop + focusY) * newHeight) / oldHeight - focusY);
};

export const minutesToOffset = (minutes: number, hourHeight: number): number => (minutes / 60) * hourHeight;

export interface GridInterval {
  id: string;
  start: number; // minutos desde 00:00
  end: number;
}

export interface GridPlacement {
  col: number;
  cols: number;
}

// Blocos que se sobrepõem dividem a largura em colunas, como no Google Agenda.
export const layoutOverlaps = (items: GridInterval[]): Map<string, GridPlacement> => {
  const result = new Map<string, GridPlacement>();
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);

  let cluster: { item: GridInterval; col: number }[] = [];
  let clusterEnd = -Infinity;
  let colEnds: number[] = [];

  const flush = () => {
    const cols = colEnds.length || 1;
    cluster.forEach(({ item, col }) => result.set(item.id, { col, cols }));
    cluster = [];
    colEnds = [];
  };

  for (const item of sorted) {
    if (item.start >= clusterEnd) {
      flush();
      clusterEnd = -Infinity;
    }
    let col = colEnds.findIndex((end) => end <= item.start);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(item.end);
    } else {
      colEnds[col] = item.end;
    }
    cluster.push({ item, col });
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  flush();
  return result;
};

// Para onde rolar ao abrir o dia: um pouco antes do primeiro bloco, ou da hora atual quando é hoje.
export const initialScrollMinutes = (firstEventStart: number | null, nowMinutes: number | null): number => {
  const target = nowMinutes ?? firstEventStart ?? 7 * 60;
  return Math.max(0, target - 45);
};

// Deslizar o dedo para o lado troca de período (dia, semana ou mês), como no Google Agenda.
// Arrastar para a esquerda vai para o próximo; para a direita, volta. Gestos curtos, lentos ou
// mais verticais que horizontais são ignorados (rolagem normal).
export const SWIPE_MIN_DISTANCE = 60;
export const SWIPE_MAX_DURATION_MS = 800;

export const detectSwipe = (dx: number, dy: number, durationMs: number): "next" | "prev" | null => {
  if (durationMs > SWIPE_MAX_DURATION_MS) return null;
  if (Math.abs(dx) < SWIPE_MIN_DISTANCE) return null;
  if (Math.abs(dx) < Math.abs(dy) * 1.5) return null;
  return dx < 0 ? "next" : "prev";
};

export const getSaoPauloNowMinutes = (): number => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")?.value || 0) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value || 0);
  return h * 60 + m;
};
