"use client";

import React, { useEffect, useState, use } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getSaoPauloToday, addDaysSaoPaulo } from "@/lib/timezone";
import { Loader2, AlertCircle } from "lucide-react";
import { getDefaultThemeConfig, normalizeThemeConfig, ThemeConfig } from "@/lib/themeUtils";
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
  const [loadingMemberData, setLoadingMemberData] = useState(false);

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
      setServices(data);
    } catch (e) {
      console.error("Error loading services:", e);
    }
  };

  const fetchTeamMembers = async (ownerId: string): Promise<TeamMemberPublic[]> => {
    try {
      const q = query(
        collection(db, "professionals"),
        where("parentProfessionalId", "==", ownerId),
        where("role", "==", "team_member"),
        where("professionalStatus", "==", "active"),
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({
        id: d.id,
        nome: d.data().nome ?? "",
        especialidade: d.data().especialidade ?? "",
        fotoLogoUrl: d.data().fotoLogoUrl ?? null,
      }));
    } catch {
      return [];
    }
  };

  const handleSelectMember = async (memberId: string) => {
    setActiveProfessionalId(memberId);
    setLoadingMemberData(true);
    const prof = professional;
    const windowDays = prof?.agendaConfig?.janelaAgendamentoDias ?? 30;
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
        const professionalsRef = collection(db, "professionals");
        const q = query(professionalsRef, where("slugPublico", "==", slug));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) { setNotFound(true); setLoading(false); return; }

        const docSnap = querySnapshot.docs[0];
        const profData = { id: docSnap.id, ...docSnap.data() } as Professional;
        console.log("PUBLIC PAGE LOADED PROFILE DATA:", {
          id: profData.id,
          nomeNegocio: profData.nomeNegocio,
          corPrincipal: profData.corPrincipal,
          themeConfig: profData.themeConfig
        });

        const rawTheme = (profData.themeConfig || {}) as Partial<ThemeConfig>;
        profData.themeConfig = normalizeThemeConfig({
          ...rawTheme,
          primaryColor: rawTheme.primaryColor || profData.corPrincipal
        });

        setProfessional(profData);
        const windowDays = profData.agendaConfig?.janelaAgendamentoDias || 30;

        // Fetch team members; if owner has team don't pre-load services (user picks member first)
        const members = await fetchTeamMembers(docSnap.id);
        setTeamMembers(members);

        if (members.length === 0) {
          // No team — load owner's services/slots immediately (existing flow)
          setActiveProfessionalId(docSnap.id);
          await Promise.all([fetchServices(docSnap.id), fetchAvailableSlots(docSnap.id, windowDays)]);
        }
        // If team exists, activeProfessionalId stays undefined until user picks
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
      onSelectMember={handleSelectMember}
      loadingMemberData={loadingMemberData}
    />
  );
}
