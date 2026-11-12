"use client";

import React, { useState, useEffect } from "react";
import { isFullName, normalizeName, FULL_NAME_ERROR } from "@/lib/nameUtils";
import {
  Calendar,
  Clock,
  User,
  Phone,
  FileText,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  AlertCircle,
  Smartphone,
  MessageCircle,
  Info,
} from "lucide-react";
import PublicThemeProvider from "./PublicThemeProvider";
import PublicServiceCard from "./PublicServiceCard";
import PublicProfessionalHeader from "./PublicProfessionalHeader";
import AppointmentLookup, { type RebookRequest } from "./AppointmentLookup";
import { getDefaultThemeConfig, ThemeConfig, getBestTextColor } from "@/lib/themeUtils";
import { getSlotDayStripeStyles, hexToRgba } from "@/lib/slotDayStripes";
import { DESIRED_HOURS, buildOtherTimesMessage } from "@/lib/otherTimesMessage";
import { getWhatsAppLink, maskPhone } from "@/lib/whatsapp";
import { isTooSoonForPublicBooking, getSaoPauloToday, timeToMinutes, minutesToTime } from "@/lib/timezone";
import type { PublicAddress, ServiceLocationType } from "@/lib/contactUtils";
import { auth } from "@/lib/firebase";

// ── Duration helpers ──────────────────────────────────────────────────────────
function parseDuracaoMin(str: string): number {
  if (!str) return 30;
  let total = 0;
  const h = str.match(/(\d+)\s*h/i);
  const m = str.match(/(\d+)\s*min/i);
  if (h) total += parseInt(h[1]) * 60;
  if (m) total += parseInt(m[1]);
  return total || 30;
}

function formatDuracao(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export interface Professional {
  id: string;
  nome: string;
  nomeNegocio: string;
  slugPublico: string;
  telefoneWhatsapp: string;
  descricaoCurta?: string;
  fotoLogoUrl?: string;
  corPrincipal?: string;
  slotSuggestion?: { enabled?: boolean; requestMessage?: string };
  agendaConfig?: { duracaoSlot?: number; janelaAgendamentoDias?: number; [key: string]: any };
  themeConfig?: ThemeConfig;

  // Public info fields (all optional — safe for old profiles)
  publicPhone?: string;
  serviceLocationType?: ServiceLocationType;
  publicAddress?: PublicAddress | null;
  showResponsibleName?: boolean;
  showWelcomeMessage?: boolean;
  showPublicPhone?: boolean;
  showPublicWhatsApp?: boolean;
  showPublicAddress?: boolean;
  showMiniMap?: boolean;
  instagram?: string;
  showPublicInstagram?: boolean;
}

export interface Service {
  id: string;
  nome: string;
  descricaoCurta: string;
  duracaoEstimada: string;
  ativo: boolean;
  preco?: number | null;
  exibirPreco?: boolean;
  ordem?: number | null;
  imagemUrl?: string | null;
  imagemStoragePath?: string | null;
  imagemAlt?: string | null;
  imagemUpdatedAt?: number | null;
}

export interface AvailableSlot {
  id: string;
  data: string;
  horario: string;
  disponivel: boolean;
}

export interface TeamMemberPublic {
  id: string;
  nome: string;
  especialidade?: string;
  fotoLogoUrl?: string | null;
}

// Demo data used in preview mode when real data is unavailable
const DEMO_SERVICES: Service[] = [
  { id: "demo-1", nome: "Consulta Inicial", descricaoCurta: "Primeira consulta de avaliação completa", duracaoEstimada: "60 min", ativo: true },
  { id: "demo-2", nome: "Sessão Avulsa", descricaoCurta: "Sessão individual com atendimento personalizado", duracaoEstimada: "45 min", ativo: true },
];

const DEMO_SLOTS: AvailableSlot[] = [
  { id: "slot-1", data: "2099-12-28", horario: "09:00", disponivel: true },
  { id: "slot-2", data: "2099-12-28", horario: "10:00", disponivel: true },
  { id: "slot-3", data: "2099-12-29", horario: "14:00", disponivel: true },
  { id: "slot-4", data: "2099-12-29", horario: "15:30", disponivel: true },
];

interface PublicBookingExperienceProps {
  professional: Professional;
  services: Service[];
  slots: AvailableSlot[];
  themeConfig?: ThemeConfig;
  previewMode?: boolean;
  teamMembers?: TeamMemberPublic[];
  activeProfessionalId?: string;
  activeWhatsapp?: string;
  onSelectMember?: (id: string) => void;
  loadingMemberData?: boolean;
}

export default function PublicBookingExperience({
  professional,
  services: rawServices,
  slots: rawSlots,
  themeConfig,
  previewMode = false,
  teamMembers = [],
  activeProfessionalId,
  activeWhatsapp,
  onSelectMember,
  loadingMemberData = false,
}: PublicBookingExperienceProps) {
  const theme = themeConfig ?? professional.themeConfig ?? getDefaultThemeConfig();

  // In preview mode use real data if available, else fall back to demo data
  const services = rawServices.length > 0 ? rawServices : previewMode ? DEMO_SERVICES : rawServices;
  const slots = rawSlots.length > 0 ? rawSlots : previewMode ? DEMO_SLOTS : rawSlots;

  const hasTeam = teamMembers.length > 0;
  const [step, setStep] = useState(hasTeam ? 0 : 1);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [desiredDate, setDesiredDate] = useState("");
  const [desiredTime, setDesiredTime] = useState("");
  const serviceFooterRef = React.useRef<HTMLDivElement>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [clientNome, setClientNome] = useState("");
  const [clientTelefone, setClientTelefone] = useState("");
  // Nome mascarado ("Maria S.") quando o telefone já tem cadastro com este profissional
  const [recognizedName, setRecognizedName] = useState<string | null>(null);
  const [clientObservacao, setClientObservacao] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [whatsappUrl, setWhatsappUrl] = useState("");
  // "Agendar de novo" / "Remarcar" vindos da consulta de agendamentos
  const [pendingRebook, setPendingRebook] = useState<{ pid?: string; servicoIds: string[] } | null>(null);
  const [rescheduleOf, setRescheduleOf] = useState<{ id: string; data: string; horario: string } | null>(null);
  const [rebookNotice, setRebookNotice] = useState("");
  const [wasRescheduled, setWasRescheduled] = useState(false);

  const startRebook = (request: RebookRequest) => {
    setError("");
    setRebookNotice("");
    setSelectedDate("");
    setSelectedSlot(null);
    setRescheduleOf(request.reschedule ?? null);
    setClientTelefone(maskPhone(request.telefone));
    // Com equipe, troca para o profissional do agendamento; os serviços dele chegam depois (ver abaixo)
    if (hasTeam && request.pid && request.pid !== activeProfessionalId) onSelectMember?.(request.pid);
    setPendingRebook({ pid: request.pid, servicoIds: request.servicoIds });
  };

  // Quando os serviços do profissional certo estão carregados, marca os mesmos serviços e vai para data e horário.
  // (Ajuste de estado durante a renderização, como recomenda o React, em vez de efeito.)
  if (pendingRebook && !loadingMemberData && (!hasTeam || !pendingRebook.pid || activeProfessionalId === pendingRebook.pid)) {
    const found = services.filter((sv) => pendingRebook.servicoIds.includes(sv.id) && sv.ativo !== false);
    setPendingRebook(null);
    setSelectedServices(found);
    setStep(found.length > 0 ? 2 : 1);
    setRebookNotice(
      found.length === 0
        ? "O serviço anterior não está mais disponível. Escolha um serviço para continuar."
        : found.length < pendingRebook.servicoIds.length
          ? "Um dos serviços anteriores não está mais disponível. Confira os serviços antes de concluir."
          : ""
    );
  }

  const toggleService = (service: Service) => {
    const adding = !selectedServices.some(s => s.id === service.id);
    setSelectedServices(prev =>
      prev.some(s => s.id === service.id)
        ? prev.filter(s => s.id !== service.id)
        : [...prev, service]
    );
    setError("");
    // Ao escolher um serviço, desce até o resumo e o botão "Escolher Data & Horário"
    if (adding) {
      window.setTimeout(() => serviceFooterRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 50);
    }
  };

  const totalPreco = selectedServices.reduce((sum, s) => sum + (s.preco ?? 0), 0);
  const totalDuracaoMin = selectedServices.reduce((sum, s) => sum + parseDuracaoMin(s.duracaoEstimada), 0);
  const hasPrecoVisivel = selectedServices.some(s => s.preco != null && (s.exibirPreco ?? true));

  const corBrand = theme.primaryColor;

  const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const MONTHS_PT = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const todaySP = getSaoPauloToday();
  const todayYear = parseInt(todaySP.split("-")[0]);
  const todayMonth = parseInt(todaySP.split("-")[1]) - 1;

  const groupedSlots = slots.reduce((acc: Record<string, AvailableSlot[]>, slot) => {
    if (!acc[slot.data]) acc[slot.data] = [];
    acc[slot.data].push(slot);
    return acc;
  }, {});

  const [currentYear, setCurrentYear] = useState(() => {
    if (selectedDate) return parseInt(selectedDate.split("-")[0]);
    const firstDate = Object.keys(groupedSlots).sort()[0];
    return firstDate ? parseInt(firstDate.split("-")[0]) : todayYear;
  });
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (selectedDate) return parseInt(selectedDate.split("-")[1]) - 1;
    const firstDate = Object.keys(groupedSlots).sort()[0];
    return firstDate ? parseInt(firstDate.split("-")[1]) - 1 : todayMonth;
  });

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const isPrevDisabled = currentYear < todayYear || (currentYear === todayYear && currentMonth <= todayMonth);

  const slotsDates = Object.keys(groupedSlots).sort();
  const lastSlotDate = slotsDates[slotsDates.length - 1];
  const maxYear = lastSlotDate ? parseInt(lastSlotDate.split("-")[0]) : todayYear;
  const maxMonth = lastSlotDate ? parseInt(lastSlotDate.split("-")[1]) - 1 : todayMonth + 2;

  const isNextDisabled = currentYear > maxYear || (currentYear === maxYear && currentMonth >= maxMonth);

  const daysInMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 12, 0, 0)).getUTCDate();
  const firstDayIndex = new Date(Date.UTC(currentYear, currentMonth, 1, 12, 0, 0)).getUTCDay();

  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push(d);
  }

  const handlePhoneInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const cleaned = rawValue.replace(/\D/g, "");
    
    let formatted = "";
    if (cleaned.length === 0) {
      formatted = "";
    } else if (cleaned.length <= 2) {
      formatted = `(${cleaned}`;
    } else if (cleaned.length <= 6) {
      formatted = `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
    } else if (cleaned.length <= 10) {
      formatted = `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    } else {
      formatted = `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
    }
    
    setClientTelefone(formatted);
  };

  const handleNextStep = () => {
    if (step === 0 && !activeProfessionalId) { setError("Por favor, selecione um profissional para prosseguir."); return; }
    if (step === 1 && selectedServices.length === 0) { setError("Por favor, selecione ao menos um serviço para prosseguir."); return; }
    if (step === 2 && (!selectedDate || !selectedSlot)) { setError("Por favor, escolha uma data e horário."); return; }
    setError("");
    setStep(step + 1);
  };

  // Primeiros 3 horários livres de cada dia da janela de agendamento. Em produção o servidor calcula (expediente + agendamentos ativos);
  // no modo preview usa o cálculo local sobre os slots de demonstração.
  const slotStepMin = professional.agendaConfig?.duracaoSlot || 30;
  const slotSuggestionOn = professional.slotSuggestion?.enabled !== false;
  const [serverNextSlots, setServerNextSlots] = useState<AvailableSlot[] | null>(null);
  const [loadingNextSlots, setLoadingNextSlots] = useState(false);
  const DAYS_PER_PAGE = 5;
  const [visibleDays, setVisibleDays] = useState(DAYS_PER_PAGE);
  const [nextSlotsError, setNextSlotsError] = useState(false);
  const selectedServiceIdsKey = selectedServices.map(s => s.id).join(",");
  const currentProfId = activeProfessionalId ?? professional.id;

  useEffect(() => {
    if (previewMode || !slotSuggestionOn || step !== 2 || !selectedServiceIdsKey) return;
    let cancelled = false;
    setLoadingNextSlots(true);
    setNextSlotsError(false);
    setVisibleDays(DAYS_PER_PAGE);
    fetch(`/api/next-slots?professionalId=${encodeURIComponent(currentProfId)}&services=${encodeURIComponent(selectedServiceIdsKey)}`, { cache: "no-store" })
      .then(r => r.ok ? r.json() : Promise.reject(new Error("next-slots " + r.status)))
      .then(data => { if (!cancelled) setServerNextSlots(data.slots ?? []); })
      .catch(() => { if (!cancelled) { setServerNextSlots([]); setNextSlotsError(true); } })
      .finally(() => { if (!cancelled) setLoadingNextSlots(false); });
    return () => { cancelled = true; };
  }, [previewMode, slotSuggestionOn, step, selectedServiceIdsKey, currentProfId]);

  const freeKeys = new Set(slots.map(sl => `${sl.data}|${sl.horario}`));
  const slotsNeeded = Math.max(1, Math.ceil((totalDuracaoMin || slotStepMin) / slotStepMin));
  const localNextSlots = slots
    .filter(sl => !isTooSoonForPublicBooking(sl.data, sl.horario))
    .filter(sl => {
      const start = timeToMinutes(sl.horario);
      for (let i = 1; i < slotsNeeded; i++) {
        if (!freeKeys.has(`${sl.data}|${minutesToTime(start + i * slotStepMin)}`)) return false;
      }
      return true;
    })
    .filter((sl, _i, arr) => arr.filter(o => o.data === sl.data).indexOf(sl) < 3);
  const nextSlots = previewMode ? localNextSlots : (serverNextSlots ?? []);

  useEffect(() => {
    const digits = clientTelefone.replace(/\D/g, "");
    if (previewMode || digits.length < 10) { setRecognizedName(null); return; }
    let cancelled = false;
    const timer = setTimeout(() => {
      fetch(`/api/customer-lookup?professionalId=${encodeURIComponent(currentProfId)}&phone=${digits}`, { cache: "no-store" })
        .then(r => r.ok ? r.json() : { found: false })
        .then(data => { if (!cancelled) setRecognizedName(data.found && data.display ? String(data.display) : null); })
        .catch(() => { if (!cancelled) setRecognizedName(null); });
    }, 450);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [clientTelefone, currentProfId, previewMode]);

  const handleRequestOtherTimes = () => {
    const message = buildOtherTimesMessage({
      template: professional.slotSuggestion?.requestMessage,
      servicos: selectedServices.map(s => s.nome).join(", "),
      desiredDate,
      desiredTime,
    });
    window.open(getWhatsAppLink(activeWhatsapp ?? professional.telefoneWhatsapp, message), "_blank", "noopener,noreferrer");
  };

  const handlePrevStep = () => { setError(""); setStep(step - 1); };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedServices.length === 0 || !selectedSlot) return;
    setError("");

    // Preview mode: block all real operations
    if (previewMode) {
      setStep(4);
      return;
    }

    setSubmitting(true);

    const typedNome = normalizeName(clientNome);
    const useRegistered = !!recognizedName;
    let trimmedNome = useRegistered ? recognizedName! : typedNome;
    if (!useRegistered && (!isFullName(typedNome) || typedNome.length > 80)) {
      setError(FULL_NAME_ERROR);
      setSubmitting(false);
      return;
    }
    const formattedClientPhone = clientTelefone.replace(/\D/g, "");
    if (formattedClientPhone.length < 10 || formattedClientPhone.length > 20) {
      setError("O telefone com WhatsApp deve ter entre 10 e 20 dígitos (incluindo o DDD).");
      setSubmitting(false);
      return;
    }
    const trimmedObservacao = clientObservacao.trim();
    if (trimmedObservacao.length > 500) {
      setError("A observação deve conter no máximo 500 caracteres.");
      setSubmitting(false);
      return;
    }
    if (isTooSoonForPublicBooking(selectedSlot.data, selectedSlot.horario)) {
      setError("Este horário exige pelo menos 2 horas de antecedência. Escolha outro horário ou peça outras opções.");
      setSubmitting(false);
      return;
    }

    try {
      // Tenta anexar token Bearer se o usuário estiver autenticado.
      // Se getIdToken falhar (token expirado), NÃO fazemos fallback silencioso:
      // enviamos o header com o token inválido e o servidor retornará 401.
      // O usuário verá uma mensagem clara em vez de criar um agendamento anônimo achando que está vinculado.
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const currentUser = auth.currentUser;
      if (currentUser) {
        const token = await currentUser.getIdToken();
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("/api/bookings/create", {
        method: "POST",
        headers,
        body: JSON.stringify({
          professionalId: activeProfessionalId ?? professional.id,
          servicos: selectedServices.map(s => ({ id: s.id })),
          nome: useRegistered ? undefined : trimmedNome,
          usarCadastro: useRegistered ? true : undefined,
          telefone: formattedClientPhone,
          dataEscolhida: selectedSlot.data,
          horarioEscolhido: selectedSlot.horario,
          observacao: trimmedObservacao,
          remarcarDe: rescheduleOf?.id,
        }),
      });
      const resText = await response.text();
      let resData: any = {};
      try {
        resData = JSON.parse(resText);
      } catch (parseErr) {
        console.error("Server returned non-JSON response:", resText);
        // Expose a clean message with the raw HTML or status text
        const cleanText = resText
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        const snippet = cleanText.slice(0, 250);
        throw new Error(`Erro do servidor (HTTP ${response.status}): ${snippet || response.statusText}`);
      }

      // 401 → sessão expirada: redireciona para login preservando página atual
      if (response.status === 401) {
        const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/login?returnUrl=${returnUrl}`;
        return;
      }

      if (!response.ok) throw new Error(resData.error || "Erro ao criar agendamento.");

      // O servidor pode substituir o nome pelo já cadastrado para este telefone
      if (typeof resData.nome === "string" && resData.nome) trimmedNome = resData.nome;

      const [year, month, day] = selectedSlot.data.split("-");
      const friendlyDate = `${day}/${month}/${year}`;

      const linhasServicos = selectedServices.map(s => {
        const temPreco = s.preco != null && (s.exibirPreco ?? true);
        return temPreco
          ? `• ${s.nome} — ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(s.preco!)}`
          : `• ${s.nome}`;
      }).join("\n");

      const totalLine = hasPrecoVisivel
        ? `\n\nTotal: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalPreco)} · Duração estimada: ~${formatDuracao(totalDuracaoMin)}`
        : `\n\nDuração estimada: ~${formatDuracao(totalDuracaoMin)}`;

      const oldDay = rescheduleOf ? rescheduleOf.data.split("-").reverse().join("/") : "";
      const message = rescheduleOf
        ? `Olá, meu nome é ${trimmedNome}. Remarquei meu horário de ${oldDay} às ${rescheduleOf.horario} para ${friendlyDate} às ${selectedSlot.horario}:\n\n${linhasServicos}${totalLine}`
        : `Olá, meu nome é ${trimmedNome}. Gostaria de verificar disponibilidade para ${friendlyDate} às ${selectedSlot.horario}:\n\n${linhasServicos}${totalLine}`;
      setWasRescheduled(!!rescheduleOf);
      setRescheduleOf(null);
      const redirectUrl = getWhatsAppLink(activeWhatsapp ?? professional.telefoneWhatsapp, message);
      setWhatsappUrl(redirectUrl);
      setStep(4);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Ocorreu um erro ao registrar sua solicitação.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDateTitle = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const formatted = date.toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  const cardRadiusStyle = { borderRadius: `${theme.cardRadius}px` };
  const slotDayStripes = getSlotDayStripeStyles(theme.primaryColor);
  // Avisos do passo de dados (pré-agendamento, cadastro encontrado): texto do tema sobre um tom leve da cor
  // principal, legível em qualquer tema (antes eram amarelo e verde claros, com pouco contraste).
  const noticeStyle: React.CSSProperties = {
    backgroundColor: hexToRgba(theme.primaryColor, 0.08) ?? "rgba(128,128,128,0.08)",
    border: `1px solid ${hexToRgba(theme.primaryColor, 0.3) ?? "rgba(128,128,128,0.3)"}`,
    color: "var(--theme-text)",
  };

  let cardClass = "";
  switch (theme.cardStyle) {
    case "flat":     cardClass = "bg-[var(--theme-surface)] border-transparent"; break;
    case "bordered": cardClass = "bg-[var(--theme-surface)] border border-[rgba(255,255,255,0.08)]"; break;
    case "elevated": cardClass = "bg-[var(--theme-surface)] border-transparent shadow-2xl shadow-black/20"; break;
    case "glass":    cardClass = "bg-[rgba(15,23,42,0.4)] backdrop-blur-md border border-[rgba(255,255,255,0.08)]"; break;
    default:         cardClass = "bg-[var(--theme-surface)] border border-[rgba(255,255,255,0.08)]";
  }

  let btnRadiusClass = "";
  if (theme.buttonStyle === "square")   btnRadiusClass = "rounded-none";
  else if (theme.buttonStyle === "soft") btnRadiusClass = "rounded-lg";
  else if (theme.buttonStyle === "rounded") btnRadiusClass = "rounded-2xl";
  else if (theme.buttonStyle === "pill") btnRadiusClass = "rounded-full";

  return (
    <PublicThemeProvider themeConfig={theme}>
      <div className="flex-1 flex flex-col items-center justify-start min-h-screen relative overflow-hidden px-4 py-8 md:py-16">

        {/* Preview mode banner — sticky inside scroll container, never overlaps modal top bar */}
        {previewMode && (
          <div className="sticky top-0 left-0 right-0 z-40 w-full bg-indigo-600/95 backdrop-blur-sm text-white text-xs font-bold text-center py-1.5 tracking-wide -mx-4 px-4 mb-2">
            MODO PRÉVIA — nenhuma ação será salva
          </div>
        )}

        {theme.backgroundType === "solid" && (
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full blur-[120px] pointer-events-none opacity-15"
            style={{ backgroundColor: corBrand }}
          />
        )}

        <div className={`w-full max-w-xl z-10 space-y-6 ${previewMode ? "mt-6" : ""}`}>

          {/* Header */}
          <PublicProfessionalHeader
            profile={professional}
            theme={theme}
            isPreview={previewMode}
          />

          {!previewMode && step < 4 && professional.slugPublico && (
            <AppointmentLookup
              slug={professional.slugPublico}
              primaryColor={theme.primaryColor}
              primaryTextColor={getBestTextColor(theme.primaryColor)}
              btnRadiusClass={btnRadiusClass}
              cardRadius={theme.cardRadius}
              onRebook={startRebook}
            />
          )}

          {/* Step indicator */}
          {step < 4 && (
            <div
              className="backdrop-blur-sm rounded-2xl px-3 py-2.5 flex justify-between items-center text-[10px] sm:text-xs font-semibold"
              style={{
                backgroundColor: "var(--theme-surface)",
                border: "1px solid rgba(var(--theme-text-rgb, 0,0,0), 0.08)",
                color: "var(--theme-muted-text)",
              }}
            >
              {hasTeam && (
                <>
                  <span className="font-black" style={step === 0 ? { color: "var(--theme-primary)" } : { color: "var(--theme-muted-text)", opacity: 0.5 }}>
                    <span className="sm:hidden">1. Prof.</span>
                    <span className="hidden sm:inline">1. Profissional</span>
                  </span>
                  <ChevronRight className="h-3 w-3 opacity-30 shrink-0" style={{ color: "var(--theme-muted-text)" }} />
                </>
              )}
              <span className="font-black" style={step === 1 ? { color: "var(--theme-primary)" } : { color: "var(--theme-muted-text)", opacity: 0.5 }}>
                {hasTeam ? "2." : "1."} Serviço
              </span>
              <ChevronRight className="h-3 w-3 opacity-30 shrink-0" style={{ color: "var(--theme-muted-text)" }} />
              <span className="font-black" style={step === 2 ? { color: "var(--theme-primary)" } : { color: "var(--theme-muted-text)", opacity: 0.5 }}>
                {hasTeam ? "3." : "2."} Horário
              </span>
              <ChevronRight className="h-3 w-3 opacity-30 shrink-0" style={{ color: "var(--theme-muted-text)" }} />
              <span className="font-black" style={step === 3 ? { color: "var(--theme-primary)" } : { color: "var(--theme-muted-text)", opacity: 0.5 }}>
                <span className="sm:hidden">{hasTeam ? "4." : "3."} Dados</span>
                <span className="hidden sm:inline">{hasTeam ? "4." : "3."} Seus Dados</span>
              </span>
            </div>
          )}

          {/* Wizard card */}
          <div style={cardRadiusStyle} className={`p-6 md:p-8 shadow-2xl relative ${cardClass}`}>
            {rescheduleOf && step < 4 && (
              <div className="mb-4 rounded-xl border border-[rgba(128,128,128,0.35)] p-3 text-xs text-[var(--theme-text)]">
                <p className="font-bold">Remarcando o horário de {formatDateTitle(rescheduleOf.data)} às {rescheduleOf.horario}</p>
                <p className="mt-1 text-[var(--theme-muted-text)]">Escolha o novo horário. O horário atual só é cancelado quando você concluir.</p>
                <button type="button" onClick={() => { setRescheduleOf(null); setRebookNotice(""); }} className="mt-2 font-semibold underline" style={{ color: corBrand }}>
                  Desistir de remarcar
                </button>
              </div>
            )}
            {rebookNotice && step < 4 && (
              <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-medium text-[var(--theme-text)]">{rebookNotice}</div>
            )}
            {error && (
              <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex gap-3 items-center">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p className="font-medium">{error}</p>
              </div>
            )}

            {/* STEP 0 — Escolha do profissional (só aparece quando há equipe) */}
            {step === 0 && hasTeam && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-[var(--theme-text)] mb-1" style={{ fontFamily: "var(--theme-heading-font)" }}>Escolha o profissional</h2>
                  <p className="text-xs text-[var(--theme-muted-text)]">Selecione com quem você gostaria de ser atendido.</p>
                </div>

                <div className="space-y-3 pt-2">
                  {/* Owner card */}
                  {[
                    { id: professional.id, nome: professional.nome, especialidade: (professional as any).especialidade ?? "", fotoLogoUrl: professional.fotoLogoUrl ?? null },
                    ...teamMembers,
                  ].map((member) => {
                    const isSelected = activeProfessionalId === member.id;
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => { onSelectMember?.(member.id); setError(""); setSelectedServices([]); setSelectedDate(""); setSelectedSlot(null); setRescheduleOf(null); setRebookNotice(""); }}
                        style={{
                          borderRadius: `${theme.cardRadius}px`,
                          borderColor: isSelected ? corBrand : undefined,
                          boxShadow: isSelected ? `0 0 0 1px ${corBrand}` : undefined,
                        }}
                        className={`w-full text-left flex items-center gap-4 p-4 transition-all duration-200 ${cardClass} ${!isSelected ? "hover:border-[rgba(255,255,255,0.2)]" : ""}`}
                      >
                        <div
                          style={{ borderRadius: `${Math.max(0, theme.cardRadius - 4)}px` }}
                          className="h-14 w-14 shrink-0 overflow-hidden border border-[rgba(255,255,255,0.08)] bg-slate-950/60 flex items-center justify-center"
                        >
                          {member.fotoLogoUrl
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={member.fotoLogoUrl} alt={member.nome} className="h-full w-full object-cover object-center" />
                            : <span className="text-xl font-black" style={{ color: corBrand }}>{member.nome[0]}</span>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[var(--theme-text)] text-sm">{member.nome}</p>
                          {member.especialidade && <p className="text-xs mt-0.5" style={{ color: corBrand }}>{member.especialidade}</p>}
                        </div>
                        {isSelected && (
                          <div className="shrink-0 h-6 w-6 rounded-full flex items-center justify-center" style={{ backgroundColor: corBrand }}>
                            <Check className="h-3.5 w-3.5" style={{ color: getBestTextColor(corBrand) }} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {loadingMemberData && (
                  <div className="flex items-center justify-center gap-2 py-2 text-xs text-[var(--theme-muted-text)]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Carregando agenda...</span>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleNextStep}
                    disabled={!activeProfessionalId || loadingMemberData}
                    style={{ backgroundColor: corBrand, color: getBestTextColor(corBrand) }}
                    className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm transition-all disabled:opacity-40 ${btnRadiusClass}`}
                  >
                    <span>Continuar</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 1 */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-[var(--theme-text)] mb-1" style={{ fontFamily: "var(--theme-heading-font)" }}>Escolha os serviços desejados</h2>
                  <p className="text-xs text-[var(--theme-muted-text)]">Você pode selecionar mais de um serviço. Os valores e tempo serão somados automaticamente.</p>
                </div>
                {services.length === 0 ? (
                  <div style={cardRadiusStyle} className="text-center py-10 text-[var(--theme-muted-text)] text-sm border border-dashed border-[rgba(128,128,128,0.2)]">
                    Nenhum serviço disponível no momento.
                  </div>
                ) : (
                  <div className="space-y-3 pt-2">
                    {services.map((service) => (
                      <PublicServiceCard
                        key={service.id}
                        service={service}
                        isSelected={selectedServices.some(s => s.id === service.id)}
                        onSelect={() => toggleService(service)}
                        showServiceImages={theme.showServiceImages}
                        cardStyle={theme.cardStyle}
                        cardRadius={theme.cardRadius}
                        primaryColor={theme.primaryColor}
                      />
                    ))}
                  </div>
                )}

                {/* Barra de totais — aparece quando há ao menos 1 serviço selecionado */}
                {selectedServices.length > 0 && (
                  <div style={{ ...cardRadiusStyle, borderColor: `${theme.primaryColor}30`, backgroundColor: `${theme.primaryColor}08` }} className="border px-4 py-3 flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2 text-[var(--theme-muted-text)]">
                      <Check className="h-3.5 w-3.5" style={{ color: theme.primaryColor }} />
                      <span>{selectedServices.length} serviço{selectedServices.length > 1 ? "s" : ""} selecionado{selectedServices.length > 1 ? "s" : ""}</span>
                    </div>
                    <div className="flex items-center gap-3 font-semibold">
                      {hasPrecoVisivel && (
                        <span style={{ color: theme.primaryColor }}>
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalPreco)}
                        </span>
                      )}
                      <span className="text-[var(--theme-muted-text)] text-xs flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        ~{formatDuracao(totalDuracaoMin)}
                      </span>
                    </div>
                  </div>
                )}

                <div ref={serviceFooterRef} className={`pt-2 flex gap-3 scroll-mb-6 ${hasTeam ? "justify-between" : ""}`}>
                  {hasTeam && (
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      className={`flex items-center gap-1.5 px-4 py-3 font-semibold text-sm transition-all text-[var(--theme-muted-text)] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.2)] ${btnRadiusClass}`}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span>Voltar</span>
                    </button>
                  )}
                  <button
                    onClick={handleNextStep}
                    disabled={selectedServices.length === 0}
                    style={selectedServices.length > 0 ? { backgroundColor: theme.primaryColor, color: getBestTextColor(theme.primaryColor), fontFamily: "var(--theme-body-font)" } : {}}
                    className={`${hasTeam ? "" : "w-full"} flex-1 py-3.5 px-4 font-semibold text-sm transition-all shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] ${btnRadiusClass} ${selectedServices.length === 0 ? "bg-slate-800 text-slate-500 cursor-not-allowed shadow-none" : "hover:brightness-110"}`}
                  >
                    <span>Escolher Data & Horário</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-[var(--theme-text)] mb-1" style={{ fontFamily: "var(--theme-heading-font)" }}>Selecione data e hora</h2>
                  <p className="text-xs text-[var(--theme-muted-text)]">{slotSuggestionOn ? "Veja os primeiros horários livres de cada dia." : "Veja a disponibilidade de nossa agenda em tempo real."}</p>
                </div>
                {slotSuggestionOn ? (
                <>
                {(loadingNextSlots && !previewMode) ? (
                  <div style={cardRadiusStyle} className="text-center py-10 text-[var(--theme-muted-text)] text-sm">Buscando horários livres...</div>
                ) : nextSlots.length === 0 ? (
                  <div style={cardRadiusStyle} className="text-center py-10 text-[var(--theme-muted-text)] text-sm border border-dashed border-[rgba(128,128,128,0.2)]">
                    <p>Nenhum horário disponível nos próximos dias.</p>
                  </div>
                ) : (
                  <div className="space-y-3 pt-1">
                    <label className="block text-xs font-semibold text-[var(--theme-muted-text)] uppercase tracking-wider">Horários livres por dia</label>
                    <div className="space-y-3">
                      {Object.entries(nextSlots.reduce((acc: Record<string, AvailableSlot[]>, sl) => { (acc[sl.data] ||= []).push(sl); return acc; }, {})).slice(0, visibleDays).map(([dateKey, daySlots]) => (
                        <div key={dateKey} style={cardRadiusStyle} className="overflow-hidden border border-[rgba(128,128,128,0.15)]">
                          <div style={slotDayStripes.dateRow} className="px-3 py-2 text-xs font-bold text-[var(--theme-text)] capitalize">{formatDateTitle(dateKey)}</div>
                          <div style={slotDayStripes.slotsRow} className="grid grid-cols-3 gap-2 p-2">
                            {daySlots.map((slot) => {
                              const isSelected = selectedSlot?.id === slot.id;
                              return (
                                <button
                                  key={slot.id}
                                  type="button"
                                  onClick={() => { setSelectedDate(slot.data); setSelectedSlot(slot); }}
                                  style={isSelected ? { backgroundColor: theme.primaryColor, borderColor: theme.primaryColor, color: getBestTextColor(theme.primaryColor) } : {}}
                                  className={`py-2.5 px-1.5 border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${btnRadiusClass} ${isSelected ? "shadow-md" : "bg-[var(--theme-surface)]/60 border-[rgba(255,255,255,0.08)] text-[var(--theme-text)] hover:border-[rgba(255,255,255,0.2)]"}`}
                                >
                                  <Clock className="h-3.5 w-3.5 opacity-60" />
                                  <span>{slot.horario}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    {new Set(nextSlots.map(sl => sl.data)).size > visibleDays && (
                      <button
                        type="button"
                        onClick={() => setVisibleDays(v => v + DAYS_PER_PAGE)}
                        className={`w-full py-2.5 px-4 border border-[rgba(255,255,255,0.15)] text-[var(--theme-text)] text-sm font-semibold hover:bg-[rgba(255,255,255,0.05)] transition-all ${btnRadiusClass}`}
                      >
                        Ver mais dias
                      </button>
                    )}
                  </div>
                )}
                </>
                ) : (
                <>
                {Object.keys(groupedSlots).length === 0 ? (
                  <div style={cardRadiusStyle} className="text-center py-10 text-[var(--theme-muted-text)] text-sm border border-dashed border-[rgba(128,128,128,0.2)]">
                    Nenhum horário disponível nos próximos dias.
                  </div>
                ) : (
                  <div className="space-y-5 pt-1">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--theme-muted-text)] uppercase tracking-wider mb-3">1. Escolha a data</label>
                      
                      {/* Calendar Container */}
                      <div className="border border-[rgba(255,255,255,0.08)] bg-[var(--theme-surface)]/20 p-4 rounded-2xl">
                        {/* Month Selector */}
                        <div className="flex items-center justify-between mb-4 px-1">
                          <button
                            type="button"
                            onClick={handlePrevMonth}
                            disabled={isPrevDisabled}
                            className={`p-1.5 rounded-lg border border-[rgba(255,255,255,0.08)] text-[var(--theme-text)] transition-all ${isPrevDisabled ? "opacity-30 cursor-not-allowed" : "hover:bg-[rgba(255,255,255,0.05)] cursor-pointer"}`}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          
                          <span className="text-sm font-bold text-[var(--theme-text)] capitalize">
                            {MONTHS_PT[currentMonth]} {currentYear}
                          </span>
                          
                          <button
                            type="button"
                            onClick={handleNextMonth}
                            disabled={isNextDisabled}
                            className={`p-1.5 rounded-lg border border-[rgba(255,255,255,0.08)] text-[var(--theme-text)] transition-all ${isNextDisabled ? "opacity-30 cursor-not-allowed" : "hover:bg-[rgba(255,255,255,0.05)] cursor-pointer"}`}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                        
                        {/* Weekdays */}
                        <div className="grid grid-cols-7 gap-1 text-center mb-2">
                          {WEEKDAYS.map((day) => (
                            <span key={day} className="text-[10px] font-black text-[var(--theme-muted-text)] uppercase tracking-wider">
                              {day}
                            </span>
                          ))}
                        </div>
                        
                        {/* Days Grid */}
                        <div className="grid grid-cols-7 gap-1.5 text-center">
                          {calendarCells.map((day, index) => {
                            if (day === null) {
                              return <div key={`empty-${index}`} className="aspect-square" />;
                            }
                            
                            const dateKey = `${currentYear}-${(currentMonth + 1).toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
                            const daySlots = groupedSlots[dateKey] || [];
                            const hasSlots = daySlots.some(slot => !isTooSoonForPublicBooking(slot.data, slot.horario));
                            const isSelected = selectedDate === dateKey;
                            const isToday = todaySP === dateKey;
                            
                            return (
                              <button
                                key={dateKey}
                                type="button"
                                disabled={!hasSlots}
                                onClick={() => { setSelectedDate(dateKey); setSelectedSlot(null); }}
                                style={isSelected ? { backgroundColor: theme.primaryColor, borderColor: theme.primaryColor, color: getBestTextColor(theme.primaryColor) } : {}}
                                className={`
                                  aspect-square w-full rounded-xl flex flex-col items-center justify-center text-xs transition-all relative
                                  ${hasSlots 
                                    ? isSelected
                                      ? "font-bold shadow-md shadow-black/20"
                                      : "bg-[var(--theme-surface)]/60 border border-[rgba(255,255,255,0.05)] text-[var(--theme-text)] hover:border-[var(--theme-primary)]/40 hover:bg-[rgba(255,255,255,0.03)] cursor-pointer"
                                    : "text-[var(--theme-text)]/15 cursor-not-allowed border border-transparent"
                                  }
                                `}
                              >
                                <span>{day}</span>
                                {isToday && !isSelected && (
                                  <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-[var(--theme-primary)] animate-pulse" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    {selectedDate && (
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-[var(--theme-muted-text)] uppercase tracking-wider mb-1">2. Escolha o horário</label>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {groupedSlots[selectedDate]
                            .filter((slot) => !isTooSoonForPublicBooking(slot.data, slot.horario))
                            .map((slot) => {
                            const isSelected = selectedSlot?.id === slot.id;
                            return (
                              <button
                                key={slot.id}
                                onClick={() => setSelectedSlot(slot)}
                                style={isSelected ? { backgroundColor: theme.primaryColor, borderColor: theme.primaryColor, color: getBestTextColor(theme.primaryColor) } : {}}
                                className={`py-2.5 px-1.5 border text-xs font-bold text-center flex items-center justify-center gap-1.5 transition-all ${btnRadiusClass} ${isSelected ? "shadow-md" : "bg-[var(--theme-surface)]/60 border-[rgba(255,255,255,0.08)] text-[var(--theme-text)] hover:border-[rgba(255,255,255,0.2)]"}`}
                              >
                                <Clock className="h-3.5 w-3.5 opacity-60" />
                                <span>{slot.horario}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                </>
                )}
                {!previewMode && (
                  <div style={cardRadiusStyle} className="border border-[rgba(128,128,128,0.35)] bg-[var(--theme-surface)] p-4 space-y-3">
                    <p className="text-sm font-bold text-[var(--theme-text)]">Não encontrou o dia ou horário que queria?</p>
                    <p className="text-xs text-[var(--theme-text)] opacity-75">Informe a data e o horário desejados e peça outras opções pelo WhatsApp.</p>
                    {/* min-w-0 + appearance-none: no iPhone o campo de data tem largura própria e saía da caixa */}
                    <div className="grid grid-cols-2 gap-2">
                      <label className="min-w-0 block">
                        <span className="block text-[11px] font-semibold text-[var(--theme-muted-text)] mb-1">Data</span>
                        <input
                          type="date"
                          min={todaySP}
                          value={desiredDate}
                          onChange={(e) => setDesiredDate(e.target.value)}
                          aria-label="Data desejada"
                          className="block w-full min-w-0 max-w-full box-border appearance-none h-11 px-3 rounded-xl bg-[var(--theme-surface)] border border-[rgba(128,128,128,0.45)] text-sm text-left text-[var(--theme-text)]"
                        />
                      </label>
                      <label className="min-w-0 block">
                        <span className="block text-[11px] font-semibold text-[var(--theme-muted-text)] mb-1">Horário</span>
                        <select
                          value={desiredTime}
                          onChange={(e) => setDesiredTime(e.target.value)}
                          aria-label="Horário desejado"
                          className="block w-full min-w-0 max-w-full box-border appearance-none h-11 px-3 rounded-xl bg-[var(--theme-surface)] border border-[rgba(128,128,128,0.45)] text-sm text-[var(--theme-text)]"
                        >
                          <option value="">Qualquer</option>
                          {DESIRED_HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={handleRequestOtherTimes}
                      style={{ backgroundColor: theme.primaryColor, color: getBestTextColor(theme.primaryColor), fontFamily: "var(--theme-body-font)" }}
                      className={`w-full py-3 px-4 text-sm font-semibold shadow-md hover:brightness-110 active:scale-[0.98] transition-all ${btnRadiusClass}`}
                    >
                      Pedir outras opções de horário
                    </button>
                  </div>
                )}
                <div className="flex gap-3 pt-4">
                  <button onClick={handlePrevStep} className={`flex-1 py-3.5 bg-[var(--theme-surface)] hover:opacity-90 text-[var(--theme-text)] border border-[rgba(128,128,128,0.2)] font-semibold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 ${btnRadiusClass}`}>
                    <ChevronLeft className="h-4 w-4" /><span>Voltar</span>
                  </button>
                  <button
                    onClick={handleNextStep}
                    disabled={!selectedDate || !selectedSlot}
                    style={(selectedDate && selectedSlot) ? { backgroundColor: theme.primaryColor, color: getBestTextColor(theme.primaryColor), fontFamily: "var(--theme-body-font)" } : {}}
                    className={`flex-[2] py-3.5 px-4 font-semibold text-sm transition-all shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] ${btnRadiusClass} ${(!selectedDate || !selectedSlot) ? "bg-slate-800 text-slate-500 cursor-not-allowed shadow-none" : "hover:brightness-110"}`}
                  >
                    <span>Preencher Seus Dados</span><ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3 */}
            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-[var(--theme-text)] mb-1" style={{ fontFamily: "var(--theme-heading-font)" }}>Informe seus dados para contato</h2>
                  <p className="text-xs text-[var(--theme-muted-text)]">Suas informações serão salvas no sistema de pré-agendamento.</p>
                </div>
                <div style={cardRadiusStyle} className="bg-[var(--theme-surface)]/60 border border-[rgba(255,255,255,0.08)] p-4 text-xs space-y-2 text-[var(--theme-text)]">
                  {selectedSlot && (
                    <p className="flex justify-between items-center pb-2 border-b border-[rgba(255,255,255,0.06)]">
                      <span className="text-[var(--theme-muted-text)]">Data e Horário:</span>
                      <span className="font-bold">{formatDateTitle(selectedSlot.data)} às {selectedSlot.horario}</span>
                    </p>
                  )}
                  <div className="space-y-1.5 pt-1">
                    {selectedServices.map(s => (
                      <p key={s.id} className="flex justify-between items-center">
                        <span className="text-[var(--theme-muted-text)] flex items-center gap-1"><Check className="h-3 w-3" />{s.nome}</span>
                        {s.preco != null && (s.exibirPreco ?? true) && (
                          <span className="font-semibold" style={{ color: theme.primaryColor }}>
                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(s.preco)}
                          </span>
                        )}
                      </p>
                    ))}
                  </div>
                  {(hasPrecoVisivel || selectedServices.length > 1) && (
                    <div className="flex justify-between items-center pt-2 border-t border-[rgba(255,255,255,0.06)]">
                      <span className="text-[var(--theme-muted-text)] flex items-center gap-1">
                        <Clock className="h-3 w-3" />~{formatDuracao(totalDuracaoMin)}
                      </span>
                      {hasPrecoVisivel && (
                        <span className="font-bold text-sm" style={{ color: theme.primaryColor }}>
                          Total: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalPreco)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ ...cardRadiusStyle, ...noticeStyle }} className="flex items-start gap-2.5 px-3 py-2.5 text-xs">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: theme.primaryColor }} />
                  <span>Este é um <strong>pedido de pré-agendamento</strong>. O profissional confirmará o horário com você pelo WhatsApp.</span>
                </div>
                <form onSubmit={handleBookAppointment} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--theme-muted-text)] uppercase tracking-wider mb-2">Telefone com WhatsApp *</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[var(--theme-muted-text)]/60"><Phone className="h-4 w-4" /></span>
                      <input type="text" required maxLength={20} value={clientTelefone} onChange={handlePhoneInputChange} placeholder="Ex: (11) 99999-9999" style={cardRadiusStyle} className="w-full pl-9 pr-4 py-2.5 bg-[var(--theme-surface)] border border-[rgba(255,255,255,0.08)] focus:outline-none focus:border-[var(--theme-primary)] text-[var(--theme-text)] text-sm transition-all" />
                    </div>
                  </div>
                  {recognizedName ? (
                    <div style={{ ...cardRadiusStyle, ...noticeStyle }} className="flex items-center justify-between gap-3 px-3 py-3 text-xs">
                      <span>Olá, <strong>{recognizedName}</strong>! Encontramos seu cadastro. Vamos usar os seus dados salvos.</span>
                      <button type="button" onClick={() => setClientTelefone("")} className="shrink-0 underline font-semibold" style={{ color: theme.primaryColor }}>Não sou eu</button>
                    </div>
                  ) : (
                  <div>
                    <label className="block text-xs font-semibold text-[var(--theme-muted-text)] uppercase tracking-wider mb-2">Seu Nome *</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[var(--theme-muted-text)]/60"><User className="h-4 w-4" /></span>
                      <input type="text" required maxLength={80} value={clientNome} onChange={(e) => setClientNome(e.target.value)} placeholder="Insira seu nome completo" style={cardRadiusStyle} className="w-full pl-9 pr-4 py-2.5 bg-[var(--theme-surface)] border border-[rgba(255,255,255,0.08)] focus:outline-none focus:border-[var(--theme-primary)] text-[var(--theme-text)] text-sm transition-all" />
                    </div>
                  </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-[var(--theme-muted-text)] uppercase tracking-wider mb-2">Observações (Opcional)</label>
                    <div className="relative">
                      <span className="absolute top-3 left-3 text-[var(--theme-muted-text)]/60"><FileText className="h-4 w-4" /></span>
                      <textarea value={clientObservacao} onChange={(e) => setClientObservacao(e.target.value)} maxLength={300} placeholder="Gostaria de detalhar alguma necessidade ou preferência? (Opcional)" rows={2} style={cardRadiusStyle} className="w-full pl-9 pr-4 py-2.5 bg-[var(--theme-surface)] border border-[rgba(255,255,255,0.08)] focus:outline-none focus:border-[var(--theme-primary)] text-[var(--theme-text)] text-sm transition-all resize-none" />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button type="button" onClick={handlePrevStep} disabled={submitting} className={`flex-1 py-3.5 bg-[var(--theme-surface)] hover:opacity-90 text-[var(--theme-text)] border border-[rgba(128,128,128,0.2)] font-semibold text-sm transition-all active:scale-[0.98] ${btnRadiusClass}`}>
                      Voltar
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      style={submitting ? {} : { backgroundColor: theme.primaryColor, color: getBestTextColor(theme.primaryColor), fontFamily: "var(--theme-body-font)" }}
                      className={`flex-[2] py-3.5 px-4 font-semibold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${btnRadiusClass} ${submitting ? "bg-slate-800 text-slate-500 cursor-not-allowed shadow-none" : "hover:brightness-110 shadow-lg"}`}
                    >
                      {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Smartphone className="h-4 w-4" /><span>{previewMode ? "Confirmar (prévia)" : "Enviar pedido de agendamento"}</span></>}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* STEP 4 */}
            {step === 4 && (
              <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                <div className="h-16 w-16 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/5">
                  <MessageCircle className="h-8 w-8" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[var(--theme-text)]" style={{ fontFamily: "var(--theme-heading-font)" }}>
                    {previewMode ? "Prévia: pedido registrado!" : wasRescheduled ? "Remarcação registrada!" : "Pedido registrado!"}
                  </h2>
                  <p className="text-sm text-[var(--theme-muted-text)] max-w-sm mt-2 leading-relaxed">
                    {previewMode
                      ? "Na página real o cliente enviaria a mensagem pelo WhatsApp para confirmar o horário."
                      : wasRescheduled
                        ? "O horário anterior foi cancelado. Envie a mensagem para o profissional pelo WhatsApp: ele confirmará o novo horário com você."
                        : "Agora envie a mensagem para o profissional pelo WhatsApp. Ele confirmará o horário com você em breve."}
                  </p>
                </div>
                {!previewMode && (
                  <div className="pt-2 w-full space-y-3">
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] ${btnRadiusClass}`}
                    >
                      <Smartphone className="h-5 w-5" /><span>Enviar mensagem no WhatsApp</span>
                    </a>
                    <p className="text-xs text-[var(--theme-muted-text)]">
                      O WhatsApp abrirá com a mensagem já preenchida. Basta enviar.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </PublicThemeProvider>
  );
}
