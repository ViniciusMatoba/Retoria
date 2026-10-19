import { timeToMinutes, minutesToTime, addDaysSaoPaulo } from "@/lib/timezone";

export interface DayConfigLike {
  ativo?: boolean;
  inicio?: string;
  fim?: string;
  intervaloInicio?: string;
  intervaloFim?: string;
}

export interface SlotLike {
  id: string;
  data: string;
  horario: string;
  disponivel: boolean;
}

export interface LeadLike {
  dataEscolhida: string;
  status?: string;
  horarioInicio?: string;
  horarioEscolhido?: string;
  horarioFim?: string;
  duracaoAgendamento?: number;
}

export interface BusyInterval { start: number; end: number }
export type BusyByDate = Record<string, BusyInterval[]>;

const SP_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

function spDateAndMinutes(iso: string): { date: string; min: number } | null {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const p = Object.fromEntries(SP_PARTS.formatToParts(d).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: parseInt(p.hour, 10) * 60 + parseInt(p.minute, 10) };
}

// Converte um evento (início/fim ISO com fuso) em intervalos por dia no horário de São Paulo.
export function intervalsFromIsoRange(startIso: string, endIso: string): Array<{ date: string } & BusyInterval> {
  const a = spDateAndMinutes(startIso);
  const b = spDateAndMinutes(endIso);
  if (!a || !b) return [];
  let endDate = b.date;
  let endMin = b.min;
  if (endMin === 0 && endDate > a.date) { endDate = addDaysSaoPaulo(endDate, -1); endMin = 1440; }
  if (endDate < a.date || (endDate === a.date && endMin <= a.min)) return [];

  const out: Array<{ date: string } & BusyInterval> = [];
  let day = a.date;
  for (let guard = 0; guard < 400; guard++) {
    out.push({ date: day, start: day === a.date ? a.min : 0, end: day === endDate ? endMin : 1440 });
    if (day === endDate) break;
    day = addDaysSaoPaulo(day, 1);
  }
  return out;
}

export function overlapsBusy(busy: BusyByDate | null | undefined, dateStr: string, startMin: number, endMin: number): boolean {
  return (busy?.[dateStr] ?? []).some(iv => iv.start < endMin && iv.end > startMin);
}

const WEEKDAY_KEYS = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];

// Status que liberam o horário; qualquer outro ocupa a agenda.
const FREEING_STATUSES = new Set(["Cancelado", "Perdido"]);

export function parseServiceDurationMinutes(duracaoStr: string): number {
  if (!duracaoStr) return 30;
  const lower = duracaoStr.toLowerCase();
  let totalMinutes = 0;
  if (lower.includes("h") || lower.includes("hora")) {
    const parts = lower.split(/h|hora/);
    const hours = parseInt(parts[0].replace(/\D/g, ""), 10);
    if (!isNaN(hours)) totalMinutes += hours * 60;
    if (parts[1]) {
      const mins = parseInt(parts[1].replace(/\D/g, ""), 10);
      if (!isNaN(mins)) totalMinutes += mins;
    }
  } else {
    const mins = parseInt(lower.replace(/\D/g, ""), 10);
    if (!isNaN(mins)) totalMinutes = mins;
  }
  return totalMinutes > 0 ? totalMinutes : 30;
}

export function weekdayKeyOf(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return WEEKDAY_KEYS[new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()];
}

// Verifica o intervalo [startMin, endMin) contra o horário de funcionamento do dia.
// Dia sem configuração salva (perfil antigo) não bloqueia; dia inativo bloqueia.
export function isWithinWorkingHours(
  agendaConfig: Record<string, any> | undefined,
  dateStr: string,
  startMin: number,
  endMin: number
): boolean {
  const day = agendaConfig?.[weekdayKeyOf(dateStr)] as DayConfigLike | undefined;
  if (!day) return true;
  if (!day.ativo) return false;
  if (!day.inicio || !day.fim) return true;
  if (startMin < timeToMinutes(day.inicio) || endMin > timeToMinutes(day.fim)) return false;
  if (day.intervaloInicio && day.intervaloFim) {
    const lunchStart = timeToMinutes(day.intervaloInicio);
    const lunchEnd = timeToMinutes(day.intervaloFim);
    if (startMin < lunchEnd && endMin > lunchStart) return false;
  }
  return true;
}

export function leadInterval(lead: LeadLike, defaultDurationMin: number): { start: number; end: number } | null {
  const startStr = lead.horarioInicio || lead.horarioEscolhido;
  if (!startStr) return null;
  const start = timeToMinutes(startStr);
  const end = lead.horarioFim
    ? timeToMinutes(lead.horarioFim)
    : start + (lead.duracaoAgendamento || defaultDurationMin);
  return { start, end: Math.max(end, start + 1) };
}

export function overlapsActiveLead(
  leads: LeadLike[],
  dateStr: string,
  startMin: number,
  endMin: number,
  defaultDurationMin: number
): boolean {
  return leads.some(lead => {
    if (lead.dataEscolhida !== dateStr || FREEING_STATUSES.has(lead.status ?? "")) return false;
    const iv = leadInterval(lead, defaultDurationMin);
    return !!iv && iv.start < endMin && iv.end > startMin;
  });
}

// Primeiros `perDay` horários de início realmente livres de cada dia da janela para um atendimento de durationMin:
// dentro do expediente, com slots contíguos livres e sem choque com agendamentos ativos.
export function computeNextSlots(params: {
  agendaConfig?: Record<string, any>;
  slots: SlotLike[];
  leads: LeadLike[];
  durationMin: number;
  slotStepMin: number;
  perDay: number;
  isPast: (dateStr: string, timeStr: string) => boolean;
  busy?: BusyByDate | null;
}): SlotLike[] {
  const { agendaConfig, slots, leads, durationMin, slotStepMin, perDay, isPast, busy } = params;
  const free = slots
    .filter(s => s.disponivel)
    .sort((a, b) => (a.data === b.data ? timeToMinutes(a.horario) - timeToMinutes(b.horario) : a.data < b.data ? -1 : 1));
  const freeKeys = new Set(free.map(s => `${s.data}|${s.horario}`));
  const needed = Math.max(1, Math.ceil(durationMin / slotStepMin));

  const result: SlotLike[] = [];
  const perDayCount = new Map<string, number>();
  for (const slot of free) {
    if ((perDayCount.get(slot.data) ?? 0) >= perDay) continue;
    if (isPast(slot.data, slot.horario)) continue;

    const start = timeToMinutes(slot.horario);
    const end = start + durationMin;

    let contiguous = true;
    for (let i = 1; i < needed; i++) {
      if (!freeKeys.has(`${slot.data}|${minutesToTime(start + i * slotStepMin)}`)) { contiguous = false; break; }
    }
    if (!contiguous) continue;
    if (!isWithinWorkingHours(agendaConfig, slot.data, start, end)) continue;
    if (overlapsActiveLead(leads, slot.data, start, end, slotStepMin)) continue;
    if (overlapsBusy(busy, slot.data, start, end)) continue;

    result.push(slot);
    perDayCount.set(slot.data, (perDayCount.get(slot.data) ?? 0) + 1);
  }
  return result;
}
