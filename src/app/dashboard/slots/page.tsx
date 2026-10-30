"use client";

import React, { useEffect, useState } from "react";
import GoogleCalendarIntegration from "../components/GoogleCalendarIntegration";
import LeadCardActions from "../components/LeadCardActions";
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
  Building2
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
  const [activeProfId, setActiveProfId] = useState<string>("");

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
  const bookingPrefillRef = React.useRef<{ data: string; horario: string } | null>(null);
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
    const q = query(slotsRef, orderBy("data", "asc"), orderBy("horario", "asc"));

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
      setBookingNome("");
      setBookingTelefone("");
      setBookingObservacao("");
      setBookingServicoId("");
      const prefill = bookingPrefillRef.current;
      bookingPrefillRef.current = null;
      setBookingData(prefill?.data || agendaDateFilter || new Date().toISOString().split("T")[0]);
      setBookingHorario(prefill?.horario || "");
      setCustomerSuggestField(null);
      setBookingOrigem("whatsapp");
      setBookingDuracaoOption("30");
      setBookingDuracaoCustom("");
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
    const today = new Date();
    let pastCount = 0;

    const nowMinutes = today.getHours() * 60 + today.getMinutes();
    const todayStr = today.toISOString().split("T")[0];

    for (let i = 0; i < periodDays; i++) {
      const currentDate = new Date();
      currentDate.setDate(today.getDate() + i);
      
      const dateStr = currentDate.toISOString().split("T")[0];
      const weekdayIndex = currentDate.getDay(); // Sunday=0, ..., Saturday=6
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
      const todayStr = new Date().toISOString().split("T")[0];
      
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + periodDays - 1);
      const futureStr = futureDate.toISOString().split("T")[0];

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
    const matches = customerList.filter(c => field(c).includes(q)).slice(0, 5);
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

  const renderMonthView = () => {
    if (!calendarRefDate) return null;
    const grid = getMonthGrid(calendarRefDate);
    const currentMonthNum = calendarRefDate.split("-")[1];
    const weekLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    return (
      <div className="space-y-4">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
          {weekLabels.map(l => <div key={l}>{l}</div>)}
        </div>

        {/* 42 days grid */}
        <div className="grid grid-cols-7 gap-2">
          {grid.map(dateStr => {
            const today = getSaoPauloToday();
            const isCurrentMonth = dateStr.split("-")[1] === currentMonthNum;
            const isToday = dateStr === today;
            const isPast = dateStr < today;

            const daySlots = slotsByDate.get(dateStr) || [];
            const futureSlots = daySlots.filter(s => !isPastDateTimeSaoPaulo(dateStr, s.horario));
            const availableCount = futureSlots.filter(s => s.disponivel).length;
            const reservedCount = futureSlots.filter(s => !s.disponivel).length;
            const cancelledCount = leads.filter(l => l.status === "Cancelado" && l.dataEscolhida === dateStr).length;
            const attendedCount = leads.filter(l => l.status === "Atendido" && l.dataEscolhida === dateStr).length;
            const dayNum = dateStr.split("-")[2];

            const styleLivre = getCalendarStatusStyle("Disponível", calendarColors);
            const styleAgendado = getCalendarStatusStyle("Agendado", calendarColors);
            const styleCancelado = getCalendarStatusStyle("Cancelado", calendarColors);

            return (
              <div
                key={dateStr}
                onClick={() => {
                  if (isPast && attendedCount === 0) return;
                  setCalendarRefDate(dateStr);
                  setCalendarView("day");
                }}
                className={`
                  p-1 md:p-3 rounded-xl md:rounded-2xl border text-left flex flex-col justify-between h-16 md:h-28 transition-all duration-200
                  ${isPast
                    ? attendedCount > 0
                      ? "bg-emerald-950/20 border-emerald-500/30 cursor-pointer hover:border-emerald-400/60"
                      : "bg-slate-950/10 border-slate-900/30 opacity-30 cursor-default"
                    : isToday
                      ? "bg-indigo-950/20 border-indigo-500/50 shadow-md shadow-indigo-500/5 cursor-pointer hover:border-indigo-400/70"
                      : isCurrentMonth
                        ? "bg-slate-950/40 border-slate-800/80 cursor-pointer hover:border-slate-600"
                        : "bg-slate-950/10 border-slate-900/60 opacity-40 cursor-pointer hover:border-slate-700"
                  }
                `}
              >
                <div className="flex justify-between items-center">
                  <span className={`text-xs md:text-sm font-black ${isToday ? "text-indigo-400" : isPast ? "text-slate-600" : "text-slate-300"}`}>
                    {parseInt(dayNum, 10)}
                  </span>
                  {isToday && (
                    <span className="hidden md:inline text-[9px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">Hoje</span>
                  )}
                </div>

                <div className="space-y-0.5 md:space-y-1 mt-1 md:mt-2 text-[8px] md:text-[10px] font-bold">
                  {isPast && attendedCount > 0 && (
                    <div className="flex items-center gap-0.5 md:gap-1 text-emerald-400">
                      <Check className="h-2.5 w-2.5 md:h-3 md:w-3 shrink-0" />
                      <span className="hidden md:inline">{attendedCount} Atendido{attendedCount > 1 ? "s" : ""}</span>
                      <span className="md:hidden">{attendedCount}</span>
                    </div>
                  )}
                  {!isPast && availableCount > 0 && (
                    <div className="flex items-center gap-0.5 md:gap-1" style={{ color: styleLivre.bg }}>
                      <span className="h-1 w-1 md:h-1.5 md:w-1.5 rounded-full shrink-0" style={{ backgroundColor: styleLivre.bg }} />
                      <span className="hidden md:inline">{availableCount} {styleLivre.label}</span>
                      <span className="md:hidden">{availableCount}</span>
                    </div>
                  )}
                  {!isPast && reservedCount > 0 && (
                    <div className="flex items-center gap-0.5 md:gap-1" style={{ color: styleAgendado.bg }}>
                      <span className="h-1 w-1 md:h-1.5 md:w-1.5 rounded-full shrink-0" style={{ backgroundColor: styleAgendado.bg }} />
                      <span className="hidden md:inline">{reservedCount} Ocupados</span>
                      <span className="md:hidden">{reservedCount}</span>
                    </div>
                  )}
                  {!isPast && cancelledCount > 0 && (
                    <div className="flex items-center gap-0.5 md:gap-1" style={{ color: styleCancelado.bg }}>
                      <span className="h-1 w-1 md:h-1.5 md:w-1.5 rounded-full shrink-0" style={{ backgroundColor: styleCancelado.bg }} />
                      <span className="hidden md:inline">{cancelledCount} Cancelados</span>
                      <span className="md:hidden">{cancelledCount}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    if (!calendarRefDate) return null;
    const startStr = getStartOfWeekSaoPaulo(calendarRefDate);
    const weekDays: string[] = [];
    for (let i = 0; i < 7; i++) {
      weekDays.push(addDaysSaoPaulo(startStr, i));
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {weekDays.map(dateStr => {
          const today = getSaoPauloToday();
          const isToday = dateStr === today;
          const isPast = dateStr < today;
          const daySlots = slotsByDate.get(dateStr) || [];
          const sortedSlots = [...daySlots].sort((a, b) => timeToMinutes(a.horario) - timeToMinutes(b.horario));
          const cancelledCount = leads.filter(l => l.status === "Cancelado" && l.dataEscolhida === dateStr).length;
          const isSlotExpired = (horario: string) => isToday && isPastDateTimeSaoPaulo(dateStr, horario);

          return (
            <div
              key={dateStr}
              className={`
                border rounded-2xl p-4 flex flex-col gap-3 min-h-[400px]
                ${isPast
                  ? "bg-slate-950/5 border-slate-900/30 opacity-40"
                  : isToday
                    ? "bg-slate-950/20 border-indigo-500/30 ring-1 ring-indigo-500/10 shadow-lg shadow-indigo-500/5"
                    : "bg-slate-950/20 border-slate-800/80"
                }
              `}
            >
              <div
                className={`border-b border-slate-800/60 pb-2 transition-colors ${isPast ? "cursor-default" : "cursor-pointer hover:text-indigo-400"}`}
                onClick={() => {
                  if (isPast) return;
                  setCalendarRefDate(dateStr);
                  setCalendarView("day");
                }}
              >
                <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-400">
                  {(() => {
                    const [y, m, d] = dateStr.split("-").map(Number);
                    const dayOfWeek = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay();
                    return weekdayLabels[weekdayKeys[dayOfWeek]];
                  })()}
                </h4>
                <div className="text-sm font-black text-slate-200 mt-0.5">{formatDateShortSaoPaulo(dateStr)}</div>
              </div>

              {/* Slots List */}
              <div className="flex-1 space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {isPast ? (
                  <div className="text-center py-8 text-slate-600 text-[10px] font-semibold">Dia passado</div>
                ) : sortedSlots.length === 0 ? (
                  <div className="text-center py-8 text-slate-650 text-[10px] font-semibold">Nenhum slot</div>
                ) : (
                  sortedSlots.map(slot => {
                    const lead = leads.find(l => 
                      l.status !== "Perdido" &&
                      l.status !== "Cancelado" &&
                      l.dataEscolhida === slot.data &&
                      l.horarioEscolhido === slot.horario
                    );

                    const coveringLead = lead || leads.find(l => {
                      if (l.status === "Perdido" || l.status === "Cancelado") return false;
                      if (l.dataEscolhida !== slot.data) return false;
                      const start = timeToMinutes(l.horarioInicio || l.horarioEscolhido);
                      const dur = getLeadDurationInMinutes(l, services, slotDuration);
                      const end = start + dur;
                      const slotMin = timeToMinutes(slot.horario);
                      return slotMin >= start && slotMin < end;
                    });

                    const isContinuation = coveringLead && (!lead);
                    const expired = isSlotExpired(slot.horario);
                    const isOrphanBlocked = !slot.disponivel && !slot.bloqueadoManual && !lead && !isContinuation;

                    if (slot.bloqueadoManual && !slot.disponivel && !lead && !isContinuation) {
                      return (
                        <div
                          key={slot.id}
                          className="p-2.5 rounded-xl border bg-slate-950/30 border-rose-500/20 flex items-center justify-between text-[11px]"
                        >
                          <span className="font-mono text-slate-400">{slot.horario}</span>
                          <span className="text-[9px] text-rose-400 uppercase tracking-wider font-extrabold">Bloqueado</span>
                        </div>
                      );
                    }

                    if (isOrphanBlocked) {
                      return (
                        <div
                          key={slot.id}
                          className="p-2.5 rounded-xl border bg-slate-950/10 border-slate-900/30 flex items-center justify-between text-[11px] opacity-50"
                        >
                          <span className="font-mono text-slate-400">{slot.horario}</span>
                          <span className="text-[9px] text-emerald-500/60 uppercase tracking-wider font-bold">Livre</span>
                        </div>
                      );
                    }

                    if (expired) {
                      return (
                        <div
                          key={slot.id}
                          className="p-2.5 rounded-xl border bg-slate-950/10 border-slate-900/30 flex items-center justify-between text-[11px] opacity-40"
                        >
                          <span className="font-mono text-slate-500 line-through">{slot.horario}</span>
                          <span className="text-[9px] text-slate-600 uppercase tracking-wider font-bold">Expirado</span>
                        </div>
                      );
                    }

                    if (slot.disponivel) {
                      const style = getCalendarStatusStyle("Disponível", calendarColors);
                      return (
                        <div
                          key={slot.id}
                          className="p-2.5 rounded-xl border bg-slate-900 border-slate-850 flex items-center justify-between text-[11px] font-bold"
                        >
                          <span className="font-mono text-slate-300">{slot.horario}</span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-extrabold" style={{ backgroundColor: style.bg + "20", color: style.bg, border: `1px solid ${style.bg}30` }}>
                            {style.label}
                          </span>
                        </div>
                      );
                    }

                    if (lead) {
                      const style = getCalendarStatusStyle(lead.status, calendarColors);
                      return (
                        <div
                          key={slot.id}
                          onClick={() => handleOpenEditModal(lead)}
                          className="p-2.5 rounded-xl border cursor-pointer hover:brightness-110 transition-all text-[11px] space-y-1 relative overflow-hidden"
                          style={{ backgroundColor: style.bg + "15", borderLeft: `4px solid ${style.bg}`, borderColor: style.bg + "30" }}
                        >
                          <div className="flex justify-between items-center font-mono font-black" style={{ color: style.bg }}>
                            <span>{slot.horario}</span>
                            <span className="text-[9px] font-extrabold uppercase">{lead.status}</span>
                          </div>
                          <div className="font-extrabold text-slate-200 truncate">{lead.nome}</div>
                        </div>
                      );
                    }

                    if (isContinuation) {
                      return (
                        <div
                          key={slot.id}
                          onClick={() => handleOpenEditModal(coveringLead)}
                          className="p-2.5 rounded-xl border cursor-pointer hover:brightness-110 transition-all text-[11px] bg-slate-950/20 border-slate-900/60 text-slate-550 flex items-center justify-between font-mono"
                        >
                          <span>{slot.horario}</span>
                          <span className="text-[9px] text-slate-550 italic max-w-[80px] truncate">({coveringLead.nome})</span>
                        </div>
                      );
                    }

                    // Blocked
                    const style = getCalendarStatusStyle("Bloqueado", calendarColors);
                    return (
                      <div
                        key={slot.id}
                        className="p-2.5 rounded-xl border bg-slate-955/40 border-slate-900/60 flex items-center justify-between text-[11px] font-mono text-slate-600"
                      >
                        <span className="line-through">{slot.horario}</span>
                        <span className="text-[9px] uppercase tracking-wider font-extrabold text-rose-500/80 bg-rose-500/5 px-1.5 py-0.5 rounded border border-rose-500/10">Bloqueado</span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Weekly Cancellation Summary Indicator */}
              {!isPast && cancelledCount > 0 && (
                <div
                  onClick={() => {
                    setCalendarRefDate(dateStr);
                    setCalendarView("day");
                  }}
                  className="bg-red-500/5 border border-red-500/10 p-2 rounded-xl text-center text-[10px] font-extrabold text-red-450 cursor-pointer hover:bg-red-500/10 transition-all"
                >
                  {cancelledCount} cancelado(s)
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderDayView = () => {
    if (!calendarRefDate) return null;
    const dateStr = calendarRefDate;
    const today = getSaoPauloToday();
    const isPast = dateStr < today;
    const daySlots = slotsByDate.get(dateStr) || [];
    const sortedSlots = [...daySlots].sort((a, b) => timeToMinutes(a.horario) - timeToMinutes(b.horario));
    const dayCancelledLeads = leads.filter(l => l.status === "Cancelado" && l.dataEscolhida === dateStr);

    return (
      <div className="space-y-6">
        {movingLead && (
          <div className="sticky top-2 z-10 flex items-center justify-between gap-3 rounded-2xl border border-indigo-500/40 bg-indigo-950/90 px-4 py-3 text-xs text-indigo-100 backdrop-blur">
            <span>Toque em um <strong>horário livre</strong> para mover <strong>{movingLead.nome}</strong>.</span>
            <button type="button" onClick={() => setMovingLead(null)} className="shrink-0 rounded-lg border border-indigo-400/40 px-3 py-1.5 font-semibold">Cancelar</button>
          </div>
        )}
        <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
          <div>
            <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-400">Visão Diária</h4>
            <h3 className={`text-lg font-black mt-0.5 ${isPast ? "text-slate-500" : "text-slate-200"}`}>{formatDateFriendly(dateStr)}</h3>
          </div>
          <div className="text-xs text-slate-500 font-bold">
            {isPast ? (
              <span className="text-amber-500/70 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">Dia passado</span>
            ) : (
              `${sortedSlots.length} slot(s) cadastrado(s)`
            )}
          </div>
        </div>

        {isPast && (
          <div className="flex items-center gap-3 p-4 bg-slate-900/40 border border-slate-800/60 rounded-2xl text-sm text-slate-500">
            <span>Este dia já passou. Navegue para uma data futura para ver os horários disponíveis.</span>
          </div>
        )}


        <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
          {sortedSlots.length === 0 ? (
            <div className="text-center py-16 bg-slate-950/20 border border-slate-850 rounded-2xl text-slate-400 text-sm font-semibold">
              Nenhum slot configurado para este dia.
            </div>
          ) : (
            sortedSlots.map(slot => {
              const lead = leads.find(l => 
                l.status !== "Perdido" &&
                l.status !== "Cancelado" &&
                l.dataEscolhida === slot.data &&
                l.horarioEscolhido === slot.horario
              );

              const coveringLead = lead || leads.find(l => {
                if (l.status === "Perdido" || l.status === "Cancelado") return false;
                if (l.dataEscolhida !== slot.data) return false;
                const start = timeToMinutes(l.horarioInicio || l.horarioEscolhido);
                const dur = getLeadDurationInMinutes(l, services, slotDuration);
                const end = start + dur;
                const slotMin = timeToMinutes(slot.horario);
                return slotMin >= start && slotMin < end;
              });

              const isContinuation = coveringLead && (!lead);
              const expired = isPastDateTimeSaoPaulo(dateStr, slot.horario);

              // Slot bloqueado mas lead está cancelado/perdido (cleanup ainda não rodou)
              const isOrphanBlocked = !slot.disponivel && !slot.bloqueadoManual && !lead && !isContinuation;

              if (slot.bloqueadoManual && !slot.disponivel && !lead && !isContinuation) {
                const open = slotMenuId === slot.id;
                return (
                  <div
                    key={slot.id}
                    onClick={() => setSlotMenuId(open ? null : slot.id)}
                    className="p-4 bg-slate-950/40 border border-rose-500/20 rounded-2xl text-xs cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-slate-400 text-sm font-bold">{slot.horario}</span>
                        <span className="text-[10px] text-slate-500 font-medium">Horário bloqueado</span>
                      </div>
                      <span className="text-[10px] text-rose-400 uppercase tracking-wider font-extrabold">Bloqueado</span>
                    </div>
                    {open && (
                      <button
                        type="button"
                        disabled={slotActionId === slot.id}
                        onClick={(e) => { e.stopPropagation(); handleToggleSlot(slot, false); }}
                        className="mt-3 w-full py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-xs disabled:opacity-50"
                      >
                        {slotActionId === slot.id ? "Reativando..." : "Reativar horário"}
                      </button>
                    )}
                  </div>
                );
              }

              if (isOrphanBlocked) {
                const open = slotMenuId === slot.id;
                return (
                  <div
                    key={slot.id}
                    onClick={() => setSlotMenuId(open ? null : slot.id)}
                    className="p-4 bg-slate-950/20 border border-slate-800/30 rounded-2xl text-xs cursor-pointer"
                  >
                    <div className="flex items-center justify-between opacity-60">
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-slate-400 text-sm">{slot.horario}</span>
                        <span className="text-[10px] text-slate-500 font-medium">Horário indisponível</span>
                      </div>
                      <span className="text-[10px] text-rose-400 uppercase tracking-wider font-bold">Bloqueado</span>
                    </div>
                    {open && (
                      <button
                        type="button"
                        disabled={slotActionId === slot.id}
                        onClick={(e) => { e.stopPropagation(); handleToggleSlot(slot, false); }}
                        className="mt-3 w-full py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-xs disabled:opacity-50"
                      >
                        {slotActionId === slot.id ? "Liberando..." : "Liberar horário"}
                      </button>
                    )}
                  </div>
                );
              }

              if (expired && !lead && !isContinuation) {
                return (
                  <div
                    key={slot.id}
                    className="p-4 bg-slate-950/20 border border-slate-900/30 rounded-2xl flex items-center justify-between text-xs opacity-35"
                  >
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-slate-500 text-sm line-through">{slot.horario}</span>
                      <span className="text-[10px] text-slate-600 font-medium">Horário expirado</span>
                    </div>
                    <span className="text-[10px] text-slate-600 uppercase tracking-wider font-bold">Expirado</span>
                  </div>
                );
              }

              if (slot.disponivel) {
                const style = getCalendarStatusStyle("Disponível", calendarColors);
                const open = slotMenuId === slot.id;
                return (
                  <div
                    key={slot.id}
                    onClick={() => {
                      if (movingLead) handleMoveLeadTo(movingLead, slot);
                      else setSlotMenuId(open ? null : slot.id);
                    }}
                    onDragOver={(e) => { if (dragLeadId) e.preventDefault(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const dragged = leads.find((l) => l.id === (dragLeadId || e.dataTransfer.getData("text/plain")));
                      if (dragged) handleMoveLeadTo(dragged, slot);
                    }}
                    className={`p-4 bg-slate-900 border rounded-2xl text-xs font-bold cursor-pointer ${movingLead || dragLeadId ? "border-indigo-500/60 ring-1 ring-indigo-500/30" : "border-slate-850"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-slate-200 text-sm font-bold">{slot.horario}</span>
                        <span className="text-[10px] text-slate-500 font-medium">Horário Livre</span>
                      </div>
                      <span
                        className="px-2.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-extrabold"
                        style={{ backgroundColor: style.bg + "20", color: style.bg, border: `1px solid ${style.bg}30` }}
                      >
                        {style.label}
                      </span>
                    </div>
                    {open && !movingLead && (
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            bookingPrefillRef.current = { data: slot.data, horario: slot.horario };
                            setSlotMenuId(null);
                            setShowBookingModal(true);
                          }}
                          className="flex-1 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 font-bold text-xs"
                        >
                          Agendar
                        </button>
                        <button
                          type="button"
                          disabled={slotActionId === slot.id}
                          onClick={(e) => { e.stopPropagation(); handleToggleSlot(slot, true); }}
                          className="flex-1 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 font-bold text-xs disabled:opacity-50"
                        >
                          {slotActionId === slot.id ? "Bloqueando..." : "Bloquear horário"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              }

              if (lead) {
                const style = getCalendarStatusStyle(lead.status, calendarColors);
                return (
                  <div
                    key={slot.id}
                    onClick={() => handleOpenEditModal(lead)}
                    draggable={["Novo", "Em contato", "Agendado"].includes(lead.status)}
                    onDragStart={(e) => { e.dataTransfer.setData("text/plain", lead.id); setDragLeadId(lead.id); }}
                    onDragEnd={() => setDragLeadId(null)}
                    className={`p-4 rounded-2xl border cursor-pointer hover:brightness-110 transition-all text-xs flex flex-col relative overflow-hidden ${dragLeadId === lead.id ? "opacity-50" : ""}`}
                    style={{ backgroundColor: style.bg + "15", borderLeft: `4px solid ${style.bg}`, borderColor: style.bg + "30" }}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                      <span className="text-slate-200 font-mono font-bold text-sm">{slot.horario}</span>
                      <div>
                        <div className="font-extrabold text-slate-100 text-sm flex items-center gap-2">
                          <span>{lead.nome}</span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-black tracking-wider" style={{ backgroundColor: style.bg + "20", color: style.bg }}>
                            {lead.status}
                          </span>
                          {lead.origem && (
                            <span className="px-1 py-0.5 rounded text-[9px] bg-slate-850 text-slate-400 font-semibold uppercase tracking-wider">
                              {lead.origem}
                            </span>
                          )}
                        </div>
                        <div className="text-slate-450 font-semibold mt-0.5">
                          {lead.servicoEscolhido} ({lead.duracaoAgendamento || 30} min)
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {lead.telefone && <span className="text-xs text-slate-400 font-mono">Tel: {lead.telefone}</span>}
                    </div>
                    </div>
                    <LeadCardActions
                      lead={lead}
                      profId={activeProfId}
                      moving={movingLead?.id === lead.id}
                      onReschedule={handleOpenEditModal}
                      onMove={(l) => setMovingLead((prev: any) => (prev?.id === l.id ? null : l))}
                      onError={(m) => setError(m)}
                    />
                  </div>
                );
              }

              if (isContinuation) {
                return (
                  <div
                    key={slot.id}
                    onClick={() => handleOpenEditModal(coveringLead)}
                    className="p-3 bg-slate-950/20 border border-slate-900/60 rounded-2xl cursor-pointer hover:border-slate-800 transition-all flex items-center justify-between text-xs font-mono text-slate-500"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-slate-400 font-bold">{slot.horario}</span>
                      <span className="text-[10px] text-slate-500 italic">Continuação do atendimento de {coveringLead.nome}</span>
                    </div>
                  </div>
                );
              }

              // Blocked
              const style = getCalendarStatusStyle("Bloqueado", calendarColors);
              return (
                <div
                  key={slot.id}
                  className="p-3 bg-slate-955/20 border border-slate-900/60 rounded-2xl flex items-center justify-between text-xs font-mono text-slate-500"
                >
                  <span className="line-through">{slot.horario}</span>
                  <span className="text-[10px] uppercase font-extrabold text-rose-500/80 bg-rose-500/5 px-2 py-0.5 rounded border border-rose-500/10">Bloqueado</span>
                </div>
              );
            })
          )}
        </div>

        {/* Collapsible cancellation history */}
        <CollapsibleCancelledHistory leadsList={dayCancelledLeads} />
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

  const totalAvailable = slots.filter(s => s.disponivel).length;
  const totalReserved = slots.filter(s => !s.disponivel).length;
  const upcomingSlots = slots.filter(s => s.disponivel).slice(0, 6);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">Horários Disponíveis</h1>
        <p className="text-sm text-slate-400 mt-1">Configure os períodos de funcionamento, crie horários avulsos ou gerencie a agenda.</p>
      </div>

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
          <button
            type="button"
            onClick={() => document.getElementById("google-card")?.scrollIntoView({ behavior: "smooth" })}
            className="shrink-0 rounded-lg border border-amber-400/40 px-3 py-1.5 font-semibold"
          >
            Reconectar
          </button>
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
                  min={new Date().toISOString().split("T")[0]}
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

      {/* TAB 3: AGENDA ATUAL (Calendar Visual View) */}
      {activeTab === "agenda" && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Calendar Controls & Navigation */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900/40 border border-slate-800 p-5 rounded-3xl backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCalendarView("month")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${calendarView === "month" ? "bg-indigo-600 text-white" : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200"}`}
              >
                Mês
              </button>
              <button
                onClick={() => setCalendarView("week")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${calendarView === "week" ? "bg-indigo-600 text-white" : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200"}`}
              >
                Semana
              </button>
              <button
                onClick={() => setCalendarView("day")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${calendarView === "day" ? "bg-indigo-600 text-white" : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200"}`}
              >
                Dia
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                {(() => {
                  const today = getSaoPauloToday();
                  const todayMonth = today.slice(0, 7);
                  const todayWeekStart = getStartOfWeekSaoPaulo(today);
                  const isPrevDisabled =
                    (calendarView === "month" && calendarRefDate.slice(0, 7) <= todayMonth) ||
                    (calendarView === "week" && getStartOfWeekSaoPaulo(calendarRefDate) <= todayWeekStart) ||
                    (calendarView === "day" && calendarRefDate <= today);
                  return (
                    <button
                      onClick={() => {
                        if (isPrevDisabled) return;
                        if (calendarView === "month") {
                          setCalendarRefDate(prev => shiftMonth(prev, -1));
                        } else if (calendarView === "week") {
                          setCalendarRefDate(prev => addDaysSaoPaulo(prev, -7));
                        } else {
                          setCalendarRefDate(prev => addDaysSaoPaulo(prev, -1));
                        }
                      }}
                      disabled={isPrevDisabled}
                      className="p-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-400 transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:border-slate-700 hover:text-slate-200 disabled:hover:border-slate-850 disabled:hover:text-slate-400"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                  );
                })()}
                <button
                  onClick={() => setCalendarRefDate(getSaoPauloToday())}
                  className="px-3.5 py-2 bg-slate-950 border border-slate-850 text-slate-300 text-xs font-bold rounded-xl transition-all hover:bg-slate-900"
                >
                  Hoje
                </button>
                <button
                  onClick={() => {
                    if (calendarView === "month") {
                      setCalendarRefDate(prev => shiftMonth(prev, 1));
                    } else if (calendarView === "week") {
                      setCalendarRefDate(prev => addDaysSaoPaulo(prev, 7));
                    } else {
                      setCalendarRefDate(prev => addDaysSaoPaulo(prev, 1));
                    }
                  }}
                  className="p-2 bg-slate-950 border border-slate-850 hover:border-slate-700 rounded-xl text-slate-400 hover:text-slate-200 transition-all"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <span className="font-extrabold text-sm text-indigo-300 ml-1">
                {calendarView === "month" && getMonthNameSaoPaulo(calendarRefDate)}
                {calendarView === "week" && `Semana de ${formatDate(getStartOfWeekSaoPaulo(calendarRefDate))} a ${formatDate(addDaysSaoPaulo(getStartOfWeekSaoPaulo(calendarRefDate), 6))}`}
                {calendarView === "day" && formatDateFriendly(calendarRefDate)}
              </span>
            </div>

            <button
              onClick={() => setShowBookingModal(true)}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all active:scale-95 flex items-center gap-1.5 shadow-lg shadow-indigo-500/20 w-full md:w-auto justify-center"
            >
              <Plus className="h-4 w-4" />
              <span>Novo Agendamento</span>
            </button>
          </div>

          {/* Calendar Grid Container */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 backdrop-blur-sm">
            {loading ? (
              <div className="flex flex-col justify-center items-center py-16">
                <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
                <p className="mt-4 text-slate-400 font-medium">Buscando agenda...</p>
              </div>
            ) : (
              <div className="animate-fade-in">
                {calendarView === "month" && renderMonthView()}
                {calendarView === "week" && renderWeekView()}
                {calendarView === "day" && renderDayView()}
              </div>
            )}
          </div>

          {/* Metrics summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl backdrop-blur-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 text-emerald-500/10"><Check className="h-16 w-16" /></div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Horários Disponíveis (Livres)</span>
              <h3 className="text-3xl font-black text-emerald-400 mt-2">{totalAvailable}</h3>
              <p className="text-[11px] text-slate-400 mt-1">Livres para pré-agendamentos.</p>
            </div>
            <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl backdrop-blur-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 text-amber-500/10"><X className="h-16 w-16" /></div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Horários Ocupados / Reservados</span>
              <h3 className="text-3xl font-black text-amber-500 mt-2">{totalReserved}</h3>
              <p className="text-[11px] text-slate-400 mt-1">Slots agendados por clientes.</p>
            </div>
            <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl backdrop-blur-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 text-indigo-500/10"><CalendarIcon className="h-16 w-16" /></div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total de Slots na Agenda</span>
              <h3 className="text-3xl font-black text-indigo-400 mt-2">{slots.length}</h3>
              <p className="text-[11px] text-slate-400 mt-1">Soma de todos os horários criados.</p>
            </div>
          </div>
        </div>
      )}

      <div id="google-card">
      {/* Integração Google Calendar (movida para o fim da página) */}
      <div className="relative rounded-3xl overflow-hidden shadow-xl" style={{ background: "linear-gradient(135deg,#1e3a5f 0%,#1e2d5a 60%,#2d1b6e 100%)", border: "2px solid #3b82f6" }}>
        <div className="flex items-center gap-2 px-5 pt-4 pb-2">
          <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full" style={{ background: "#2563eb", color: "#fff", boxShadow: "0 0 12px rgba(59,130,246,0.5)" }}>
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            Funcionalidade Importante
          </span>
        </div>
        <div className="px-3 pb-3">
          <GoogleCalendarIntegration />
        </div>
      </div>
      </div>

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
