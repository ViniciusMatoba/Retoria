"use client";

import React, { useEffect, useState } from "react";
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  getDocs, 
  where,
  writeBatch 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
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
  Sparkles
} from "lucide-react";

interface AvailableSlot {
  id: string;
  professionalId: string;
  data: string; // YYYY-MM-DD
  horario: string; // HH:MM
  disponivel: boolean;
  createdAt: any;
  updatedAt: any;
  source?: string;
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
  { value: 15, label: "15 minutos" },
  { value: 30, label: "30 minutos" },
  { value: 45, label: "45 minutos" },
  { value: 60, label: "60 minutos" }
];

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

export default function SlotsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<"smart" | "manual" | "agenda">("smart");
  
  // Result / Message States
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // --- SMART GENERATOR STATES ---
  const [agendaConfig, setAgendaConfig] = useState<Record<string, DayConfig>>(defaultDays);
  const [slotDuration, setSlotDuration] = useState(30);
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
  }, [profile]);

  // Initialize Default Tomorrow Date for Manual Generator
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setManualDate(tomorrow.toISOString().split("T")[0]);
  }, []);

  // Load all slots in real-time
  useEffect(() => {
    if (!user) return;

    const slotsRef = collection(db, "professionals", user.uid, "availableSlots");
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
  }, [user]);

  // Group slots by date for sidebar display
  const groupedSlots = slots.reduce((acc: { [key: string]: AvailableSlot[] }, slot) => {
    if (!acc[slot.data]) {
      acc[slot.data] = [];
    }
    acc[slot.data].push(slot);
    return acc;
  }, {});

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

  // Helper: parse HH:MM to minutes
  const timeToMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  // Helper: format minutes to HH:MM
  const minutesToTime = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
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
      const slotsRef = collection(db, "professionals", user.uid, "availableSlots");
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
      const slotsRef = collection(db, "professionals", user.uid, "availableSlots");
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
        const docRef = doc(db, "professionals", user.uid, "availableSlots", slot.slotId);
        const payload = {
          id: slot.slotId,
          professionalId: user.uid,
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
      const slotsRef = collection(db, "professionals", user.uid, "availableSlots");
      let addedCount = 0;
      let duplicateCount = 0;

      for (const time of manualSelectedTimes) {
        // Deterministic slotId
        const slotId = `${manualDate}_${time.replace(":", "-")}`;
        
        // Check duplication using direct document reference
        const docRef = doc(db, "professionals", user.uid, "availableSlots", slotId);
        const q = query(slotsRef, where("data", "==", manualDate), where("horario", "==", time));
        const checkSnap = await getDocs(q);

        if (checkSnap.empty) {
          const slotPayload = {
            id: slotId,
            professionalId: user.uid,
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
  const handleToggleSlot = async (slot: AvailableSlot) => {
    if (!user) return;
    try {
      const docRef = doc(db, "professionals", user.uid, "availableSlots", slot.id);
      await updateDoc(docRef, {
        disponivel: !slot.disponivel,
        updatedAt: new Date()
      });
    } catch (err) {
      console.error("Error toggling slot:", err);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!user) return;
    if (!window.confirm("Deseja excluir este horário?")) return;
    try {
      const docRef = doc(db, "professionals", user.uid, "availableSlots", slotId);
      await deleteDoc(docRef);
    } catch (err) {
      console.error("Error deleting slot:", err);
    }
  };

  const handleDeleteDateSlots = async (dateStr: string) => {
    if (!user) return;
    if (!window.confirm(`Deseja excluir TODOS os horários de ${formatDate(dateStr)}?`)) return;
    setActionLoading(true);
    try {
      const dateSlots = groupedSlots[dateStr];
      for (const slot of dateSlots) {
        // Never delete or touch slots that are booked (disponivel == false)
        if (slot.disponivel) {
          const docRef = doc(db, "professionals", user.uid, "availableSlots", slot.id);
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
  };

  // --- FORMATTERS ---
  const formatDateFriendly = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    const options: Intl.DateTimeFormatOptions = { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" };
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
        <p className="text-sm text-slate-400 mt-1">Configure seus períodos de funcionamento semanal, crie horários avulsos ou gerencie sua agenda atual.</p>
      </div>

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
                  value={slotDuration}
                  onChange={(e) => setSlotDuration(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500 font-semibold"
                >
                  {durationOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
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
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Rotina de Funcionamento Semanal</h2>
              <p className="text-xs text-slate-400">Configure detalhadamente quais dias da semana você atende e quais os horários de expediente e almoço.</p>
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

      {/* TAB 3: AGENDA ATUAL (Full-width details and dashboard) */}
      {activeTab === "agenda" && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Metrics summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl backdrop-blur-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 text-emerald-500/10"><Check className="h-16 w-16" /></div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Horários Disponíveis (Livres)</span>
              <h3 className="text-3xl font-black text-emerald-400 mt-2">{totalAvailable}</h3>
              <p className="text-[11px] text-slate-400 mt-1">Livres para pré-agendamentos.</p>
            </div>
            {/* Card 2 */}
            <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl backdrop-blur-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 text-amber-500/10"><X className="h-16 w-16" /></div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Horários Ocupados / Reservados</span>
              <h3 className="text-3xl font-black text-amber-500 mt-2">{totalReserved}</h3>
              <p className="text-[11px] text-slate-400 mt-1">Slots agendados por clientes.</p>
            </div>
            {/* Card 3 */}
            <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl backdrop-blur-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 text-indigo-500/10"><CalendarIcon className="h-16 w-16" /></div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total de Slots na Agenda</span>
              <h3 className="text-3xl font-black text-indigo-400 mt-2">{slots.length}</h3>
              <p className="text-[11px] text-slate-400 mt-1">Soma de todos os horários criados.</p>
            </div>
          </div>

          {/* Date Filter bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/40 border border-slate-800 p-5 rounded-3xl backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-350 uppercase tracking-wider">Filtrar por data:</label>
              <input
                type="date"
                value={agendaDateFilter}
                onChange={(e) => setAgendaDateFilter(e.target.value)}
                className="px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-100 text-sm font-mono shadow-inner"
              />
              {agendaDateFilter && (
                <button
                  onClick={() => setAgendaDateFilter("")}
                  className="px-3.5 py-2 bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-bold rounded-xl transition-all active:scale-95"
                >
                  Limpar Filtro
                </button>
              )}
            </div>
            <span className="text-xs text-slate-400 font-semibold bg-slate-950/65 px-3 py-1.5 rounded-lg border border-slate-850">
              {agendaDateFilter ? "Mostrando apenas a data selecionada." : "Mostrando todas as datas com horários."}
            </span>
          </div>

          {/* Upcoming available slots vision */}
          {upcomingSlots.length > 0 && !agendaDateFilter && (
            <div className="bg-indigo-950/15 border border-indigo-900/25 p-5 rounded-3xl backdrop-blur-sm">
              <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-3">Próximos Horários Disponíveis</h4>
              <div className="flex flex-wrap gap-2.5">
                {upcomingSlots.map(slot => (
                  <span 
                    key={slot.id} 
                    className="px-3.5 py-2 bg-slate-950 border border-slate-855 rounded-xl text-xs font-semibold text-slate-200 flex items-center gap-1.5 font-mono shadow-inner border-slate-850"
                  >
                    <Clock className="h-3.5 w-3.5 text-indigo-400" />
                    <span>{formatDate(slot.data)} às {slot.horario}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Slots List container */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 backdrop-blur-sm space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Visão Detalhada dos Horários</h2>
              <p className="text-xs text-slate-400">Gerencie a disponibilidade de cada slot individual ou exclua blocos de horários.</p>
            </div>
            
            {loading ? (
              <div className="flex flex-col justify-center items-center py-16">
                <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
                <p className="mt-4 text-slate-400 font-medium">Buscando agenda...</p>
              </div>
            ) : filteredGroupedDates.length === 0 ? (
              <div className="flex flex-col justify-center items-center py-16 text-center">
                <div className="p-3.5 bg-slate-900 rounded-full text-slate-500 mb-3 border border-slate-800">
                  <Info className="h-6 w-6" />
                </div>
                <h4 className="font-bold text-slate-350">Nenhum horário correspondente encontrado</h4>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  {agendaDateFilter 
                    ? "Não há horários cadastrados nesta data específica." 
                    : "Use o painel de Gerador Automático para preencher sua agenda semanal."
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-6 max-h-[700px] overflow-y-auto pr-1.5">
                {filteredGroupedDates.map(dateStr => {
                  const daySlots = groupedSlots[dateStr];
                  return (
                    <div key={dateStr} className="border border-slate-800/80 rounded-2xl p-5 bg-slate-950/20 relative group/date space-y-4">
                      {/* Date Heading */}
                      <div className="flex items-center justify-between border-b border-slate-800/50 pb-3">
                        <h4 className="font-bold text-sm md:text-base text-indigo-300">
                          {formatDateFriendly(dateStr)}
                        </h4>
                        <button
                          onClick={() => handleDeleteDateSlots(dateStr)}
                          className="text-xs text-slate-500 hover:text-red-400 font-bold transition-all px-2.5 py-1.5 hover:bg-red-500/10 rounded-lg border border-transparent hover:border-red-500/10 md:opacity-0 group-hover/date:opacity-100"
                        >
                          Limpar Horários Livres do Dia
                        </button>
                      </div>

                      {/* Slots List Grid (large dynamic width) */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                        {daySlots.map(slot => (
                          <div 
                            key={slot.id}
                            className={`
                              flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all shadow-sm
                              ${slot.disponivel 
                                ? "bg-slate-900 border-slate-800 text-slate-200" 
                                : "bg-red-500/5 border-red-500/10 text-slate-500"
                              }
                            `}
                          >
                            <div className="flex items-center gap-1.5 font-mono">
                              <Clock className={`h-3.5 w-3.5 ${slot.disponivel ? "text-indigo-400" : "text-slate-650"}`} />
                              <span className={slot.disponivel ? "" : "line-through"}>{slot.horario}</span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {/* Toggle availability */}
                              <button
                                onClick={() => handleToggleSlot(slot)}
                                className="text-slate-500 hover:text-white transition-colors"
                                title={slot.disponivel ? "Marcar Ocupado" : "Marcar Livre"}
                              >
                                {slot.disponivel ? (
                                  <Check className="h-4 w-4 text-emerald-500" />
                                ) : (
                                  <X className="h-4 w-4 text-rose-500" />
                                )}
                              </button>

                              {/* Delete slot */}
                              <button
                                onClick={() => handleDeleteSlot(slot.id)}
                                className="text-slate-500 hover:text-red-400 transition-colors p-0.5 rounded hover:bg-slate-800"
                                title="Excluir Horário"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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

    </div>
  );
}
