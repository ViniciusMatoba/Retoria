"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import LeadCardActions from "../components/LeadCardActions";
import TimeGridCalendar, { type TimeGridDay, type TimeGridEvent } from "../components/TimeGridCalendar";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  getDocs,
  where,
  writeBatch,
  runTransaction
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatPhoneFriendly, getWhatsAppLink } from "@/lib/whatsapp";
import { 
  timeToMinutes, 
  minutesToTime, 
  addMinutesToTime, 
  getSaoPauloToday, 
  dateToSaoPauloKey, 
  addDaysSaoPaulo, 
  getStartOfWeekSaoPaulo, 
  isPastDateTimeSaoPaulo, 
  formatDateFriendlySaoPaulo, 
  formatDateShortSaoPaulo, 
  getMonthNameSaoPaulo 
} from "@/lib/timezone";
import { mergeCustomerSuggestions } from "@/lib/customerSuggestions";
import { detectSwipe, getSaoPauloNowMinutes } from "@/lib/timeGrid";
import { useAuth } from "../../providers";
import { 
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Trash2,
  Check,
  X,
  Loader2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Info,
  Sliders,
  Sparkles,
  MessageSquare,
  Phone,
  User,
  Users,
  ChevronLeft,
  ChevronRight,
  Building2,
  Copy,
  Lock,
  Unlock
} from "lucide-react";
import { useAppModal } from "@/components/ModalProvider";

interface AvailableSlot {
  id: string;
  professionalId: string;
  data: string; // YYYY-MM-DD
  horario: string; // HH:MM
  disponivel: boolean;
  createdAt: any;
  updatedAt: any;
  source?: string;
  bloqueadoManual?: boolean; // bloqueado pelo profissional (sem agendamento)
  // bookingId e ocupacaoTipo removidos — SEC-005: índice privado em slotBookings
}

interface Service {
  id: string;
  nome: string;
  descricaoCurta: string;
  duracaoEstimada: string;
  ativo: boolean;
}

interface DayConfig {
  ativo: boolean;
  inicio: string;
  fim: string;
  intervaloInicio: string;
  intervaloFim: string;
}

const standardTimes = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30"
];

const weekdayKeys = [
  "domingo", // 0
  "segunda", // 1
  "terca",   // 2
  "quarta",  // 3
  "quinta",  // 4
  "sexta",   // 5
  "sabado"   // 6
];

const uiDisplayDays = [
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
  "domingo"
];

const weekdayLabels: Record<string, string> = {
  segunda: "Segunda-feira",
  terca: "Terça-feira",
  quarta: "Quarta-feira",
  quinta: "Quinta-feira",
  sexta: "Sexta-feira",
  sabado: "Sábado",
  domingo: "Domingo"
};

const defaultDays: Record<string, DayConfig> = {
  segunda: { ativo: true, inicio: "09:00", fim: "18:00", intervaloInicio: "12:00", intervaloFim: "13:00" },
  terca: { ativo: true, inicio: "09:00", fim: "18:00", intervaloInicio: "12:00", intervaloFim: "13:00" },
  quarta: { ativo: true, inicio: "09:00", fim: "18:00", intervaloInicio: "12:00", intervaloFim: "13:00" },
  quinta: { ativo: true, inicio: "09:00", fim: "18:00", intervaloInicio: "12:00", intervaloFim: "13:00" },
  sexta: { ativo: true, inicio: "09:00", fim: "18:00", intervaloInicio: "12:00", intervaloFim: "13:00" },
  sabado: { ativo: false, inicio: "09:00", fim: "18:00", intervaloInicio: "12:00", intervaloFim: "13:00" },
  domingo: { ativo: false, inicio: "09:00", fim: "18:00", intervaloInicio: "12:00", intervaloFim: "13:00" }
};

const durationOptions = [
  { value: 15,  label: "15 min" },
  { value: 30,  label: "30 min" },
  { value: 45,  label: "45 min" },
  { value: 60,  label: "1h" },
  { value: 90,  label: "1h 30min" },
  { value: 120, label: "2h" },
  { value: 150, label: "2h 30min" },
  { value: 180, label: "3h" },
  { value: 240, label: "4h" },
  { value: 300, label: "5h" },
  { value: 0,   label: "Personalizado..." },
];

const defaultCalendarColors = {
  disponivel: "#22C55E",
  agendado: "#3B82F6",
  atendido: "#8B5CF6",
  cancelado: "#EF4444",
  bloqueado: "#6B7280",
  perdido: "#F97316",
  novo: "#06B6D4",
  emContato: "#EAB308",
  continuacao: "#6366F1"
};

const originOptions: Record<string, { label: string, color: string }> = {
  "web-slug": { label: "Web Pública", color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
  "web-publica": { label: "Web Pública", color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
  "whatsapp": { label: "WhatsApp", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  "instagram": { label: "Instagram", color: "bg-pink-500/10 text-pink-400 border-pink-500/20" },
  "ligacao": { label: "Ligação", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  "indicacao": { label: "Indicação", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  "presencial": { label: "Presencial", color: "bg-teal-500/10 text-teal-400 border-teal-500/20" },
  "outro": { label: "Outro", color: "bg-slate-500/10 text-slate-400 border-slate-500/20" }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "Novo":
      return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    case "Em contato":
      return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "Agendado":
      return "bg-purple-500/10 text-purple-400 border-purple-500/20";
    case "Atendido":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "Cancelado":
      return "bg-rose-500/10 text-rose-400 border-rose-500/20";
    default:
      return "bg-slate-500/10 text-slate-400 border-slate-500/20";
  }
};

const periodOptions = [
  { value: 1, label: "Hoje" },
  { value: 7, label: "Próximos 7 dias" },
  { value: 15, label: "Próximos 15 dias" },
  { value: 30, label: "Próximos 30 dias" },
  { value: 45, label: "Próximos 45 dias" },
  { value: 60, label: "Próximos 60 dias" },
  { value: 90, label: "Próximos 90 dias" },
  { value: 180, label: "Próximos 180 dias" }
];

const windowDaysOptions = [
  { value: 7, label: "Próximos 7 dias" },
  { value: 15, label: "Próximos 15 dias" },
  { value: 30, label: "Próximos 30 dias" },
  { value: 45, label: "Próximos 45 dias" },
  { value: 60, label: "Próximos 60 dias" },
  { value: 90, label: "Próximos 90 dias" },
  { value: 180, label: "Próximos 180 dias" }
];

interface TeamMemberTab {
  id: string;
  nome: string;
  especialidade?: string;
}

export default function SlotsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const { showConfirmationModal } = useAppModal();
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(true);

  // Team / profissional selector
  const [teamMembers, setTeamMembers] = useState<TeamMemberTab[]>([]);
  // Já começa no próprio profissional: a agenda não espera a consulta da equipe para carregar
  const [activeProfId, setActiveProfId] = useState<string>(user?.uid ?? "");

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<"smart" | "manual" | "agenda">("agenda");
  
  // Result / Message States
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // --- SMART GENERATOR STATES ---
  const [agendaConfig, setAgendaConfig] = useState<Record<string, DayConfig>>(defaultDays);
  const [slotDuration, setSlotDuration] = useState(30);
  const [slotDurationCustom, setSlotDurationCustom] = useState("");
  const [periodDays, setPeriodDays] = useState(15);
  const [windowDays, setWindowDays] = useState(30);
  
  // Smart Preview Modal
  const [showPreview, setShowPreview] = useState(false);
  const [previewSummary, setPreviewSummary] = useState({
    startDateStr: "",
    endDateStr: "",
    daysConsidered: 0,
    estCreate: 0,
    estSkip: 0,
    estPast: 0,
    candidates: [] as Array<{ date: string; time: string }>
  });

  // Smart Feedback Modal
  const [showResult, setShowResult] = useState(false);
  const [resultMetrics, setResultMetrics] = useState({
    created: 0,
    duplicates: 0,
    past: 0
  });

  // --- MANUAL SLOT STATES ---
  const [manualDate, setManualDate] = useState("");
  const [manualSelectedTimes, setManualSelectedTimes] = useState<string[]>([]);
  const [manualCustomTime, setManualCustomTime] = useState("");

  // --- AGENDA TAB STATES ---
  const [agendaDateFilter, setAgendaDateFilter] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const [leads, setLeads] = useState<any[]>([]);

  // --- MANUAL BOOKING MODAL STATES ---
  const [showBookingModal, setShowBookingModal] = useState(false);
  // Pré-preenchimento do agendamento manual: horário livre tocado na agenda, ou cópia de um agendamento (Duplicar)
  const bookingPrefillRef = React.useRef<{
    data: string;
    horario: string;
    nome?: string;
    telefone?: string;
    servicoId?: string;
    duracaoOption?: string;
    duracaoCustom?: string;
    observacao?: string;
    origem?: string;
  } | null>(null);
  const [customerList, setCustomerList] = useState<{ nome: string; telefone: string }[]>([]);
  const [customerSuggestField, setCustomerSuggestField] = useState<"nome" | "telefone" | null>(null);
  const [bookingNome, setBookingNome] = useState("");
  const [bookingTelefone, setBookingTelefone] = useState("");
  const [bookingObservacao, setBookingObservacao] = useState("");
  const [bookingServicoId, setBookingServicoId] = useState("");
  const [bookingData, setBookingData] = useState("");
  const [bookingHorario, setBookingHorario] = useState("");
  const [bookingOrigem, setBookingOrigem] = useState("whatsapp");
  const [bookingDuracaoOption, setBookingDuracaoOption] = useState("30");
  const [bookingDuracaoCustom, setBookingDuracaoCustom] = useState("");
  const [bookingError, setBookingError] = useState("");

  // --- CALENDAR & COLOR THEME STATES ---
  const [calendarView, setCalendarView] = useState<"month" | "week" | "day">("month");
  const [calendarRefDate, setCalendarRefDate] = useState<string>("");
  const [calendarColors, setCalendarColors] = useState<Record<string, string>>(defaultCalendarColors);
  const [colorEditor, setColorEditor] = useState<Record<string, string>>(defaultCalendarColors);
  const [showColorsConfig, setShowColorsConfig] = useState(false);
  
  // --- CALENDAR FILTERS ---
  const [filterServico, setFilterServico] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterOrigem, setFilterOrigem] = useState("");
  const [filterSearch, setFilterSearch] = useState("");

  // --- EDIT BOOKING MODAL STATES ---
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLead, setEditingLead] = useState<any | null>(null);
  const [editingLeadSlotIds, setEditingLeadSlotIds] = useState<Set<string>>(new Set());
  const [editNome, setEditNome] = useState("");
  const [editTelefone, setEditTelefone] = useState("");
  const [editObservacao, setEditObservacao] = useState("");
  const [editServicoId, setEditServicoId] = useState("");
  const [editData, setEditData] = useState("");
  const [editHorario, setEditHorario] = useState("");
  const [editOrigem, setEditOrigem] = useState("whatsapp");
  const [movingLead, setMovingLead] = useState<any | null>(null);
  const [dragLeadId, setDragLeadId] = useState<string | null>(null);
  const [googleNeedsReconnect, setGoogleNeedsReconnect] = useState(false);
  const [slotMenuId, setSlotMenuId] = useState<string | null>(null);
  const [slotActionId, setSlotActionId] = useState<string | null>(null);
  // Bloco tocado na grade das visões Dia/Semana (abre o painel de detalhes)
  const [gridSelection, setGridSelection] = useState<{ type: "lead" | "slot"; id: string } | null>(null);
  const swipeStartRef = React.useRef<{ x: number; y: number; t: number } | null>(null);
  const [swipeDir, setSwipeDir] = useState<1 | -1 | 0>(0);
  const [editStatus, setEditStatus] = useState("Agendado");
  const [editDuracaoOption, setEditDuracaoOption] = useState("30");
  const [editDuracaoCustom, setEditDuracaoCustom] = useState("");
  const [editError, setEditError] = useState("");

  // Load Saved Configuration from Firestore Profile
  useEffect(() => {
    if (profile?.agendaConfig) {
      // Load duration
      if (profile.agendaConfig.duracaoSlot) {
        setSlotDuration(profile.agendaConfig.duracaoSlot);
      }

      // Load visibility window
      if (profile.agendaConfig.janelaAgendamentoDias) {
        setWindowDays(profile.agendaConfig.janelaAgendamentoDias);
      }
      
      // Load days config
      const cleanDays: Record<string, DayConfig> = {};
      weekdayKeys.forEach(key => {
        if (profile.agendaConfig[key]) {
          cleanDays[key] = { ...profile.agendaConfig[key] };
        } else {
          cleanDays[key] = { ...defaultDays[key] };
        }
      });
      setAgendaConfig(cleanDays);
    }

    if (profile?.calendarColorConfig) {
      const mergedColors = {
        ...defaultCalendarColors,
        ...profile.calendarColorConfig
      };
      setCalendarColors(mergedColors);
      setColorEditor(mergedColors);
    }
  }, [profile]);

  // Initialize Default Tomorrow Date and Reference Date using America/Sao_Paulo fuso
  useEffect(() => {
    const todayStr = getSaoPauloToday();
    setCalendarRefDate(todaySP => todaySP || todayStr); // preserve state if already set, else set today
    setManualDate(addDaysSaoPaulo(todayStr, 1));
  }, []);

  // Fetch team members and set default activeProfId
  useEffect(() => {
    if (!user) return;
    const fetchTeam = async () => {
      try {
        const q = query(
          collection(db, "professionals"),
          where("parentProfessionalId", "==", user.uid),
          where("role", "==", "team_member"),
          where("professionalStatus", "==", "active"),
        );
        const snap = await getDocs(q);
        const members: TeamMemberTab[] = snap.docs.map((d) => ({
          id: d.id,
          nome: d.data().nome ?? "",
          especialidade: d.data().teamConfig?.especialidade ?? d.data().especialidade ?? "",
        }));
        setTeamMembers(members);
      } catch {
        // sem equipe
      } finally {
        setActiveProfId((prev) => prev || user.uid);
      }
    };
    fetchTeam();
  }, [user]);

  // Limpeza automática de slots bloqueados por leads cancelados/deletados
  useEffect(() => {
    if (!user) return;
    // Uma vez por sessão do navegador: a rota lê todos os agendamentos ativos a cada chamada
    const cleanupFlag = `retoria_slots_cleanup_${user.uid}`;
    try {
      if (sessionStorage.getItem(cleanupFlag)) return;
      sessionStorage.setItem(cleanupFlag, "1");
    } catch {}
    user.getIdToken().then(token => {
      fetch(`/api/professionals/${user.uid}/slots/cleanup`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(() => {
          // cleanup silencioso — slots de leads inativos liberados automaticamente
        })
        .catch(() => {});
    });
  // Roda apenas uma vez ao montar
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // Load slots in real-time — re-executa quando muda o profissional ativo
  useEffect(() => {
    if (!user || !activeProfId) return;

    const slotsRef = collection(db, "professionals", activeProfId, "availableSlots");
    // Só do mês atual em diante: horários vagos de meses passados não servem para nada e pesavam a cada abertura.
    // Os agendamentos passados continuam visíveis, pois vêm dos leads.
    const fromDate = `${getSaoPauloToday().slice(0, 8)}01`;
    const q = query(slotsRef, where("data", ">=", fromDate), orderBy("data", "asc"), orderBy("horario", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const slotsData: AvailableSlot[] = [];
      snapshot.forEach((doc) => {
        slotsData.push({ id: doc.id, ...doc.data() } as AvailableSlot);
      });
      setSlots(slotsData);
      setLoading(false);
    }, (err) => {
      console.error("Error loading slots:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, activeProfId]);

  // Load services and leads — re-executa quando muda o profissional ativo
  useEffect(() => {
    if (!user || !activeProfId) return;

    const servicesRef = collection(db, "professionals", activeProfId, "services");
    const servicesQuery = query(servicesRef, where("ativo", "==", true), orderBy("nome", "asc"));

    getDocs(servicesQuery).then(snap => {
      const servicesList: Service[] = [];
      snap.forEach(doc => {
        servicesList.push({ id: doc.id, ...doc.data() } as Service);
      });
      setServices(servicesList);
    }).catch(err => console.error("Error loading services:", err));

    getDocs(collection(db, "professionals", activeProfId, "customers")).then(snap => {
      setCustomerList(snap.docs
        .map(d => ({ nome: String(d.data().nome ?? ""), telefone: String(d.data().telefone ?? "").replace(/\D/g, "") }))
        .filter(c => c.nome && c.telefone));
    }).catch(err => console.error("Error loading customers:", err));

    const leadsRef = collection(db, "professionals", activeProfId, "leads");
    const unsubscribeLeads = onSnapshot(leadsRef, (snapshot) => {
      const leadsList: any[] = [];
      snapshot.forEach(doc => {
        leadsList.push({ id: doc.id, ...doc.data() });
      });
      setLeads(leadsList);
    }, (err) => {
      console.error("Error loading leads:", err);
    });

    return () => {
      unsubscribeLeads();
    };
  }, [user, activeProfId]);

  // Initialize and clear inputs for manual booking modal
  useEffect(() => {
    if (showBookingModal) {
      const prefill = bookingPrefillRef.current;
      bookingPrefillRef.current = null;
      setBookingNome(prefill?.nome || "");
      setBookingTelefone(prefill?.telefone ? formatPhoneFriendly(prefill.telefone) : "");
      setBookingObservacao(prefill?.observacao || "");
      setBookingServicoId(prefill?.servicoId || "");
      setBookingData(prefill?.data || agendaDateFilter || getSaoPauloToday());
      setBookingHorario(prefill?.horario || "");
      setCustomerSuggestField(null);
      setBookingOrigem(prefill?.origem || "whatsapp");
      setBookingDuracaoOption(prefill?.duracaoOption || "30");
      setBookingDuracaoCustom(prefill?.duracaoCustom || "");
      setBookingError("");
    }
  }, [showBookingModal, agendaDateFilter]);

  // Memoized query maps for performance optimization (O(1) lookups)
  const { leadByBookingId, leadByDateTime, slotsByDate } = React.useMemo(() => {
    const leadMap = new Map<string, any>();
    const dateTimeMap = new Map<string, any>();
    
    leads.forEach(l => {
      leadMap.set(l.id, l);
      dateTimeMap.set(`${l.dataEscolhida}_${l.horarioEscolhido}`, l);
    });

    const slotsMap = new Map<string, AvailableSlot[]>();
    slots.forEach(s => {
      if (!slotsMap.has(s.data)) {
        slotsMap.set(s.data, []);
      }
      slotsMap.get(s.data)!.push(s);
    });

    return { 
      leadByBookingId: leadMap, 
      leadByDateTime: dateTimeMap,
      slotsByDate: slotsMap 
    };
  }, [leads, slots]);

  const customerSuggestions = React.useMemo(() => mergeCustomerSuggestions(customerList, leads), [customerList, leads]);

  // Group slots by date for components compatibility
  const groupedSlots = React.useMemo(() => {
    const res: Record<string, AvailableSlot[]> = {};
    slotsByDate.forEach((list, key) => {
      res[key] = list;
    });
    return res;
  }, [slotsByDate]);

  // --- SMART GENERATOR LOGIC ---
  const handleToggleDay = (dayKey: string) => {
    setAgendaConfig(prev => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        ativo: !prev[dayKey].ativo
      }
    }));
  };

  const handleTimeChange = (dayKey: string, field: "inicio" | "fim" | "intervaloInicio" | "intervaloFim", val: string) => {
    setAgendaConfig(prev => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        [field]: val
      }
    }));
  };

  // Helper: parse service duration to option and custom values
  const parseServiceDuration = (duracaoStr: string): { option: string; customVal: string } => {
    if (!duracaoStr) return { option: "30", customVal: "" };
    const lower = duracaoStr.toLowerCase();
    let totalMinutes = 0;
    if (lower.includes("h") || lower.includes("hora")) {
      const parts = lower.split(/h|hora/);
      const hours = parseInt(parts[0].replace(/\D/g, ""), 10);
      if (!isNaN(hours)) {
        totalMinutes += hours * 60;
      }
      if (parts[1]) {
        const mins = parseInt(parts[1].replace(/\D/g, ""), 10);
        if (!isNaN(mins)) {
          totalMinutes += mins;
        }
      }
    } else {
      const mins = parseInt(lower.replace(/\D/g, ""), 10);
      if (!isNaN(mins)) {
        totalMinutes = mins;
      }
    }
    if (totalMinutes <= 0) {
      return { option: "30", customVal: "" };
    }
    const standardOptions = ["15", "30", "45", "60", "90", "120"];
    if (standardOptions.includes(String(totalMinutes))) {
      return { option: String(totalMinutes), customVal: "" };
    } else {
      return { option: "custom", customVal: String(totalMinutes) };
    }
  };

  // Helper: get lead duration in minutes
  const getLeadDurationInMinutes = (lead: any, servicesList: Service[], defaultSlotDuration: number) => {
    if (lead.duracaoAgendamento) {
      return Number(lead.duracaoAgendamento);
    }
    if (lead.serviceId) {
      const service = servicesList.find(s => s.id === lead.serviceId);
      if (service) {
        const parsed = parseInt(service.duracaoEstimada.replace(/\D/g, ""), 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    }
    return defaultSlotDuration || 30;
  };

  // sRGB relative luminance helper
  const getRelativeLuminance = (hex: string): number => {
    const cleanHex = hex.replace("#", "");
    if (cleanHex.length !== 6) return 0;
    const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
    const f = (x: number) => x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };

  // WCAG Contrast Ratio
  const getContrastRatio = (color1: string, color2: string): number => {
    const l1 = getRelativeLuminance(color1);
    const l2 = getRelativeLuminance(color2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  };

  // Select the text color that gives maximum contrast
  const getBestTextColor = (bgHex: string): { textHex: string, ratio: number, isWcagCompliant: boolean } => {
    const lightRatio = getContrastRatio(bgHex, "#ffffff");
    const darkRatio = getContrastRatio(bgHex, "#0f172a"); // slate-900
    const textHex = lightRatio >= darkRatio ? "#ffffff" : "#0f172a";
    const ratio = Math.max(lightRatio, darkRatio);
    return { textHex, ratio, isWcagCompliant: ratio >= 4.5 };
  };

  // Centralized visual style function
  const getCalendarStatusStyle = (status: string, colorConfig: any) => {
    const colors = colorConfig || defaultCalendarColors;
    let color = "#6B7280";
    let label = status;

    switch (status) {
      case "Disponível":
        color = colors.disponivel || defaultCalendarColors.disponivel;
        label = "Livre";
        break;
      case "Bloqueado":
        color = colors.bloqueado || defaultCalendarColors.bloqueado;
        label = "Bloqueado";
        break;
      case "Continuação":
        color = colors.continuacao || defaultCalendarColors.continuacao;
        label = "Continuação";
        break;
      case "Novo":
        color = colors.novo || defaultCalendarColors.novo;
        label = "Novo";
        break;
      case "Em contato":
        color = colors.emContato || defaultCalendarColors.emContato;
        label = "Em contato";
        break;
      case "Agendado":
        color = colors.agendado || defaultCalendarColors.agendado;
        label = "Agendado";
        break;
      case "Atendido":
        color = colors.atendido || defaultCalendarColors.atendido;
        label = "Atendido";
        break;
      case "Cancelado":
        color = colors.cancelado || defaultCalendarColors.cancelado;
        label = "Cancelado";
        break;
      case "Perdido":
        color = colors.perdido || defaultCalendarColors.perdido;
        label = "Perdido";
        break;
    }

    const { textHex, ratio, isWcagCompliant } = getBestTextColor(color);

    return {
      bg: color,
      text: textHex,
      border: color,
      label,
      rawColor: color,
      ratio,
      isWcagCompliant
    };
  };

  // Origin badges label mapper for custom visualization
  const originLabels: Record<string, string> = {
    "web-slug": "Web Pública",
    "web-publica": "Web Pública",
    "whatsapp": "WhatsApp",
    "instagram": "Instagram",
    "ligacao": "Ligação",
    "indicacao": "Indicação",
    "presencial": "Presencial",
    "outro": "Outro"
  };

  // Capitalize day names for errors
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  // Validate settings for all active days
  const validateSettings = () => {
    for (const key of weekdayKeys) {
      const config = agendaConfig[key];
      if (!config.ativo) continue;

      const dayLabel = weekdayLabels[key];

      // 1. Check if start & end are set
      if (!config.inicio || !config.fim) {
        return `No(a) ${dayLabel}, os horários de início e término são obrigatórios.`;
      }

      // Validate HH:MM format
      const timeRegex = /^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(config.inicio) || !timeRegex.test(config.fim)) {
        return `No(a) ${dayLabel}, os horários devem estar no formato HH:MM.`;
      }

      const startMin = timeToMinutes(config.inicio);
      const endMin = timeToMinutes(config.fim);

      // 2. Check if end <= start
      if (endMin <= startMin) {
        return `No(a) ${dayLabel}, o horário de término deve ser após o horário de início.`;
      }

      // 3. Check if break is partially filled
      const hasIntStart = !!config.intervaloInicio;
      const hasIntEnd = !!config.intervaloFim;
      
      if (hasIntStart !== hasIntEnd) {
        return `No(a) ${dayLabel}, o intervalo de almoço deve ter ambos horários de início e término preenchidos.`;
      }

      if (hasIntStart && hasIntEnd) {
        if (!timeRegex.test(config.intervaloInicio) || !timeRegex.test(config.intervaloFim)) {
          return `No(a) ${dayLabel}, os horários de intervalo devem estar no formato HH:MM.`;
        }

        const intStartMin = timeToMinutes(config.intervaloInicio);
        const intEndMin = timeToMinutes(config.intervaloFim);

        // 4. Check if break end <= break start
        if (intEndMin <= intStartMin) {
          return `No(a) ${dayLabel}, o término do intervalo de almoço deve ser após o início do intervalo.`;
        }

        // 5. Check if interval is within working hours
        if (intStartMin < startMin || intEndMin > endMin) {
          return `No(a) ${dayLabel}, o intervalo de almoço deve estar inteiramente contido dentro do horário de funcionamento.`;
        }
      }
    }
    return null; // All valid
  };

  // Generate candidate list based strictly on agendaConfig
  const calculateCandidates = () => {
    const candidates: Array<{ date: string; time: string }> = [];
    let pastCount = 0;

    // Dia e hora de Brasília (antes usava UTC e, depois das 21h, começava a gerar pelo dia seguinte)
    const nowMinutes = getSaoPauloNowMinutes();
    const todayStr = getSaoPauloToday();

    for (let i = 0; i < periodDays; i++) {
      const dateStr = addDaysSaoPaulo(todayStr, i);
      const [cy, cm, cd] = dateStr.split("-").map(Number);
      const weekdayIndex = new Date(Date.UTC(cy, cm - 1, cd, 12)).getUTCDay(); // Sunday=0, ..., Saturday=6
      const dayKey = weekdayKeys[weekdayIndex];
      const config = agendaConfig[dayKey];

      // Skip if this weekday is set as inactive
      if (!config.ativo) continue;

      const startMin = timeToMinutes(config.inicio);
      const endMin = timeToMinutes(config.fim);
      
      const hasLunch = !!config.intervaloInicio && !!config.intervaloFim;
      const lunchStartMin = hasLunch ? timeToMinutes(config.intervaloInicio) : 0;
      const lunchEndMin = hasLunch ? timeToMinutes(config.intervaloFim) : 0;

      let currentMin = startMin;
      while (currentMin + slotDuration <= endMin) {
        const slotStart = currentMin;
        const slotEnd = currentMin + slotDuration;
        const timeStr = minutesToTime(currentMin);

        // 1. Check lunch break overlap
        const overlapsLunch = hasLunch && (slotStart < lunchEndMin && slotEnd > lunchStartMin);
        
        // 2. Check past times overlap (for today only)
        const isToday = dateStr === todayStr;
        const isPast = isToday && slotStart < nowMinutes;

        if (overlapsLunch) {
          currentMin += slotDuration;
          continue;
        }

        if (isPast) {
          pastCount++;
        } else {
          candidates.push({ date: dateStr, time: timeStr });
        }

        currentMin += slotDuration;
      }
    }

    return { candidates, pastCount };
  };

  const handleSaveConfigOnly = async () => {
    if (!user) return;
    setError("");
    setSuccess("");

    // Validate settings
    const validationError = validateSettings();
    if (validationError) {
      setError(validationError);
      return;
    }

    // Check if at least one day is active
    const hasActiveDay = Object.values(agendaConfig).some(d => d.ativo);
    if (!hasActiveDay) {
      setError("Ative pelo menos um dia da semana para salvar a rotina.");
      return;
    }

    setActionLoading(true);
    try {
      const profRef = doc(db, "professionals", user.uid);
      await updateDoc(profRef, {
        agendaConfig: {
          ...agendaConfig,
          duracaoSlot: slotDuration,
          janelaAgendamentoDias: windowDays
        },
        updatedAt: new Date()
      });
      await refreshProfile();
      setSuccess("Configurações da agenda salvas com sucesso!");
    } catch (err: any) {
      console.error(err);
      setError("Erro ao salvar configurações: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenSmartPreview = async () => {
    if (!user) return;
    setError("");
    setSuccess("");

    // 1. Run validations
    const validationError = validateSettings();
    if (validationError) {
      setError(validationError);
      return;
    }

    // Check if at least one day is active
    const hasActiveDay = Object.values(agendaConfig).some(d => d.ativo);
    if (!hasActiveDay) {
      setError("Ative pelo menos um dia da semana para gerar horários.");
      return;
    }

    setActionLoading(true);

    try {
      // 2. Save settings to the professional's profile in Firestore
      const profRef = doc(db, "professionals", user.uid);
      await updateDoc(profRef, {
        agendaConfig: {
          ...agendaConfig,
          duracaoSlot: slotDuration,
          janelaAgendamentoDias: windowDays
        },
        updatedAt: new Date()
      });
      await refreshProfile();

      // 3. Compute candidates
      const { candidates, pastCount } = calculateCandidates();

      if (candidates.length === 0) {
        setError("Nenhum horário gerado para os critérios de período selecionados.");
        setActionLoading(false);
        return;
      }

      // 4. Fetch existing slots in range to compute duplicates
      const slotsRef = collection(db, "professionals", activeProfId, "availableSlots");
      const todayStr = getSaoPauloToday();
      const futureStr = addDaysSaoPaulo(todayStr, periodDays - 1);

      const q = query(slotsRef, where("data", ">=", todayStr), where("data", "<=", futureStr));
      const snap = await getDocs(q);

      const existingSet = new Set<string>();
      snap.forEach(doc => {
        const d = doc.data();
        existingSet.add(`${d.data}_${d.horario}`);
      });

      let estCreate = 0;
      let estSkip = 0;

      candidates.forEach(c => {
        if (existingSet.has(`${c.date}_${c.time}`)) {
          estSkip++;
        } else {
          estCreate++;
        }
      });

      setPreviewSummary({
        startDateStr: todayStr,
        endDateStr: futureStr,
        daysConsidered: periodDays,
        estCreate,
        estSkip,
        estPast: pastCount,
        candidates
      });

      setShowPreview(true);

    } catch (err: any) {
      console.error(err);
      setError("Erro ao gerar prévia: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmSmartGeneration = async () => {
    if (!user) return;
    setShowPreview(false);
    setActionLoading(true);

    try {
      // Fetch all slots in the range to be absolutely sure we do not touch booked ones
      const slotsRef = collection(db, "professionals", activeProfId, "availableSlots");
      const todayStr = previewSummary.startDateStr;
      const futureStr = previewSummary.endDateStr;

      const q = query(slotsRef, where("data", ">=", todayStr), where("data", "<=", futureStr));
      const snap = await getDocs(q);

      const existingMap = new Map<string, boolean>();
      snap.forEach(doc => {
        const d = doc.data();
        existingMap.set(`${d.data}_${d.horario}`, d.disponivel);
      });

      let createdCount = 0;
      let dupCount = 0;
      const slotsToSave: Array<{ data: string; horario: string; slotId: string }> = [];

      previewSummary.candidates.forEach(c => {
        const key = `${c.date}_${c.time}`;
        
        if (existingMap.has(key)) {
          // Never overwrite existing slots
          dupCount++;
        } else {
          // Deterministic slotId format: YYYY-MM-DD_HH-mm
          const slotId = `${c.date}_${c.time.replace(":", "-")}`;
          slotsToSave.push({ data: c.date, horario: c.time, slotId });
        }
      });

      // Write in batches of 400
      let batch = writeBatch(db);
      let batchCount = 0;

      for (const slot of slotsToSave) {
        const docRef = doc(db, "professionals", activeProfId, "availableSlots", slot.slotId);
        const payload = {
          id: slot.slotId,
          professionalId: activeProfId,
          data: slot.data,
          horario: slot.horario,
          disponivel: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          source: "auto-generator"
        };
        
        batch.set(docRef, payload);
        batchCount++;
        createdCount++;

        if (batchCount === 400) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }

      // Display feedback metrics
      setResultMetrics({
        created: createdCount,
        duplicates: dupCount,
        past: previewSummary.estPast
      });
      setShowResult(true);

    } catch (err: any) {
      console.error(err);
      setError("Erro ao gerar agenda inteligente: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // --- MANUAL SLOT LOGIC ---
  const handleManualTimeCheckbox = (time: string) => {
    if (manualSelectedTimes.includes(time)) {
      setManualSelectedTimes(manualSelectedTimes.filter(t => t !== time));
    } else {
      setManualSelectedTimes([...manualSelectedTimes, time]);
    }
  };

  const handleManualAddCustomTime = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCustomTime) return;
    
    if (!/^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/.test(manualCustomTime)) {
      setError("Formato de hora inválido. Use HH:MM.");
      return;
    }

    if (manualSelectedTimes.includes(manualCustomTime)) {
      setError("Este horário já está na lista.");
      return;
    }

    setManualSelectedTimes([...manualSelectedTimes, manualCustomTime].sort());
    setManualCustomTime("");
    setError("");
  };

  const handleManualGenerateSlots = async () => {
    if (!user) return;
    setError("");
    setSuccess("");
    
    if (!manualDate) {
      setError("Selecione uma data.");
      return;
    }

    if (manualSelectedTimes.length === 0) {
      setError("Selecione pelo menos um horário.");
      return;
    }

    setActionLoading(true);

    try {
      const slotsRef = collection(db, "professionals", activeProfId, "availableSlots");
      let addedCount = 0;
      let duplicateCount = 0;

      for (const time of manualSelectedTimes) {
        // Deterministic slotId
        const slotId = `${manualDate}_${time.replace(":", "-")}`;

        // Check duplication using direct document reference
        const docRef = doc(db, "professionals", activeProfId, "availableSlots", slotId);
        const q = query(slotsRef, where("data", "==", manualDate), where("horario", "==", time));
        const checkSnap = await getDocs(q);

        if (checkSnap.empty) {
          const slotPayload = {
            id: slotId,
            professionalId: activeProfId,
            data: manualDate,
            horario: time,
            disponivel: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            source: "manual"
          };
          await setDoc(docRef, slotPayload);
          addedCount++;
        } else {
          duplicateCount++;
        }
      }

      let message = `Criado(s) ${addedCount} horário(s) avulso(s) para ${formatDate(manualDate)}.`;
      if (duplicateCount > 0) {
        message += ` (${duplicateCount} duplicados ignorados).`;
      }
      setSuccess(message);
      setManualSelectedTimes([]);
    } catch (err: any) {
      console.error(err);
      setError("Erro ao gerar horários avulsos: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // --- GENERAL SLOT ACTIONS ---
  // Bloqueia/reativa um horário livre. Transação: nunca bloqueia um horário que acabou de ser reservado,
  // nem reativa um horário ocupado por agendamento.
  const handleToggleSlot = async (slot: AvailableSlot, block: boolean) => {
    if (!user) return;
    setSlotActionId(slot.id);
    try {
      const docRef = doc(db, "professionals", activeProfId, "availableSlots", slot.id);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(docRef);
        if (!snap.exists()) throw new Error("slot-missing");
        const cur = snap.data();
        if (block && !cur.disponivel) throw new Error("slot-taken");
        if (!block && cur.disponivel) throw new Error("not-blocked");
        tx.update(docRef, {
          disponivel: !block,
          bloqueadoManual: block,
          updatedAt: new Date(),
        });
      });
      setSlotMenuId(null);
    } catch (err: any) {
      console.error("Error toggling slot:", err);
      setError(
        err.message === "slot-taken" ? "Este horário acabou de ser reservado e não pode ser bloqueado." :
        err.message === "not-blocked" ? "Este horário já está livre." :
        "Erro ao alterar o horário."
      );
      setSlotMenuId(null);
    } finally {
      setSlotActionId(null);
    }
  };

  // Bloqueia (ou libera) o dia inteiro: todos os horários livres que ainda não passaram viram "bloqueado",
  // ou todos os bloqueados manualmente voltam a ficar livres. Horários com agendamento não são tocados;
  // a transação relê cada horário para não bloquear um que acabou de ser reservado.
  const handleToggleWholeDay = (dateStr: string, block: boolean) => {
    if (!user) return;
    const targets = (slotsByDate.get(dateStr) || []).filter(s =>
      block ? s.disponivel && !isPastDateTimeSaoPaulo(dateStr, s.horario) : !s.disponivel && s.bloqueadoManual
    );
    if (targets.length === 0) return;
    showConfirmationModal({
      title: block ? "Bloquear o dia todo" : "Liberar o dia",
      description: block
        ? `Bloquear os ${targets.length} horário(s) livre(s) de ${formatDate(dateStr)}? Os clientes não poderão agendar nesse dia. Agendamentos já marcados continuam.`
        : `Liberar os ${targets.length} horário(s) bloqueado(s) de ${formatDate(dateStr)}? Eles voltam a aparecer para os clientes.`,
      confirmLabel: block ? "Bloquear dia" : "Liberar dia",
      cancelLabel: "Voltar",
      variant: block ? "danger" : "info",
      onConfirm: async () => {
        setSlotActionId(`day-${dateStr}`);
        try {
          const changed = await runTransaction(db, async (tx) => {
            const refs = targets.map(s => doc(db, "professionals", activeProfId, "availableSlots", s.id));
            const snaps = await Promise.all(refs.map(r => tx.get(r)));
            let count = 0;
            snaps.forEach((snap, i) => {
              if (!snap.exists()) return;
              const cur = snap.data();
              if (block ? cur.disponivel !== true : !(cur.disponivel === false && cur.bloqueadoManual === true)) return;
              tx.update(refs[i], { disponivel: !block, bloqueadoManual: block, updatedAt: new Date() });
              count++;
            });
            return count;
          });
          setSuccess(block ? `${changed} horário(s) de ${formatDate(dateStr)} bloqueado(s).` : `${changed} horário(s) de ${formatDate(dateStr)} liberado(s).`);
        } catch (err) {
          console.error("Error toggling day:", err);
          setError(block ? "Erro ao bloquear o dia." : "Erro ao liberar o dia.");
        } finally {
          setSlotActionId(null);
        }
      },
    });
  };

  // Aviso no topo quando o Google Agenda precisa ser reconectado (o cartão de integração fica no fim da página)
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "professionals", user.uid, "integrations", "google");
    const unsub = onSnapshot(ref, (snap) => {
      setGoogleNeedsReconnect(snap.exists() && snap.data()?.needsReconnect === true && snap.data()?.connected !== true);
    }, () => setGoogleNeedsReconnect(false));
    return () => unsub();
  }, [user]);

  // Move um agendamento para um horário livre do dia. O servidor valida conflito, cobertura e passado.
  const handleMoveLeadTo = (lead: any, slot: AvailableSlot) => {
    setMovingLead(null);
    setDragLeadId(null);
    if (!user) return;
    if (lead.dataEscolhida === slot.data && (lead.horarioInicio || lead.horarioEscolhido) === slot.horario) return;
    const duration = getLeadDurationInMinutes(lead, services, slotDuration);
    const fim = addMinutesToTime(slot.horario, duration);
    showConfirmationModal({
      title: "Mover agendamento",
      description: `Mover ${lead.nome} de ${lead.horarioEscolhido} para ${slot.horario} em ${formatDate(slot.data)}? Os horários serão atualizados e o antigo ficará livre.`,
      confirmLabel: "Mover",
      cancelLabel: "Voltar",
      onConfirm: async () => {
        try {
          const token = await user.getIdToken();
          const res = await fetch(`/api/professionals/${activeProfId}/leads/${lead.id}/reschedule`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ dataEscolhida: slot.data, horarioEscolhido: slot.horario, horarioFim: fim }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "Não foi possível mover o agendamento.");
          }
          setSuccess("Agendamento movido com sucesso!");
        } catch (e: any) {
          setError(e.message || "Não foi possível mover o agendamento.");
        }
      },
    });
  };

  const handleDeleteSlot = (slotId: string) => {
    if (!user) return;
    showConfirmationModal({
      title: "Excluir horário",
      description: "Deseja excluir este horário da agenda?",
      confirmLabel: "Excluir",
      cancelLabel: "Cancelar",
      variant: "danger",
      onConfirm: async () => {
        const docRef = doc(db, "professionals", activeProfId, "availableSlots", slotId);
        await deleteDoc(docRef);
      },
    });
  };

  const handleDeleteDateSlots = (dateStr: string) => {
    if (!user) return;
    showConfirmationModal({
      title: "Excluir todos os horários",
      description: `Deseja excluir TODOS os horários disponíveis de ${formatDate(dateStr)}? Horários ocupados não serão afetados.`,
      confirmLabel: "Excluir todos",
      cancelLabel: "Cancelar",
      variant: "danger",
      onConfirm: async () => {
        setActionLoading(true);
        try {
          const dateSlots = groupedSlots[dateStr];
          for (const slot of dateSlots) {
            if (slot.disponivel) {
              const docRef = doc(db, "professionals", activeProfId, "availableSlots", slot.id);
              await deleteDoc(docRef);
            }
          }
          setSuccess(`Os horários livres de ${formatDate(dateStr)} foram excluídos. Horários já reservados foram preservados.`);
        } catch (err: any) {
          console.error(err);
          setError("Erro ao excluir horários do dia.");
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  // --- MANUAL BOOKING HANDLERS ---
  const handleServiceSelect = (serviceId: string) => {
    setBookingServicoId(serviceId);
    const service = services.find(s => s.id === serviceId);
    if (service) {
      const { option, customVal } = parseServiceDuration(service.duracaoEstimada);
      setBookingDuracaoOption(option);
      setBookingDuracaoCustom(customVal);
    }
  };

  // Reflete o agendamento no Google Agenda (servidor decide: provisório, confirmado ou removido)
  const syncLeadToCalendar = async (leadId: string) => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      await fetch(`/api/professionals/${activeProfId}/leads/${leadId}/calendar-sync`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.warn("Falha ao sincronizar com o Google Agenda:", err);
    }
  };

  const handleCreateManualBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBookingError("");

    // Form validation
    const trimmedNome = bookingNome.trim();
    if (trimmedNome.length < 2 || trimmedNome.length > 80) {
      setBookingError("O nome do cliente deve conter entre 2 e 80 caracteres.");
      return;
    }

    const formattedPhone = bookingTelefone.replace(/\D/g, "");
    if (formattedPhone.length < 10 || formattedPhone.length > 20) {
      setBookingError("O telefone deve ter entre 10 e 20 dígitos (incluindo o DDD).");
      return;
    }

    if (!bookingServicoId) {
      setBookingError("Por favor, selecione um serviço.");
      return;
    }

    if (!bookingData || !bookingHorario) {
      setBookingError("Por favor, selecione data e horário.");
      return;
    }

    // Determine final duration
    let duration = 30;
    if (bookingDuracaoOption === "custom") {
      duration = parseInt(bookingDuracaoCustom, 10);
      if (isNaN(duration) || duration <= 0) {
        setBookingError("Por favor, informe uma duração personalizada válida em minutos.");
        return;
      }
    } else {
      duration = parseInt(bookingDuracaoOption, 10);
    }

    const startMinutes = timeToMinutes(bookingHorario);
    const endMinutes = startMinutes + duration;

    // Check conflict: active leads overlapping
    const conflictsWithLeads = leads.some(l => {
      if (l.status === "Perdido" || l.status === "Cancelado") return false;
      if (l.dataEscolhida !== bookingData) return false;
      const existStart = timeToMinutes(l.horarioInicio || l.horarioEscolhido);
      const existDur = getLeadDurationInMinutes(l, services, slotDuration);
      const existEnd = existStart + existDur;
      // Overlap condition: start1 < end2 && start2 < end1
      return startMinutes < existEnd && existStart < endMinutes;
    });

    // Check conflict: unavailable slots overlapping
    const conflictsWithBlockedSlots = slots.some(s => 
      s.data === bookingData &&
      !s.disponivel &&
      timeToMinutes(s.horario) >= startMinutes &&
      timeToMinutes(s.horario) < endMinutes
    );

    if (conflictsWithLeads || conflictsWithBlockedSlots) {
      setBookingError("Este período entra em conflito com outro agendamento já existente.");
      return;
    }

    setActionLoading(true);

    try {
      const token = await user.getIdToken();
      const service = services.find(s => s.id === bookingServicoId);
      const res = await fetch(`/api/professionals/${activeProfId}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nome: trimmedNome,
          telefone: formattedPhone,
          serviceId: bookingServicoId,
          servicoEscolhido: service?.nome || "",
          dataEscolhida: bookingData,
          horarioEscolhido: bookingHorario,
          observacao: bookingObservacao.trim(),
          origem: bookingOrigem,
          duracaoServicoPadrao: service?.duracaoEstimada || "",
          duracaoAgendamento: duration,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erro ao salvar agendamento.");
      }

      // Já entra no preenchimento automático, sem precisar recarregar a tela
      setCustomerList(prev => prev.some(c => c.telefone === formattedPhone) ? prev : [...prev, { nome: trimmedNome, telefone: formattedPhone }]);
      setSuccess("Agendamento manual cadastrado com sucesso!");
      setShowBookingModal(false);
    } catch (err: any) {
      console.error(err);
      setBookingError("Erro ao salvar agendamento: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // --- EDIT BOOKING HANDLERS ---
  const handleOpenEditModal = async (lead: any) => {
    setEditingLead(lead);
    // Carregar IDs dos slots deste agendamento do índice privado (SEC-005)
    try {
      const sbSnap = await getDoc(doc(db, "professionals", activeProfId, "slotBookings", lead.id));
      setEditingLeadSlotIds(new Set(sbSnap.exists() ? (sbSnap.data()?.slotIds ?? []) : []));
    } catch { setEditingLeadSlotIds(new Set()); }
    setEditNome(lead.nome || "");
    setEditTelefone(lead.telefone || "");
    setEditObservacao(lead.observacao || "");
    setEditServicoId(lead.serviceId || "");
    setEditData(lead.dataEscolhida || "");
    setEditHorario(lead.horarioEscolhido || "");
    setEditOrigem(lead.origem || "whatsapp");
    setEditStatus(lead.status || "Agendado");
    
    // Parse duration
    const leadDur = lead.duracaoAgendamento || 30;
    const { option, customVal } = parseServiceDuration(`${leadDur} minutos`);
    setEditDuracaoOption(option);
    setEditDuracaoCustom(customVal);
    setEditError("");
    setShowEditModal(true);
  };

  const handleEditServiceSelect = (serviceId: string) => {
    setEditServicoId(serviceId);
    const service = services.find(s => s.id === serviceId);
    if (service) {
      const { option, customVal } = parseServiceDuration(service.duracaoEstimada);
      setEditDuracaoOption(option);
      setEditDuracaoCustom(customVal);
    }
  };

  const handleSaveEditBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingLead) return;
    setEditError("");

    // Form validation
    const trimmedNome = editNome.trim();
    if (trimmedNome.length < 2 || trimmedNome.length > 80) {
      setEditError("O nome deve ter entre 2 e 80 caracteres.");
      return;
    }

    const formattedPhone = editTelefone.replace(/\D/g, "");
    if (formattedPhone.length < 10 || formattedPhone.length > 20) {
      setEditError("O telefone deve ter entre 10 e 20 dígitos (incluindo o DDD).");
      return;
    }

    let duration = 30;
    if (editDuracaoOption === "custom") {
      duration = parseInt(editDuracaoCustom, 10);
      if (isNaN(duration) || duration <= 0) {
        setEditError("Duração personalizada inválida.");
        return;
      }
    } else {
      duration = parseInt(editDuracaoOption, 10);
    }

    const newStart = timeToMinutes(editHorario);
    const newEnd = newStart + duration;
    const newHorarioFim = minutesToTime(newEnd);

    setActionLoading(true);

    try {
      const token = await user.getIdToken();
      const service = services.find(s => s.id === editServicoId);
      const res = await fetch(`/api/professionals/${activeProfId}/leads/${editingLead.id}/edit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nome: trimmedNome,
          telefone: formattedPhone,
          serviceId: editServicoId,
          servicoEscolhido: service?.nome || "",
          dataEscolhida: editData,
          horarioEscolhido: editHorario,
          origem: editOrigem,
          status: editStatus,
          duracaoAgendamento: duration,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erro ao salvar alterações.");
      }

      setSuccess("Agendamento atualizado com sucesso!");
      setShowEditModal(false);
    } catch (err: any) {
      console.error(err);
      setEditError(err.message || "Erro ao salvar alterações.");
    } finally {
      setActionLoading(false);
    }
  };

  // --- CALENDAR COLOR HANDLERS ---
  const handleColorEditorChange = (key: string, val: string) => {
    setColorEditor(prev => ({
      ...prev,
      [key]: val
    }));
  };

  const handleSaveColors = async () => {
    if (!user) return;
    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      const profRef = doc(db, "professionals", user.uid);
      await updateDoc(profRef, {
        calendarColorConfig: colorEditor,
        updatedAt: new Date()
      });
      await refreshProfile();
      setSuccess("Cores da agenda salvas com sucesso!");
    } catch (err: any) {
      console.error(err);
      setError("Erro ao salvar cores: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestoreDefaultColors = () => {
    setColorEditor(defaultCalendarColors);
  };

  // --- CALENDAR VIEW UTILITIES ---
  const shiftMonth = (refDateStr: string, months: number): string => {
    if (!refDateStr) return "";
    const [year, month] = refDateStr.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1 + months, 15, 12, 0, 0));
    return dateToSaoPauloKey(date);
  };

  const getMonthGrid = (refDateStr: string) => {
    if (!refDateStr) return [];
    const [year, month] = refDateStr.split("-").map(Number);
    const firstDayDate = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
    const firstDayOfWeek = firstDayDate.getUTCDay(); // Sunday=0, ..., Saturday=6
    
    const startDate = new Date(firstDayDate);
    startDate.setUTCDate(startDate.getUTCDate() - firstDayOfWeek);
    
    const grid: string[] = [];
    const tempDate = new Date(startDate);
    for (let i = 0; i < 42; i++) {
      grid.push(dateToSaoPauloKey(tempDate));
      tempDate.setUTCDate(tempDate.getUTCDate() + 1);
    }
    return grid;
  };

  // --- CALENDAR VIEWS RENDERERS ---
  const renderCustomerSuggestions = (q: string, field: (c: { nome: string; telefone: string }) => string) => {
    if (q.length < 2) return null;
    const matches = customerSuggestions.filter(c => field(c).includes(q)).slice(0, 5);
    if (matches.length === 0) return null;
    return (
      <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-slate-950 border border-slate-700 rounded-xl overflow-hidden shadow-xl">
        {matches.map(c => (
          <button
            key={c.telefone}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setBookingNome(c.nome);
              setBookingTelefone(formatPhoneFriendly(c.telefone));
              setCustomerSuggestField(null);
            }}
            className="w-full text-left px-3 py-2 hover:bg-slate-800 border-b border-slate-800 last:border-0"
          >
            <span className="block text-xs font-bold text-slate-100">{c.nome}</span>
            <span className="block text-[10px] text-slate-400 font-mono">{formatPhoneFriendly(c.telefone)}</span>
          </button>
        ))}
      </div>
    );
  };

  // Mês estilo Google Agenda: cada dia mostra só os agendamentos (nome do cliente, na cor do status),
  // sem contagem de horários livres/ocupados/cancelados. A grade ocupa a altura da tela.
  const renderMonthView = () => {
    if (!calendarRefDate) return null;
    const grid = getMonthGrid(calendarRefDate);
    const currentMonthNum = calendarRefDate.split("-")[1];
    const weekLabels = ["D", "S", "T", "Q", "Q", "S", "S"];
    const today = getSaoPauloToday();
    const MAX_CHIPS = 3;

    type Lead = (typeof leads)[number];
    const leadsByDate = new Map<string, Lead[]>();
    leads.forEach(l => {
      if (!l.dataEscolhida || l.status === "Cancelado" || l.status === "Perdido") return;
      const list = leadsByDate.get(l.dataEscolhida) ?? [];
      list.push(l);
      leadsByDate.set(l.dataEscolhida, list);
    });
    const startOf = (l: Lead): string => l.horarioInicio || l.horarioEscolhido || "";

    return (
      <div>
        <div className="grid grid-cols-7 border-b border-slate-800 text-center text-[11px] font-bold text-slate-500 py-1.5">
          {weekLabels.map((l, i) => <div key={i}>{l}</div>)}
        </div>

        <div className="grid grid-cols-7">
          {grid.map((dateStr, i) => {
            const isCurrentMonth = dateStr.split("-")[1] === currentMonthNum;
            const isToday = dateStr === today;
            const dayLeads = [...(leadsByDate.get(dateStr) ?? [])].sort((a, b) => startOf(a).localeCompare(startOf(b)));
            const shown = dayLeads.length > MAX_CHIPS ? dayLeads.slice(0, MAX_CHIPS - 1) : dayLeads;
            const hidden = dayLeads.length - shown.length;

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => {
                  setCalendarRefDate(dateStr);
                  setCalendarView("day");
                }}
                className={`flex flex-col items-stretch gap-0.5 px-0.5 pt-1 pb-1 text-left border-slate-800 ${i % 7 !== 6 ? "border-r" : ""} border-b hover:bg-slate-800/50 transition-colors`}
                style={{ minHeight: "max(88px, calc((100svh - 230px) / 6))" }}
              >
                <span
                  className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    isToday ? "bg-indigo-600 text-white" : isCurrentMonth ? "text-slate-200" : "text-slate-500 opacity-60"
                  }`}
                >
                  {parseInt(dateStr.split("-")[2], 10)}
                </span>
                {shown.map(l => {
                  const style = getCalendarStatusStyle(l.status, calendarColors);
                  return (
                    <span
                      key={l.id}
                      className={`block truncate rounded px-1 py-px text-[10px] font-semibold leading-tight ${isCurrentMonth ? "" : "opacity-60"}`}
                      style={{ backgroundColor: style.bg, color: style.text }}
                      title={`${startOf(l)} ${l.nome}`}
                    >
                      <span className="hidden md:inline font-mono mr-1 opacity-80">{startOf(l)}</span>
                      {l.nome || "Cliente"}
                    </span>
                  );
                })}
                {hidden > 0 && <span className="px-1 text-[10px] font-bold text-slate-400">+{hidden}</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // Monta um dia da grade estilo Google Agenda: agendamentos como blocos pela duração real
  // e os horários cadastrados que não estão cobertos por um agendamento (livre, bloqueado, expirado).
  const buildGridDay = (dateStr: string, short: boolean): TimeGridDay => {
    const today = getSaoPauloToday();
    const [y, m, d] = dateStr.split("-").map(Number);
    const dayOfWeek = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay();
    const weekdayFull = weekdayLabels[weekdayKeys[dayOfWeek]] || "";
    const isPast = dateStr < today;
    const step = slotDuration > 0 ? slotDuration : 30;

    const leadRanges = leads
      .filter(l => l.dataEscolhida === dateStr && l.status !== "Perdido" && l.status !== "Cancelado" && (l.horarioInicio || l.horarioEscolhido))
      .map(l => {
        const start = timeToMinutes(l.horarioInicio || l.horarioEscolhido);
        return { lead: l, start, end: start + Math.max(getLeadDurationInMinutes(l, services, slotDuration), 15) };
      });

    const events: TimeGridEvent[] = leadRanges.map(({ lead, start, end }) => {
      const style = getCalendarStatusStyle(lead.status, calendarColors);
      return {
        id: `lead-${lead.id}`,
        start,
        end,
        kind: "lead",
        title: lead.nome || "Cliente",
        subtitle: lead.servicoEscolhido,
        color: style.bg,
        textColor: style.text,
        dimmed: dragLeadId === lead.id || movingLead?.id === lead.id,
        onClick: () => setGridSelection({ type: "lead", id: lead.id }),
        draggable: ["Novo", "Em contato", "Agendado"].includes(lead.status),
        onDragStart: (e) => { e.dataTransfer.setData("text/plain", lead.id); setDragLeadId(lead.id); },
        onDragEnd: () => setDragLeadId(null),
      };
    });

    const daySlots = [...(slotsByDate.get(dateStr) || [])].sort((a, b) => timeToMinutes(a.horario) - timeToMinutes(b.horario));
    daySlots.forEach(slot => {
      const start = timeToMinutes(slot.horario);
      if (leadRanges.some(r => start >= r.start && start < r.end)) return; // coberto pelo bloco do agendamento
      const end = start + step;

      if (!slot.disponivel) {
        const style = getCalendarStatusStyle("Bloqueado", calendarColors);
        events.push({
          id: `slot-${slot.id}`,
          start,
          end,
          kind: "blocked",
          title: slot.bloqueadoManual ? "Bloqueado" : "Indisponível",
          color: style.bg,
          onClick: () => setGridSelection({ type: "slot", id: slot.id }),
        });
        return;
      }

      if (isPastDateTimeSaoPaulo(dateStr, slot.horario)) {
        events.push({ id: `slot-${slot.id}`, start, end, kind: "expired", title: "Expirado", color: "#6B7280" });
        return;
      }

      const style = getCalendarStatusStyle("Disponível", calendarColors);
      events.push({
        id: `slot-${slot.id}`,
        start,
        end,
        kind: "free",
        title: style.label,
        color: style.bg,
        highlight: !!movingLead || !!dragLeadId,
        onClick: () => {
          if (movingLead) handleMoveLeadTo(movingLead, slot);
          else setGridSelection({ type: "slot", id: slot.id });
        },
        acceptsDrop: !!dragLeadId,
        onDrop: (e) => {
          e.preventDefault();
          const dragged = leads.find((l) => l.id === (dragLeadId || e.dataTransfer.getData("text/plain")));
          if (dragged) handleMoveLeadTo(dragged, slot);
        },
      });
    });

    const cancelledCount = leads.filter(l => l.status === "Cancelado" && l.dataEscolhida === dateStr).length;

    return {
      dateStr,
      weekdayLabel: short ? weekdayFull.slice(0, 3) : weekdayFull.split("-")[0],
      dayNumber: String(d),
      isToday: dateStr === today,
      isPast,
      badge: short && !isPast && cancelledCount > 0 ? `${cancelledCount} canc.` : undefined,
      onHeaderClick: short ? () => { setCalendarRefDate(dateStr); setCalendarView("day"); } : undefined,
      events,
    };
  };

  // Duplicar (como no Google Agenda): abre um novo agendamento com cliente, serviço, duração e observação copiados.
  // A data vem preenchida com a do original; o horário fica em branco para escolher o novo.
  const handleDuplicateLead = (lead: (typeof leads)[number]) => {
    const dur = parseServiceDuration(`${getLeadDurationInMinutes(lead, services, slotDuration)} minutos`);
    bookingPrefillRef.current = {
      data: lead.dataEscolhida || "",
      horario: "",
      nome: lead.nome || "",
      telefone: String(lead.telefone || "").replace(/\D/g, ""),
      servicoId: services.some(s => s.id === lead.serviceId) ? lead.serviceId : "",
      duracaoOption: dur.option,
      duracaoCustom: dur.customVal,
      observacao: lead.observacao || "",
      origem: lead.origem || "whatsapp",
    };
    setGridSelection(null);
    setShowBookingModal(true);
  };

  // Título curto da barra do calendário no celular: "Nov 2026", "01–07/11" ou "Qua, 04/11".
  const formatCalendarTitleShort = () => {
    if (!calendarRefDate) return "";
    const [y, m, d] = calendarRefDate.split("-").map(Number);
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    if (calendarView === "month") return `${months[m - 1]} ${y}`;
    if (calendarView === "week") {
      const start = getStartOfWeekSaoPaulo(calendarRefDate);
      const end = addDaysSaoPaulo(start, 6);
      return `${start.slice(8, 10)}/${start.slice(5, 7)}–${end.slice(8, 10)}/${end.slice(5, 7)}`;
    }
    const weekday = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()];
    return `${weekday}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
  };

  // Avança (1) ou volta (-1) um mês, semana ou dia, conforme a visão atual. Períodos passados também
  // podem ser consultados (histórico de atendimentos).
  const shiftCalendar = (dir: 1 | -1, fromSwipe = false) => {
    setSwipeDir(fromSwipe ? dir : 0);
    if (calendarView === "month") {
      setCalendarRefDate(prev => shiftMonth(prev, dir));
    } else if (calendarView === "week") {
      setCalendarRefDate(prev => addDaysSaoPaulo(prev, 7 * dir));
    } else {
      setCalendarRefDate(prev => addDaysSaoPaulo(prev, dir));
    }
  };

  // Deslizar o dedo para o lado no calendário troca de período, como no Google Agenda.
  // Toques com dois dedos (pinça) e toques com o painel de detalhes aberto não contam.
  const handleCalendarTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1 || gridSelection) {
      swipeStartRef.current = null;
      return;
    }
    swipeStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
  };
  const handleCalendarTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 1) swipeStartRef.current = null;
  };
  const handleCalendarTouchEnd = (e: React.TouchEvent) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start || e.changedTouches.length === 0) return;
    const touch = e.changedTouches[0];
    const result = detectSwipe(touch.clientX - start.x, touch.clientY - start.y, Date.now() - start.t);
    if (result) shiftCalendar(result === "next" ? 1 : -1, true);
  };

  const renderMovingBanner = () =>
    movingLead && (
      <div className="sticky top-2 z-30 flex items-center justify-between gap-3 rounded-2xl border border-indigo-500/40 bg-indigo-950/90 px-4 py-3 text-xs text-indigo-100 backdrop-blur">
        <span>Toque em um <strong>horário livre</strong> para mover <strong>{movingLead.nome}</strong>.</span>
        <button type="button" onClick={() => setMovingLead(null)} className="shrink-0 rounded-lg border border-indigo-400/40 px-3 py-1.5 font-semibold">Cancelar</button>
      </div>
    );

  // Painel no meio da tela com os detalhes e ações do bloco tocado na grade.
  const renderGridSelectionSheet = () => {
    if (!gridSelection) return null;
    const close = () => setGridSelection(null);
    let content: React.ReactNode = null;

    if (gridSelection.type === "lead") {
      const lead = leads.find(l => l.id === gridSelection.id);
      if (!lead || lead.status === "Cancelado" || lead.status === "Perdido") return null;
      const style = getCalendarStatusStyle(lead.status, calendarColors);
      const start = lead.horarioInicio || lead.horarioEscolhido;
      const dur = getLeadDurationInMinutes(lead, services, slotDuration);
      content = (
        <>
          <div className="flex items-start gap-3">
            <span className="mt-1 h-3.5 w-3.5 shrink-0 rounded" style={{ backgroundColor: style.bg }} />
            <div className="min-w-0">
              <div className="text-base font-black text-slate-100 truncate">{lead.nome}</div>
              <div className="text-xs text-slate-400 mt-0.5">
                {formatDateFriendly(lead.dataEscolhida)} · {start} – {addMinutesToTime(start, dur)}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-black tracking-wider" style={{ backgroundColor: style.bg + "20", color: style.bg }}>{lead.status}</span>
                {lead.servicoEscolhido && <span className="text-[11px] text-slate-400 font-semibold">{lead.servicoEscolhido} ({dur} min)</span>}
              </div>
              {lead.telefone && <div className="text-xs text-slate-400 font-mono mt-1">Tel: {lead.telefone}</div>}
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => { close(); handleOpenEditModal(lead); }}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs"
            >
              Abrir agendamento
            </button>
            <button
              type="button"
              onClick={() => handleDuplicateLead(lead)}
              className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" />
              Duplicar
            </button>
          </div>
          <LeadCardActions
            lead={lead}
            profId={activeProfId}
            moving={movingLead?.id === lead.id}
            onReschedule={(l) => { close(); handleOpenEditModal(l); }}
            onMove={(l) => { close(); setMovingLead((prev: any) => (prev?.id === l.id ? null : l)); }}
            onError={(m) => setError(m)}
          />
        </>
      );
    } else {
      const slot = slots.find(s => s.id === gridSelection.id);
      if (!slot) return null;
      const range = `${slot.horario} – ${addMinutesToTime(slot.horario, slotDuration > 0 ? slotDuration : 30)}`;
      const busy = slotActionId === slot.id;
      content = (
        <>
          <div className="text-base font-black text-slate-100">
            {slot.disponivel ? "Horário livre" : slot.bloqueadoManual ? "Horário bloqueado" : "Horário indisponível"}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">{formatDateFriendly(slot.data)} · {range}</div>
          {slot.disponivel ? (
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  bookingPrefillRef.current = { data: slot.data, horario: slot.horario };
                  close();
                  setShowBookingModal(true);
                }}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs"
              >
                Agendar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => { await handleToggleSlot(slot, true); close(); }}
                className="flex-1 py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 font-bold text-xs disabled:opacity-50"
              >
                {busy ? "Bloqueando..." : "Bloquear horário"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={async () => { await handleToggleSlot(slot, false); close(); }}
              className="mt-4 w-full py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-xs disabled:opacity-50"
            >
              {busy ? "Salvando..." : slot.bloqueadoManual ? "Reativar horário" : "Liberar horário"}
            </button>
          )}
        </>
      );
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
        <button type="button" aria-label="Fechar" onClick={close} className="absolute inset-0 bg-black/40" />
        <div className="relative w-full max-w-md max-h-[80vh] overflow-y-auto rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-2xl animate-fade-in">
          <button type="button" aria-label="Fechar" onClick={close} className="absolute right-3 top-3 p-1.5 rounded-lg text-slate-400 hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
          {content}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    if (!calendarRefDate) return null;
    const startStr = getStartOfWeekSaoPaulo(calendarRefDate);
    const weekDays: TimeGridDay[] = [];
    for (let i = 0; i < 7; i++) {
      weekDays.push(buildGridDay(addDaysSaoPaulo(startStr, i), true));
    }

    return (
      <div>
        {renderMovingBanner()}
        <TimeGridCalendar days={weekDays} scrollKey={`week-${startStr}`} />
      </div>
    );
  };

  const renderDayView = () => {
    if (!calendarRefDate) return null;
    const dateStr = calendarRefDate;
    const dayCancelledLeads = leads.filter(l => l.status === "Cancelado" && l.dataEscolhida === dateStr);
    const daySlots = slotsByDate.get(dateStr) || [];
    const freeToBlock = daySlots.filter(s => s.disponivel && !isPastDateTimeSaoPaulo(dateStr, s.horario)).length;
    const manuallyBlocked = daySlots.filter(s => !s.disponivel && s.bloqueadoManual).length;
    const dayBusy = slotActionId === `day-${dateStr}`;

    // A data do dia já aparece na barra do calendário, acima da grade
    return (
      <div>
        {renderMovingBanner()}
        {(freeToBlock > 0 || manuallyBlocked > 0) && (
          <div className="flex flex-wrap items-center justify-end gap-2 px-3 py-2 border-b border-slate-800">
            {manuallyBlocked > 0 && (
              <button
                type="button"
                disabled={dayBusy}
                onClick={() => handleToggleWholeDay(dateStr, false)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-emerald-500/40 text-emerald-500 text-[11px] font-bold disabled:opacity-50"
              >
                <Unlock className="h-3.5 w-3.5" />
                Liberar dia ({manuallyBlocked})
              </button>
            )}
            {freeToBlock > 0 && (
              <button
                type="button"
                disabled={dayBusy}
                onClick={() => handleToggleWholeDay(dateStr, true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-rose-500/40 text-rose-500 text-[11px] font-bold disabled:opacity-50"
              >
                <Lock className="h-3.5 w-3.5" />
                {dayBusy ? "Salvando..." : `Bloquear dia todo (${freeToBlock})`}
              </button>
            )}
          </div>
        )}
        <TimeGridCalendar days={[buildGridDay(dateStr, false)]} scrollKey={`day-${dateStr}`} />
        {dayCancelledLeads.length > 0 && (
          <div className="p-3">
            <CollapsibleCancelledHistory leadsList={dayCancelledLeads} />
          </div>
        )}
      </div>
    );
  };

  // --- FORMATTERS ---
  const formatDateFriendly = (dateStr: string) => {
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

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  // Compute filtered dates for agenda view
  const filteredGroupedDates = Object.keys(groupedSlots)
    .filter(dateStr => {
      if (!agendaDateFilter) return true;
      return dateStr === agendaDateFilter;
    })
    .sort();

  const upcomingSlots = slots.filter(s => s.disponivel).slice(0, 6);

  // O calendário só é redesenhado quando os dados dele mudam, não a cada letra digitada nos formulários desta página
  const calendarBody = React.useMemo(() => (
    <>
      {calendarView === "month" && renderMonthView()}
      {calendarView === "week" && renderWeekView()}
      {calendarView === "day" && renderDayView()}
    </>
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [calendarView, calendarRefDate, leads, slotsByDate, services, slotDuration, calendarColors, movingLead, dragLeadId, slotActionId, activeProfId]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* A tela fica só com as abas e o calendário; resumo e Google Agenda estão em "Resumo da Agenda" (/dashboard/resumo) */}

      {/* Seletor de profissional — visível apenas quando há equipe */}
      {teamMembers.length > 0 && activeProfId && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveProfId(user!.uid)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${activeProfId === user?.uid ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"}`}
          >
            <Building2 className="h-4 w-4" />
            <span>Estabelecimento</span>
          </button>
          {teamMembers.map((m) => (
            <button
              key={m.id}
              onClick={() => setActiveProfId(m.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${activeProfId === m.id ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-lg shadow-amber-500/10" : "border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"}`}
            >
              <User className="h-4 w-4" />
              <span>{m.nome}</span>
              {m.especialidade && <span className="text-xs opacity-70">· {m.especialidade}</span>}
            </button>
          ))}
        </div>
      )}

      {googleNeedsReconnect && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
          <span>O Google Agenda foi desconectado e precisa ser reconectado.</span>
          <Link
            href="/dashboard/resumo"
            className="shrink-0 rounded-lg border border-amber-400/40 px-3 py-1.5 font-semibold"
          >
            Reconectar
          </Link>
        </div>
      )}

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

      {/* CALENDÁRIO (sempre no topo, ocupando a largura da tela no celular, como no Google Agenda).
          As abas Agenda Atual / Gerador / Horário Avulso e o Novo Agendamento ficam abaixo. */}
      <div className="-mx-4 md:mx-0 bg-slate-900 md:rounded-3xl border-y md:border border-slate-800 overflow-hidden">
        {/* Barra do calendário: período, setas, Hoje e visão */}
        <div className="flex items-center gap-1 px-2 py-2 border-b border-slate-800">
          <button
            type="button"
            aria-label="Anterior"
            onClick={() => shiftCalendar(-1)}
            className="p-1.5 rounded-full text-slate-400 hover:bg-slate-800 hover:text-slate-200 shrink-0"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          {/* Formato curto no celular para caber na mesma faixa (ex.: "Qua, 04/11"); completo no computador */}
          <span className="flex-1 min-w-0 text-center font-extrabold text-sm md:text-lg text-slate-100 whitespace-nowrap">
            <span className="md:hidden">{formatCalendarTitleShort()}</span>
            <span className="hidden md:inline capitalize">
              {calendarView === "month" && getMonthNameSaoPaulo(calendarRefDate)}
              {calendarView === "week" && `${formatDate(getStartOfWeekSaoPaulo(calendarRefDate)).slice(0, 5)} – ${formatDate(addDaysSaoPaulo(getStartOfWeekSaoPaulo(calendarRefDate), 6)).slice(0, 5)}`}
              {calendarView === "day" && formatDateFriendly(calendarRefDate)}
            </span>
          </span>
          <button
            type="button"
            aria-label="Próximo"
            onClick={() => shiftCalendar(1)}
            className="p-1.5 rounded-full text-slate-400 hover:bg-slate-800 hover:text-slate-200 shrink-0"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setCalendarRefDate(getSaoPauloToday())}
            className="px-2.5 py-1.5 rounded-full border border-slate-800 text-slate-300 text-[11px] font-bold hover:bg-slate-800 shrink-0"
          >
            Hoje
          </button>
          <div className="flex rounded-full border border-slate-800 p-0.5 shrink-0">
            {([["month", "Mês"], ["week", "Sem."], ["day", "Dia"]] as const).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setCalendarView(v)}
                className={`px-2 py-1 rounded-full text-[11px] font-bold ${calendarView === v ? "bg-indigo-600 text-white" : "text-slate-400"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col justify-center items-center py-16">
            <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
            <p className="mt-4 text-slate-400 font-medium">Buscando agenda...</p>
          </div>
        ) : (
          <div
            key={`${calendarView}-${calendarRefDate}`}
            className={swipeDir === 1 ? "animate-slide-from-right" : swipeDir === -1 ? "animate-slide-from-left" : "animate-calendar-in"}
            onTouchStart={handleCalendarTouchStart}
            onTouchMove={handleCalendarTouchMove}
            onTouchEnd={handleCalendarTouchEnd}
          >
            {calendarBody}
          </div>
        )}
      </div>

      {/* Painel do horário/agendamento tocado: fora do cartão do calendário para ficar centralizado na tela */}
      {renderGridSelectionSheet()}

      {/* Novo agendamento: botão flutuante "+", como no Google Agenda */}
      <button
        type="button"
        aria-label="Novo agendamento"
        onClick={() => setShowBookingModal(true)}
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-500/30 flex items-center justify-center active:scale-95 transition-transform"
      >
        <Plus className="h-7 w-7" />
      </button>

      {/* Navigation Tabs (Top-level full-width navigation) */}
      <div className="flex bg-slate-900 border border-slate-800 p-1.5 rounded-2xl max-w-xl">
        <button
          onClick={() => {
            setActiveTab("agenda");
            setError("");
            setSuccess("");
          }}
          className={`
            flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs md:text-sm font-bold transition-all
            ${activeTab === "agenda" 
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25" 
              : "text-slate-400 hover:text-slate-200"
            }
          `}
        >
          <CalendarIcon className="h-4.5 w-4.5" />
          <span>Agenda Atual</span>
        </button>
        <button
          onClick={() => {
            setActiveTab("smart");
            setError("");
            setSuccess("");
          }}
          className={`
            flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs md:text-sm font-bold transition-all
            ${activeTab === "smart" 
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25" 
              : "text-slate-400 hover:text-slate-200"
            }
          `}
        >
          <Sparkles className="h-4.5 w-4.5" />
          <span>Gerador Automático</span>
        </button>
        <button
          onClick={() => {
            setActiveTab("manual");
            setError("");
            setSuccess("");
          }}
          className={`
            flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs md:text-sm font-bold transition-all
            ${activeTab === "manual" 
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25" 
              : "text-slate-400 hover:text-slate-200"
            }
          `}
        >
          <Sliders className="h-4.5 w-4.5" />
          <span>Horário Avulso</span>
        </button>
      </div>

      {/* TAB 1: SMART GENERATOR FORM (Full-width responsive layout) */}
      {activeTab === "smart" && (
        <div className="space-y-8 animate-fade-in">
          
          {/* Subsection: Configurações Gerais da Agenda */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 backdrop-blur-sm space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Configurações Gerais da Agenda</h2>
              <p className="text-xs text-slate-400">Defina os parâmetros globais de funcionamento e exibição para os seus clientes.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Slot Duration */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-350 uppercase tracking-wider">Duração de cada Atendimento</label>
                <select
                  value={durationOptions.find(o => o.value === slotDuration) ? slotDuration : 0}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (v === 0) { setSlotDurationCustom(""); }
                    else { setSlotDuration(v); setSlotDurationCustom(""); }
                  }}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500 font-semibold"
                >
                  {durationOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {(slotDuration === 0 || !durationOptions.find(o => o.value === slotDuration && o.value !== 0)) && (
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      min={5} max={600} step={5}
                      placeholder="Minutos (ex: 110)"
                      value={slotDurationCustom}
                      onChange={(e) => {
                        setSlotDurationCustom(e.target.value);
                        const v = parseInt(e.target.value, 10);
                        if (!isNaN(v) && v > 0) setSlotDuration(v);
                      }}
                      className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
                    />
                    <span className="text-xs text-slate-500 shrink-0">min</span>
                  </div>
                )}
              </div>

              {/* Generation Period */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-350 uppercase tracking-wider">Período de Geração de Slots</label>
                <select
                  value={periodDays}
                  onChange={(e) => setPeriodDays(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500 font-semibold font-mono"
                >
                  {periodOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Public Visibility Window */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-350 uppercase tracking-wider">Janela de Exibição Pública (Clientes)</label>
                <select
                  value={windowDays}
                  onChange={(e) => setWindowDays(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500 font-semibold font-mono"
                >
                  {windowDaysOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Subsection: Rotina de Funcionamento Semanal */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Rotina de Funcionamento Semanal</h2>
                <p className="text-xs text-slate-400">Configure quais dias da semana você atende e os horários de expediente e almoço.</p>
              </div>
              {/* Aplicar horário do primeiro dia ativo para todos */}
              <button
                type="button"
                onClick={() => {
                  const firstActive = uiDisplayDays.find(k => agendaConfig[k]?.ativo);
                  if (!firstActive) return;
                  const ref = agendaConfig[firstActive];
                  setAgendaConfig(prev => {
                    const next = { ...prev };
                    uiDisplayDays.forEach(k => {
                      if (next[k]?.ativo && k !== firstActive) {
                        next[k] = { ...next[k], inicio: ref.inicio, fim: ref.fim, intervaloInicio: ref.intervaloInicio, intervaloFim: ref.intervaloFim };
                      }
                    });
                    return next;
                  });
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600/15 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 hover:border-indigo-600 text-xs font-bold rounded-xl transition-all shrink-0"
                title="Copia os horários do primeiro dia ativo para todos os outros dias ativos"
              >
                <ToggleRight className="h-4 w-4" />
                Replicar para todos os dias ativos
              </button>
            </div>

            {/* Loop weekdays in grid (spacious & highly readable) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {uiDisplayDays.map(dayKey => {
                const dayConfig = agendaConfig[dayKey] || defaultDays[dayKey];
                const label = weekdayLabels[dayKey];
                
                return (
                  <div 
                    key={dayKey} 
                    className={`
                      border rounded-3xl transition-all duration-300 p-6 space-y-5 relative overflow-hidden backdrop-blur-sm
                      ${dayConfig.ativo 
                        ? "bg-slate-900/60 border-indigo-500/30 ring-1 ring-indigo-500/10 shadow-lg shadow-indigo-500/5" 
                        : "bg-slate-950/10 border-slate-900 opacity-60 hover:opacity-80"
                      }
                    `}
                  >
                    {/* Header Row with Toggle Switch */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <span className="text-sm font-extrabold text-white tracking-wide uppercase">{label}</span>
                      <button
                        onClick={() => handleToggleDay(dayKey)}
                        className={`
                          px-3.5 py-1.5 rounded-xl text-[11px] font-black transition-all duration-300 border flex items-center gap-1.5
                          ${dayConfig.ativo 
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-sm shadow-emerald-500/5" 
                            : "bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700"
                          }
                        `}
                      >
                        <span className={`h-2.5 w-2.5 rounded-full ${dayConfig.ativo ? "bg-emerald-500 animate-pulse" : "bg-slate-700"}`} />
                        <span>{dayConfig.ativo ? "Ativo" : "Inativo"}</span>
                      </button>
                    </div>

                    {/* Config inputs if active */}
                    {dayConfig.ativo ? (
                      <div className="space-y-4">
                        {/* Expediente (Working Hours) */}
                        <div className="space-y-2">
                          <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider block">Horário de Expediente</span>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <span className="text-[9px] text-slate-500 uppercase tracking-wider block mb-1">Início</span>
                              <input
                                type="time"
                                required
                                value={dayConfig.inicio}
                                onChange={(e) => handleTimeChange(dayKey, "inicio", e.target.value)}
                                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500 font-semibold font-mono text-center shadow-inner"
                              />
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-500 uppercase tracking-wider block mb-1">Término</span>
                              <input
                                type="time"
                                required
                                value={dayConfig.fim}
                                onChange={(e) => handleTimeChange(dayKey, "fim", e.target.value)}
                                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500 font-semibold font-mono text-center shadow-inner"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Almoço (Lunch Break) */}
                        <div className="space-y-2 pt-2 border-t border-slate-950">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Intervalo de Almoço</span>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <span className="text-[9px] text-slate-500 uppercase tracking-wider block mb-1">Início do Almoço</span>
                              <input
                                type="time"
                                value={dayConfig.intervaloInicio}
                                onChange={(e) => handleTimeChange(dayKey, "intervaloInicio", e.target.value)}
                                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-400 text-sm focus:outline-none focus:border-indigo-500 font-semibold font-mono text-center shadow-inner"
                              />
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-500 uppercase tracking-wider block mb-1">Fim do Almoço</span>
                              <input
                                type="time"
                                value={dayConfig.intervaloFim}
                                onChange={(e) => handleTimeChange(dayKey, "intervaloFim", e.target.value)}
                                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-400 text-sm focus:outline-none focus:border-indigo-500 font-semibold font-mono text-center shadow-inner"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-32 flex flex-col justify-center items-center text-center text-slate-650 py-6">
                        <Info className="h-6 w-6 text-slate-700 mb-1.5" />
                        <span className="text-xs font-semibold text-slate-400">Dia de folga</span>
                        <p className="text-[10px] text-slate-550 max-w-xs mt-0.5">Nenhum horário será gerado para este dia.</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Subsection: Cores da Agenda */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 backdrop-blur-sm space-y-4">
            <button
              type="button"
              onClick={() => setShowColorsConfig(!showColorsConfig)}
              className="w-full flex items-center justify-between font-bold text-white text-lg focus:outline-none cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span>🎨 Personalizar Cores da Agenda</span>
              </div>
              <span className="text-xs text-indigo-400 font-bold font-mono">
                {showColorsConfig ? "Recolher ▲" : "Expandir ▼"}
              </span>
            </button>

            {showColorsConfig && (
              <div className="pt-4 space-y-6 border-t border-slate-800/60 animate-fade-in">
                <p className="text-xs text-slate-400">
                  Ajuste as cores de fundo dos status do calendário. O sistema calculará automaticamente o contraste do texto e avisará se houver baixa legibilidade (WCAG AA).
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {[
                    { key: "disponivel", label: "Disponível (Livre)" },
                    { key: "agendado", label: "Agendado" },
                    { key: "atendido", label: "Atendido" },
                    { key: "cancelado", label: "Cancelado" },
                    { key: "bloqueado", label: "Bloqueado" },
                    { key: "perdido", label: "Perdido" },
                    { key: "novo", label: "Novo" },
                    { key: "emContato", label: "Em contato" },
                    { key: "continuacao", label: "Continuação" }
                  ].map(({ key, label }) => {
                    const value = colorEditor[key] || defaultCalendarColors[key as keyof typeof defaultCalendarColors];
                    const style = getCalendarStatusStyle(
                      key === "disponivel" ? "Disponível" :
                      key === "bloqueado" ? "Bloqueado" :
                      key === "continuacao" ? "Continuação" :
                      key === "novo" ? "Novo" :
                      key === "emContato" ? "Em contato" :
                      key === "agendado" ? "Agendado" :
                      key === "atendido" ? "Atendido" :
                      key === "cancelado" ? "Cancelado" : "Perdido",
                      colorEditor
                    );

                    return (
                      <div key={key} className="space-y-2 p-4 bg-slate-950 border border-slate-850 rounded-2xl">
                        <label className="block text-[11px] font-bold text-slate-350 uppercase tracking-wider">{label}</label>
                        <div className="flex gap-3 items-center">
                          <input
                            type="color"
                            value={value}
                            onChange={(e) => handleColorEditorChange(key, e.target.value)}
                            className="h-9 w-9 rounded-xl border border-slate-800 bg-transparent cursor-pointer shrink-0"
                          />
                          <input
                            type="text"
                            value={value}
                            onChange={(e) => handleColorEditorChange(key, e.target.value)}
                            className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono focus:outline-none"
                          />
                        </div>

                        {/* WCAG Preview Card */}
                        <div 
                          className="p-2.5 rounded-xl border text-center text-xs font-black font-mono shadow-inner mt-2"
                          style={{ backgroundColor: style.bg, color: style.text }}
                        >
                          Texto de Exemplo
                        </div>

                        {/* Contrast indicator & warning */}
                        <div className="flex justify-between items-center text-[10px] text-slate-500 font-semibold pt-1">
                          <span>Contraste: {style.ratio.toFixed(2)}:1</span>
                          {style.isWcagCompliant ? (
                            <span className="text-emerald-400 font-bold">✓ WCAG AA OK</span>
                          ) : (
                            <span className="text-rose-450 font-bold">⚠ Contraste Baixo</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-3 justify-end pt-4 border-t border-slate-800/60">
                  <button
                    type="button"
                    onClick={handleRestoreDefaultColors}
                    className="px-4 py-2 bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-800 text-xs font-bold rounded-xl transition-all"
                  >
                    Restaurar Padrão
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveColors}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-500/10 cursor-pointer"
                  >
                    Salvar Cores
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action Triggers */}
          <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-slate-850 justify-end">
            <button
              onClick={handleSaveConfigOnly}
              disabled={actionLoading}
              className="px-6 py-3.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-slate-205 font-bold rounded-xl text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {actionLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <span>Salvar Configurações</span>
              )}
            </button>
            
            <button
              onClick={handleOpenSmartPreview}
              disabled={actionLoading}
              className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700/50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {actionLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Sparkles className="h-4.5 w-4.5" />
                  <span>Gerar Agenda Automática</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: MANUAL SLOT FORM (Full-width side-by-side layout) */}
      {activeTab === "manual" && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-sm space-y-6 animate-fade-in">
          <div>
            <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              <CalendarIcon className="h-5.5 w-5.5 text-indigo-400" />
              <span>Horários Avulsos</span>
            </h2>
            <p className="text-xs text-slate-400">Insira horários específicos para datas isoladas na agenda.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Side: Date Input and Custom time */}
            <div className="space-y-6 bg-slate-950/20 border border-slate-850 p-6 rounded-3xl">
              {/* Date Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-350 uppercase tracking-wider mb-2">1. Escolha a data</label>
                <input
                  type="date"
                  value={manualDate}
                  min={getSaoPauloToday()}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-100 text-sm font-mono"
                />
              </div>

              {/* Custom Time Add Form */}
              <div>
                <label className="block text-xs font-semibold text-slate-355 uppercase tracking-wider mb-2">Ou digite um horário customizado</label>
                <form onSubmit={handleManualAddCustomTime} className="flex gap-2">
                  <input
                    type="time"
                    value={manualCustomTime}
                    onChange={(e) => setManualCustomTime(e.target.value)}
                    className="flex-1 px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-100 text-sm font-mono"
                  />
                  <button
                    type="submit"
                    className="px-4 bg-slate-950 border border-slate-800 hover:border-indigo-500 text-slate-300 hover:text-indigo-400 rounded-xl font-bold transition-all"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </form>
              </div>
            </div>

            {/* Right Side: Common presets checkboxes & Summary */}
            <div className="space-y-6 bg-slate-950/20 border border-slate-855 p-6 rounded-3xl border-slate-850">
              <div>
                <label className="block text-xs font-semibold text-slate-355 uppercase tracking-wider mb-2">2. Escolha os horários</label>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  {standardTimes.map(time => {
                    const checked = manualSelectedTimes.includes(time);
                    return (
                      <button
                        key={time}
                        onClick={() => handleManualTimeCheckbox(time)}
                        className={`
                          py-2 px-1 rounded-xl text-xs font-semibold border text-center transition-all font-mono
                          ${checked 
                            ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-500/10" 
                            : "bg-slate-900/60 border-slate-800/80 text-slate-400 hover:border-slate-700"
                          }
                        `}
                      >
                        {time}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selection Summary */}
              {manualSelectedTimes.length > 0 && (
                <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl">
                  <span className="text-xs text-slate-450 block mb-2 font-semibold">Selecionados:</span>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {manualSelectedTimes.map(time => (
                      <span 
                        key={time}
                        onClick={() => handleManualTimeCheckbox(time)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-500/10 text-indigo-400 rounded-lg text-xs font-semibold border border-indigo-500/20 cursor-pointer hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all font-mono"
                        title="Remover"
                      >
                        <span>{time}</span>
                        <X className="h-3 w-3" />
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Manual Generation Trigger */}
          <div className="flex justify-end pt-4 border-t border-slate-850">
            <button
              onClick={handleManualGenerateSlots}
              disabled={actionLoading || manualSelectedTimes.length === 0}
              className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700/50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {actionLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <span>Criar {manualSelectedTimes.length} Horário(s) Avulso(s)</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* MODAL 1: SMART GENERATOR PREVIEW */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative">
            <button
              onClick={() => setShowPreview(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-850 text-slate-400 hover:text-slate-200 transition-all"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-400" />
              <span>Resumo da Geração</span>
            </h2>
            <p className="text-xs text-slate-400 mb-6 font-medium">Confira as estimativas antes de criar novos horários.</p>

            <div className="space-y-4 bg-slate-950 border border-slate-855 p-4 rounded-2xl text-sm mb-6 text-slate-300 border-slate-850">
              <div className="flex justify-between border-b border-slate-850 pb-2.5">
                <span className="text-slate-500 font-semibold">Período selecionado:</span>
                <span className="font-bold text-slate-200">
                  {periodDays === 1 
                    ? formatDate(previewSummary.startDateStr) 
                    : `${formatDate(previewSummary.startDateStr)} a ${formatDate(previewSummary.endDateStr)}`}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-850 pb-2.5">
                <span className="text-slate-500 font-semibold">Dias considerados:</span>
                <span className="font-bold text-slate-200">{previewSummary.daysConsidered} dia(s)</span>
              </div>
              <div className="flex justify-between border-b border-slate-850 pb-2.5">
                <span className="text-slate-500 font-semibold">Dias ativos na semana:</span>
                <span className="font-bold text-indigo-400">
                  {uiDisplayDays
                    .filter(k => agendaConfig[k]?.ativo)
                    .map(k => weekdayLabels[k].split("-")[0])
                    .join(", ")}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-850 pb-2.5">
                <span className="text-slate-500 font-semibold">Estimados a criar:</span>
                <span className="font-bold text-emerald-400">+{previewSummary.estCreate} slots</span>
              </div>
              <div className="flex justify-between border-b border-slate-850 pb-2.5">
                <span className="text-slate-500 font-semibold">Ignorados por duplicidade:</span>
                <span className="font-bold text-amber-400">{previewSummary.estSkip} slots</span>
              </div>
              <div className="flex justify-between pb-1">
                <span className="text-slate-500 font-semibold">Ignorados por estarem no passado:</span>
                <span className="font-bold text-slate-500">{previewSummary.estPast} slots</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="flex-1 py-3 bg-slate-950 hover:bg-slate-800 text-slate-350 border border-slate-850 font-semibold rounded-xl text-sm transition-all border-slate-800"
              >
                Ajustar Filtros
              </button>
              <button
                type="button"
                onClick={handleConfirmSmartGeneration}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98]"
              >
                Confirmar e Gerar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: SMART GENERATOR FEEDBACK */}
      {showResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-850 rounded-3xl p-6 md:p-8 shadow-2xl relative text-center flex flex-col items-center border-slate-800">
            
            <div className="h-14 w-14 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/5 mb-4">
              <Check className="h-7 w-7" />
            </div>

            <h2 className="text-xl font-bold text-white mb-2">
              Horários Gerados com Sucesso!
            </h2>
            <p className="text-xs text-slate-400 mb-6 font-medium">Sua agenda de rotina foi calculada e atualizada no banco de dados.</p>

            <div className="w-full space-y-3 bg-slate-950 border border-slate-855 p-4 rounded-2xl text-sm mb-6 text-slate-355 text-left border-slate-850">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-semibold">Horários criados:</span>
                <span className="font-bold text-emerald-400">{resultMetrics.created}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-semibold">Ignorados por duplicidade:</span>
                <span className="font-bold text-amber-400">{resultMetrics.duplicates}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-semibold">Ignorados por estarem no passado:</span>
                <span className="font-bold text-slate-500">{resultMetrics.past}</span>
              </div>
            </div>

            <button
              onClick={() => setShowResult(false)}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm transition-all"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
      {/* MODAL 3: MANUAL BOOKING */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowBookingModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-850 text-slate-400 hover:text-slate-200 transition-all"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <CalendarIcon className="h-5.5 w-5.5 text-indigo-400" />
              <span>Novo Agendamento Manual</span>
            </h2>
            <p className="text-xs text-slate-400 mb-6 font-medium">Cadastre um agendamento feito por canais externos.</p>

            {bookingError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex gap-2.5 items-center">
                <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                <p className="font-semibold">{bookingError}</p>
              </div>
            )}

            <form onSubmit={handleCreateManualBooking} className="space-y-4">
              {/* Cliente Nome & Telefone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 relative">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">Nome do Cliente *</label>
                  <input
                    type="text"
                    required
                    value={bookingNome}
                    maxLength={80}
                    onChange={(e) => { setBookingNome(e.target.value); setCustomerSuggestField("nome"); }}
                    onFocus={() => setCustomerSuggestField("nome")}
                    onBlur={() => setCustomerSuggestField(null)}
                    autoComplete="off"
                    placeholder="Ex: João Silva"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
                  />
                  {customerSuggestField === "nome" && renderCustomerSuggestions(bookingNome.trim().toLowerCase(), (c) => c.nome.toLowerCase())}
                </div>
                <div className="space-y-1.5 relative">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">Telefone *</label>
                  <input
                    type="text"
                    required
                    value={bookingTelefone}
                    maxLength={20}
                    onChange={(e) => { setBookingTelefone(e.target.value); setCustomerSuggestField("telefone"); }}
                    onFocus={() => setCustomerSuggestField("telefone")}
                    onBlur={() => setCustomerSuggestField(null)}
                    autoComplete="off"
                    placeholder="Ex: (11) 99999-9999"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
                  />
                  {customerSuggestField === "telefone" && renderCustomerSuggestions(bookingTelefone.replace(/\D/g, ""), (c) => c.telefone)}
                </div>
              </div>

              {/* Serviço */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">Serviço *</label>
                <select
                  required
                  value={bookingServicoId}
                  onChange={(e) => handleServiceSelect(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-indigo-500 text-slate-305 font-semibold"
                >
                  <option value="" disabled>Selecione o serviço...</option>
                  {services.map(srv => (
                    <option key={srv.id} value={srv.id} className="bg-slate-950 text-slate-350">{srv.nome} ({srv.duracaoEstimada})</option>
                  ))}
                </select>
              </div>

              {/* Data & Horário */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">Data *</label>
                  <input
                    type="date"
                    required
                    value={bookingData}
                    onChange={(e) => {
                      setBookingData(e.target.value);
                      setBookingHorario(""); // reset selected hour when date changes
                    }}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">Horário de Início *</label>
                  <select
                    required
                    value={bookingHorario}
                    onChange={(e) => setBookingHorario(e.target.value)}
                    disabled={!bookingData}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500 font-mono disabled:opacity-50 disabled:cursor-not-allowed text-slate-300"
                  >
                    <option value="" disabled>Selecione o horário...</option>
                    {slots
                      .filter(s => s.data === bookingData && s.disponivel)
                      .map(s => s.horario)
                      .sort()
                      .map(time => (
                        <option key={time} value={time} className="bg-slate-950 text-slate-350">{time}</option>
                      ))
                    }
                  </select>
                  {bookingData && slots.filter(s => s.data === bookingData && s.disponivel).length === 0 && (
                    <span className="text-[10px] text-amber-400 block mt-1 font-semibold">⚠️ Nenhum horário livre para esta data.</span>
                  )}
                </div>
              </div>

              {/* Duração & Origem */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">Duração do Atendimento *</label>
                  <div className="flex gap-2">
                    <select
                      value={bookingDuracaoOption}
                      onChange={(e) => {
                        setBookingDuracaoOption(e.target.value);
                        if (e.target.value !== "custom") {
                          setBookingDuracaoCustom("");
                        }
                      }}
                      className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-indigo-500 text-slate-305 font-semibold"
                    >
                      <option value="15">15 minutos</option>
                      <option value="30">30 minutos</option>
                      <option value="45">45 minutos</option>
                      <option value="60">60 minutos</option>
                      <option value="90">90 minutos</option>
                      <option value="120">120 minutos</option>
                      <option value="custom">Personalizado</option>
                    </select>
                    {bookingDuracaoOption === "custom" && (
                      <input
                        type="number"
                        required
                        min="1"
                        placeholder="Minutos"
                        value={bookingDuracaoCustom}
                        onChange={(e) => setBookingDuracaoCustom(e.target.value)}
                        className="w-24 px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500 font-mono text-center"
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">Origem *</label>
                  <select
                    value={bookingOrigem}
                    onChange={(e) => setBookingOrigem(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-indigo-500 text-slate-305 font-semibold"
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="instagram">Instagram</option>
                    <option value="ligacao">Ligação</option>
                    <option value="indicacao">Indicação</option>
                    <option value="presencial">Atendimento Presencial</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
              </div>

              {/* Observação (Opcional) */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-355 uppercase tracking-wider">Observações (Opcional)</label>
                <textarea
                  value={bookingObservacao}
                  maxLength={300}
                  onChange={(e) => setBookingObservacao(e.target.value)}
                  placeholder="Informações adicionais sobre o agendamento (opcional)"
                  rows={2}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-100 text-sm transition-all resize-none"
                />
              </div>

              {/* Live Preview of End Time */}
              {bookingHorario && (
                <div className="p-3 bg-indigo-950/20 border border-indigo-900/30 rounded-2xl text-xs flex justify-between items-center text-slate-300">
                  <span className="font-semibold">Período Previsto:</span>
                  <span className="font-bold text-indigo-400 font-mono">
                    {bookingHorario} às {addMinutesToTime(bookingHorario, bookingDuracaoOption === "custom" ? Number(bookingDuracaoCustom || 0) : Number(bookingDuracaoOption))}
                    {" "}
                    ({bookingDuracaoOption === "custom" ? `${bookingDuracaoCustom || 0} min` : `${bookingDuracaoOption} min`})
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
                  className="flex-1 py-3 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 font-semibold rounded-xl text-sm transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {actionLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <span>Confirmar Agendamento</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: EDIT BOOKING */}
      {showEditModal && editingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowEditModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-850 text-slate-400 hover:text-slate-200 transition-all"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <CalendarIcon className="h-5.5 w-5.5 text-indigo-400" />
              <span>Editar Agendamento</span>
            </h2>
            <p className="text-xs text-slate-400 mb-6 font-medium">Modifique os dados, altere o horário ou cancele o agendamento.</p>

            {editError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex gap-2.5 items-center">
                <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                <p className="font-semibold">{editError}</p>
              </div>
            )}

            <form onSubmit={handleSaveEditBooking} className="space-y-4">
              {/* Cliente Nome & Telefone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">Nome do Cliente *</label>
                  <input
                    type="text"
                    required
                    value={editNome}
                    onChange={(e) => setEditNome(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">Telefone *</label>
                  <input
                    type="text"
                    required
                    value={editTelefone}
                    onChange={(e) => setEditTelefone(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Serviço & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">Serviço *</label>
                  <select
                    required
                    value={editServicoId}
                    onChange={(e) => handleEditServiceSelect(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-955 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-indigo-500 text-slate-300 font-semibold"
                  >
                    {services.map(srv => (
                      <option key={srv.id} value={srv.id} className="bg-slate-955 text-slate-350">{srv.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">Status do Agendamento *</label>
                  <select
                    required
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-955 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-indigo-500 text-slate-300 font-semibold"
                  >
                    <option value="Novo">Novo</option>
                    <option value="Em contato">Em contato</option>
                    <option value="Agendado">Agendado (Bloqueia slots)</option>
                    <option value="Atendido">Atendido (Mantém ocupado)</option>
                    <option value="Cancelado">Cancelado (Libera slots)</option>
                  </select>
                </div>
              </div>

              {/* Data & Horário */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">Data *</label>
                  <input
                    type="date"
                    required
                    value={editData}
                    onChange={(e) => setEditData(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-955 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">Horário de Início *</label>
                  <select
                    required
                    value={editHorario}
                    onChange={(e) => setEditHorario(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500 font-mono text-slate-300"
                  >
                    <option value={editingLead.horarioEscolhido}>{editingLead.horarioEscolhido} (Atual)</option>
                    {slots
                      .filter(s => s.data === editData && (s.disponivel || editingLeadSlotIds.has(s.id)))
                      .map(s => s.horario)
                      .filter(t => t !== editingLead.horarioEscolhido)
                      .sort()
                      .map(time => (
                        <option key={time} value={time} className="bg-slate-955 text-slate-350">{time}</option>
                      ))
                    }
                  </select>
                </div>
              </div>

              {/* Duração & Origem */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">Duração do Atendimento *</label>
                  <div className="flex gap-2">
                    <select
                      value={editDuracaoOption}
                      onChange={(e) => {
                        setEditDuracaoOption(e.target.value);
                        if (e.target.value !== "custom") {
                          setEditDuracaoCustom("");
                        }
                      }}
                      className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-indigo-500 text-slate-305 font-semibold"
                    >
                      <option value="15">15 minutos</option>
                      <option value="30">30 minutos</option>
                      <option value="45">45 minutos</option>
                      <option value="60">60 minutos</option>
                      <option value="90">90 minutos</option>
                      <option value="120">120 minutos</option>
                      <option value="custom">Personalizado</option>
                    </select>
                    {editDuracaoOption === "custom" && (
                      <input
                        type="number"
                        required
                        min="1"
                        placeholder="Minutos"
                        value={editDuracaoCustom}
                        onChange={(e) => setEditDuracaoCustom(e.target.value)}
                        className="w-24 px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500 font-mono text-center"
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">Origem *</label>
                  <select
                    value={editOrigem}
                    onChange={(e) => setEditOrigem(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-indigo-500 text-slate-305 font-semibold"
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="instagram">Instagram</option>
                    <option value="ligacao">Ligação</option>
                    <option value="indicacao">Indicação</option>
                    <option value="presencial">Atendimento Presencial</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
              </div>

              {/* Observação (Opcional) */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-355 uppercase tracking-wider">Observações (Opcional)</label>
                <textarea
                  value={editObservacao}
                  onChange={(e) => setEditObservacao(e.target.value)}
                  placeholder="Informações adicionais (opcional)"
                  rows={2}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-100 text-sm transition-all resize-none"
                />
              </div>

              {/* Live Preview of End Time */}
              {editHorario && editStatus !== "Cancelado" && (
                <div className="p-3 bg-indigo-950/20 border border-indigo-900/30 rounded-2xl text-xs flex justify-between items-center text-slate-300">
                  <span className="font-semibold">Novo Período Previsto:</span>
                  <span className="font-bold text-indigo-400 font-mono">
                    {editHorario} às {addMinutesToTime(editHorario, editDuracaoOption === "custom" ? Number(editDuracaoCustom || 0) : Number(editDuracaoOption))}
                    {" "}
                    ({editDuracaoOption === "custom" ? `${editDuracaoCustom || 0} min` : `${editDuracaoOption} min`})
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-3 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 font-semibold rounded-xl text-sm transition-all"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {actionLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <span>Salvar Alterações</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

const CollapsibleCancelledHistory = ({ leadsList }: { leadsList: any[] }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-red-950/5 border border-red-500/15 rounded-3xl p-5 mt-4">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between font-extrabold text-sm text-red-400 uppercase tracking-wider cursor-pointer focus:outline-none"
      >
        <span>Histórico de Cancelamentos ({leadsList.length})</span>
        <span className="text-xs">{isOpen ? "Recolher ▲" : "Expandir ▼"}</span>
      </button>

      {isOpen && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 animate-fade-in">
          {leadsList.map(lead => (
            <div 
              key={lead.id}
              className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl flex flex-col justify-between gap-3 text-xs"
            >
              <div className="flex items-center justify-between font-bold text-slate-400">
                <span>{lead.horarioEscolhido}</span>
                <span className="text-[10px] text-red-400 font-black uppercase tracking-wider">Cancelado</span>
              </div>
              <div className="space-y-0.5">
                <div className="font-extrabold text-slate-200 text-sm">{lead.nome}</div>
                <div className="text-slate-450 font-semibold">{lead.servicoEscolhido}</div>
                {lead.observacao && <p className="text-[10px] text-slate-500 italic truncate">{lead.observacao}</p>}
              </div>
              <div className="text-[10px] text-slate-550 font-semibold">Tel: {lead.telefone}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
