"use client";

import React, { useEffect, useState, use } from "react";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getSaoPauloToday, addDaysSaoPaulo } from "@/lib/timezone";
import { Loader2, AlertCircle } from "lucide-react";
import { normalizeThemeConfig, ThemeConfig } from "@/lib/themeUtils";
import PublicBookingExperience, {
  Professional,
  Service,
  AvailableSlot,
  TeamMemberPublic,
} from "./components/PublicBookingExperience";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export default function PublicBookingPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;

  const [professional, setProfessional] = useState<Professional | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");

  // Team support
  const [teamMembers, setTeamMembers] = useState<TeamMemberPublic[]>([]);
  const [activeProfessionalId, setActiveProfessionalId] = useState<string | undefined>(undefined);
  const [activeWhatsapp, setActiveWhatsapp] = useState<string | undefined>(undefined);
  const [loadingMemberData, setLoadingMemberData] = useState(false);
  const [whatsappMode, setWhatsappMode] = useState<"single" | "per_member">("single");

  const fetchServices = async (profId: string) => {
    try {
      const servicesRef = collection(db, "professionals", profId, "services");
      const q = query(servicesRef, orderBy("nome", "asc"));
      const querySnapshot = await getDocs(q);
      const data: Service[] = [];
      querySnapshot.forEach((doc) => {
        const d = doc.data();
        if (d.ativo === true) {
          data.push({ id: doc.id, ...d } as Service);
        }
      });
      // Ordem definida pelo profissional; sem ordem (cadastros antigos) vêm antes, em ordem alfabética
      data.sort((a, b) => (a.ordem ?? -1) - (b.ordem ?? -1));
      setServices(data);
    } catch (e) {
      console.error("Error loading services:", e);
    }
  };

  const handleSelectMember = async (memberId: string) => {
    setActiveProfessionalId(memberId);
    setLoadingMemberData(true);
    const prof = professional;
    const windowDays = prof?.agendaConfig?.janelaAgendamentoDias ?? 30;

    // Resolve WhatsApp: per_member mode uses member's own whatsapp if set
    if (whatsappMode === "per_member") {
      const member = teamMembers.find((m) => m.id === memberId) as any;
      setActiveWhatsapp(member?.whatsapp || prof?.telefoneWhatsapp);
    } else {
      setActiveWhatsapp(prof?.telefoneWhatsapp);
    }

    await Promise.all([fetchServices(memberId), fetchAvailableSlots(memberId, windowDays)]);
    setLoadingMemberData(false);
  };

  const fetchAvailableSlots = async (profId: string, windowDays: number = 30) => {
    try {
      const slotsRef = collection(db, "professionals", profId, "availableSlots");
      const todayStr = getSaoPauloToday();
      const maxDateStr = addDaysSaoPaulo(todayStr, windowDays);
      const q = query(
        slotsRef,
        orderBy("data", "asc"),
        orderBy("horario", "asc")
      );
      const querySnapshot = await getDocs(q);
      const data: AvailableSlot[] = [];
      querySnapshot.forEach((doc) => {
        const d = doc.data();
        if (
          d.disponivel === true &&
          d.data &&
          d.data >= todayStr &&
          d.data <= maxDateStr
        ) {
          data.push({ id: doc.id, ...d } as AvailableSlot);
        }
      });
      setSlots(data);
    } catch (e) {
      console.error("Error loading slots:", e);
    }
  };

  useEffect(() => {
    const fetchProfessional = async () => {
      try {
        // SEC-004: dados do profissional via endpoint server-side com DTO filtrado.
        // Evita expor campos privados (email, plan, status) ao client SDK.
        const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";
        const res = await fetch(`${APP_URL}/api/p/${encodeURIComponent(slug)}`);
        if (res.status === 404) { setNotFound(true); setLoading(false); return; }
        if (!res.ok) throw new Error(`api/p error ${res.status}`);

        const json = await res.json();
        const profData = json.professional as Professional;

        const rawTheme = (profData.themeConfig || {}) as Partial<ThemeConfig>;
        profData.themeConfig = normalizeThemeConfig({
          ...rawTheme,
          primaryColor: rawTheme.primaryColor || profData.corPrincipal,
        });

        setProfessional(profData);
        const windowDays = profData.agendaConfig?.janelaAgendamentoDias || 30;

        const members: TeamMemberPublic[] = json.teamMembers ?? [];
        const wMode: "single" | "per_member" = json.whatsappMode ?? "single";
        setTeamMembers(members);
        setWhatsappMode(wMode);

        if (members.length === 0) {
          setActiveProfessionalId(profData.id);
          setActiveWhatsapp(profData.telefoneWhatsapp);
          await Promise.all([fetchServices(profData.id), fetchAvailableSlots(profData.id, windowDays)]);
        }
      } catch (err) {
        console.error("Error loading booking page:", err);
        setError("Erro ao carregar dados. Tente novamente mais tarde.");
      } finally {
        setLoading(false);
      }
    };
    fetchProfessional();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-slate-950 min-h-screen">
        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
        <p className="mt-4 text-slate-400 font-medium">Buscando profissional...</p>
      </div>
    );
  }

  if (notFound || !professional) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-slate-950 min-h-screen px-4 text-center">
        <div className="p-4 bg-slate-900 rounded-full text-slate-600 mb-4 border border-slate-800">
          <AlertCircle className="h-10 w-10 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-slate-100">Página Não Encontrada</h1>
        <p className="text-slate-500 text-sm mt-2 max-w-sm">
          O profissional ou negócio correspondente a este endereço não foi encontrado. Certifique-se de que digitou o link correto.
        </p>
      </div>
    );
  }

  return (
    <PublicBookingExperience
      professional={professional}
      services={services}
      slots={slots}
      teamMembers={teamMembers}
      activeProfessionalId={activeProfessionalId}
      activeWhatsapp={activeWhatsapp}
      onSelectMember={handleSelectMember}
      loadingMemberData={loadingMemberData}
    />
  );
}
