// Timezone America/Sao_Paulo utilities to prevent date shifting and time drift bugs.

export const timeToMinutes = (t: string): number => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export const minutesToTime = (min: number): string => {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
};

export const addMinutesToTime = (timeStr: string, minutes: number): string => {
  if (!timeStr) return "";
  const totalMin = timeToMinutes(timeStr) + minutes;
  return minutesToTime(totalMin);
};

// Get current date string in America/Sao_Paulo (YYYY-MM-DD)
export const getSaoPauloToday = () => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find(p => p.type === "year")?.value || "";
  const month = parts.find(p => p.type === "month")?.value || "";
  const day = parts.find(p => p.type === "day")?.value || "";
  return `${year}-${month}-${day}`; // YYYY-MM-DD
};

// Convert local browser date object to YYYY-MM-DD in Sao Paulo timezone
export const dateToSaoPauloKey = (date: Date): string => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find(p => p.type === "year")?.value || "";
  const month = parts.find(p => p.type === "month")?.value || "";
  const day = parts.find(p => p.type === "day")?.value || "";
  return `${year}-${month}-${day}`;
};

// Safely add/subtract days to YYYY-MM-DD date key in Sao Paulo fuso
export const addDaysSaoPaulo = (dateStr: string, days: number): string => {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)); // noon to avoid DST edge cases
  date.setUTCDate(date.getUTCDate() + days);
  return dateToSaoPauloKey(date);
};

// Find Sunday (start of week) for a YYYY-MM-DD date in Sao Paulo fuso
export const getStartOfWeekSaoPaulo = (dateStr: string): string => {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const utcDay = date.getUTCDay(); // Sunday=0, ..., Saturday=6
  date.setUTCDate(date.getUTCDate() - utcDay);
  return dateToSaoPauloKey(date);
};

// Check if a YYYY-MM-DD and HH:MM time is in the past relative to Sao Paulo current time
// offsetMinutes > 0 antecipa o "agora": o horário só é válido se começar depois de agora + offset.
export const isPastDateTimeSaoPaulo = (dateStr: string, timeStr: string, offsetMinutes = 0): boolean => {
  const now = new Date(Date.now() + offsetMinutes * 60_000);
  
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === "year")?.value || "";
  const month = parts.find(p => p.type === "month")?.value || "";
  const day = parts.find(p => p.type === "day")?.value || "";
  const hour = parts.find(p => p.type === "hour")?.value || "";
  const minute = parts.find(p => p.type === "minute")?.value || "";
  
  const todaySP = `${year}-${month}-${day}`;
  const timeSP = `${hour}:${minute}`;

  if (dateStr < todaySP) return true;
  if (dateStr === todaySP && timeStr < timeSP) return true;
  return false;
};

// Antecedência mínima para agendamentos feitos pelo cliente (página pública).
// O profissional não é limitado por ela ao agendar/mover manualmente.
export const PUBLIC_MIN_LEAD_MINUTES = 120;

// true se o horário já passou OU começa em menos de PUBLIC_MIN_LEAD_MINUTES a partir de agora.
export const isTooSoonForPublicBooking = (dateStr: string, timeStr: string): boolean =>
  isPastDateTimeSaoPaulo(dateStr, timeStr, PUBLIC_MIN_LEAD_MINUTES);

// Format YYYY-MM-DD into "Quinta-feira, 25/06/2026"
export const formatDateFriendlySaoPaulo = (dateStr: string): string => {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const options: Intl.DateTimeFormatOptions = { 
    timeZone: "America/Sao_Paulo",
    weekday: "long", 
    day: "2-digit", 
    month: "2-digit", 
    year: "numeric" 
  };
  const formatted = date.toLocaleDateString("pt-BR", options);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

export const formatDateShortSaoPaulo = (dateStr: string): string => {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
};

export const getMonthNameSaoPaulo = (dateStr: string): string => {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const formatted = date.toLocaleDateString("pt-BR", { 
    timeZone: "America/Sao_Paulo",
    month: "long", 
    year: "numeric" 
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};
