"use client";

import React, { useEffect, useState, use } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getSaoPauloToday, addDaysSaoPaulo } from "@/lib/timezone";
import { Loader2, AlertCircle } from "lucide-react";
import { getDefaultThemeConfig, ThemeConfig } from "@/lib/themeUtils";
import PublicBookingExperience, {
  Professional,
  Service,
  AvailableSlot,
} from "./components/PublicBookingExperience";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function PublicBookingPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;

  const [professional, setProfessional] = useState<Professional | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");

  const fetchServices = async (profId: string) => {
    try {
      const servicesRef = collection(db, "professionals", profId, "services");
      const q = query(servicesRef, where("ativo", "==", true), orderBy("nome", "asc"));
      const querySnapshot = await getDocs(q);
      const data: Service[] = [];
      querySnapshot.forEach((doc) => { data.push({ id: doc.id, ...doc.data() } as Service); });
      setServices(data);
    } catch (e) {
      console.error("Error loading services:", e);
    }
  };

  const fetchAvailableSlots = async (profId: string, windowDays: number = 30) => {
    try {
      const slotsRef = collection(db, "professionals", profId, "availableSlots");
      const todayStr = getSaoPauloToday();
      const maxDateStr = addDaysSaoPaulo(todayStr, windowDays);
      const q = query(
        slotsRef,
        where("disponivel", "==", true),
        where("data", ">=", todayStr),
        where("data", "<=", maxDateStr),
        orderBy("data", "asc"),
        orderBy("horario", "asc")
      );
      const querySnapshot = await getDocs(q);
      const data: AvailableSlot[] = [];
      querySnapshot.forEach((doc) => {
        const d = doc.data();
        if (d.data && d.data <= maxDateStr) data.push({ id: doc.id, ...d } as AvailableSlot);
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

        const rawTheme = (profData.themeConfig || {}) as Partial<ThemeConfig>;
        const defaultTheme = getDefaultThemeConfig();
        profData.themeConfig = {
          ...defaultTheme,
          ...rawTheme,
          primaryColor: rawTheme.primaryColor || profData.corPrincipal || defaultTheme.primaryColor,
        };

        setProfessional(profData);
        const windowDays = profData.agendaConfig?.janelaAgendamentoDias || 30;
        await Promise.all([fetchServices(docSnap.id), fetchAvailableSlots(docSnap.id, windowDays)]);
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
    />
  );
}
