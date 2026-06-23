"use client";

import React, { useEffect, useState, use } from "react";
import { collection, query, where, getDocs, doc, runTransaction, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatPhoneFriendly, getWhatsAppLink } from "@/lib/whatsapp";
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
  Briefcase,
  Smartphone
} from "lucide-react";

interface Professional {
  id: string;
  nome: string;
  nomeNegocio: string;
  slugPublico: string;
  telefoneWhatsapp: string;
  descricaoCurta?: string;
  fotoLogoUrl?: string;
  corPrincipal?: string;
  agendaConfig?: {
    duracaoSlot?: number;
    janelaAgendamentoDias?: number;
    [key: string]: any;
  };
}

interface Service {
  id: string;
  nome: string;
  descricaoCurta: string;
  duracaoEstimada: string;
  ativo: boolean;
}

interface AvailableSlot {
  id: string;
  data: string; // YYYY-MM-DD
  horario: string; // HH:MM
  disponivel: boolean;
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function PublicBookingPage({ params }: PageProps) {
  // Next.js 15+ async params resolution
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;

  const [professional, setProfessional] = useState<Professional | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Booking Flow Steps
  // 1: Service, 2: Date & Time, 3: Contact Form, 4: Success Redirection
  const [step, setStep] = useState(1);
  
  // Selection States
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  
  // Client Details Form
  const [clientNome, setClientNome] = useState("");
  const [clientTelefone, setClientTelefone] = useState("");
  const [clientObservacao, setClientObservacao] = useState("");
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // 1. Fetch Professional details
  useEffect(() => {
    const fetchProfessional = async () => {
      try {
        const professionalsRef = collection(db, "professionals");
        const q = query(professionalsRef, where("slugPublico", "==", slug));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        const docSnap = querySnapshot.docs[0];
        const profData = { id: docSnap.id, ...docSnap.data() } as Professional;
        setProfessional(profData);
        
        // Load services and slots for this professional
        const windowDays = profData.agendaConfig?.janelaAgendamentoDias || 30;
        await Promise.all([
          fetchServices(docSnap.id),
          fetchAvailableSlots(docSnap.id, windowDays)
        ]);

      } catch (err) {
        console.error("Error loading booking page:", err);
        setError("Erro ao carregar dados. Tente novamente mais tarde.");
      } finally {
        setLoading(false);
      }
    };

    fetchProfessional();
  }, [slug]);

  const fetchServices = async (profId: string) => {
    try {
      const servicesRef = collection(db, "professionals", profId, "services");
      const q = query(servicesRef, where("ativo", "==", true), orderBy("nome", "asc"));
      const querySnapshot = await getDocs(q);
      const servicesData: Service[] = [];
      querySnapshot.forEach((doc) => {
        servicesData.push({ id: doc.id, ...doc.data() } as Service);
      });
      setServices(servicesData);
    } catch (e) {
      console.error("Error loading services:", e);
    }
  };

  const fetchAvailableSlots = async (profId: string, windowDays: number = 30) => {
    try {
      const slotsRef = collection(db, "professionals", profId, "availableSlots");
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];

      // Calculate max allowed date (today + windowDays)
      const maxDate = new Date();
      maxDate.setDate(today.getDate() + windowDays);
      const maxDateStr = maxDate.toISOString().split("T")[0];

      // Fetch only available slots from today up to maxDateStr
      const q = query(
        slotsRef, 
        where("disponivel", "==", true), 
        where("data", ">=", todayStr),
        where("data", "<=", maxDateStr),
        orderBy("data", "asc"),
        orderBy("horario", "asc")
      );
      const querySnapshot = await getDocs(q);
      const slotsData: AvailableSlot[] = [];
      querySnapshot.forEach((doc) => {
        const d = doc.data();
        // In-memory safety filter layer
        if (d.data && d.data <= maxDateStr) {
          slotsData.push({ id: doc.id, ...d } as AvailableSlot);
        }
      });
      setSlots(slotsData);
    } catch (e) {
      console.error("Error loading slots:", e);
    }
  };

  // Group slots by date for Date Selection step
  const groupedSlots = slots.reduce((acc: { [key: string]: AvailableSlot[] }, slot) => {
    if (!acc[slot.data]) {
      acc[slot.data] = [];
    }
    acc[slot.data].push(slot);
    return acc;
  }, {});

  const handleNextStep = () => {
    if (step === 1 && !selectedService) {
      setError("Por favor, selecione um serviço para prosseguir.");
      return;
    }
    if (step === 2 && (!selectedDate || !selectedSlot)) {
      setError("Por favor, escolha uma data e horário.");
      return;
    }
    setError("");
    setStep(step + 1);
  };

  const handlePrevStep = () => {
    setError("");
    setStep(step - 1);
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!professional || !selectedService || !selectedSlot) return;
    setError("");
    setSubmitting(true);

    // Form validations
    const trimmedNome = clientNome.trim();
    if (trimmedNome.length < 2 || trimmedNome.length > 80) {
      setError("O nome deve conter entre 2 e 80 caracteres.");
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

    // Past slot validation
    const slotDateTime = new Date(`${selectedSlot.data}T${selectedSlot.horario}`);
    const now = new Date();
    if (slotDateTime < now) {
      setError("Este horário já passou. Por favor, escolha um horário futuro.");
      setSubmitting(false);
      return;
    }

    try {
      // Execute booking in a transaction to prevent race conditions (double-booking)
      await runTransaction(db, async (transaction) => {
        // 1. Read the slot chosen
        const slotDocRef = doc(db, "professionals", professional.id, "availableSlots", selectedSlot.id);
        const slotDoc = await transaction.get(slotDocRef);
        
        if (!slotDoc.exists()) {
          throw new Error("slot-not-found");
        }
        
        const slotData = slotDoc.data();
        if (!slotData.disponivel) {
          throw new Error("slot-already-booked");
        }

        // 2. Prepare Lead document reference and payload
        const leadsRef = collection(db, "professionals", professional.id, "leads");
        const newLeadRef = doc(leadsRef);
        
        // Exact 12 expected fields only (any extra field rejected by Firestore rules)
        const leadPayload = {
          professionalId: professional.id,
          nome: trimmedNome,
          telefone: formattedClientPhone,
          servicoEscolhido: selectedService.nome,
          serviceId: selectedService.id,
          dataEscolhida: selectedSlot.data,
          horarioEscolhido: selectedSlot.horario,
          observacao: trimmedObservacao,
          status: "Novo", // always "Novo" in public booking
          origem: "web-slug", // always "web-slug" in public booking
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        // 3. Write Lead
        transaction.set(newLeadRef, leadPayload);
        
        // 4. Update slot to unavailable
        transaction.update(slotDocRef, {
          disponivel: false,
          updatedAt: new Date()
        });
      });

      // 3. Build WhatsApp pre-filled message & open wa.me
      const [year, month, day] = selectedSlot.data.split("-");
      const friendlyDate = `${day}/${month}/${year}`;
      
      const message = `Olá, meu nome é ${trimmedNome}. Tenho interesse em ${selectedService.nome} e gostaria de verificar a disponibilidade para ${friendlyDate} às ${selectedSlot.horario}.`;
      const redirectUrl = getWhatsAppLink(professional.telefoneWhatsapp, message);
      
      // Advance to success page/indicator
      setStep(4);
      
      // Redirect ONLY after successful transaction completion
      window.location.href = redirectUrl;

    } catch (err: any) {
      console.error(err);
      if (err.message === "slot-already-booked") {
        setError("Desculpe, este horário foi reservado por outro cliente há instantes. Por favor, escolha outro horário.");
      } else if (err.message === "slot-not-found") {
        setError("O horário selecionado não existe mais.");
      } else {
        setError("Ocorreu um erro ao registrar sua solicitação: " + err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Helper date formatter: "2026-06-25" -> "Quinta, 25/06"
  const formatDateTitle = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    const options: Intl.DateTimeFormatOptions = { weekday: "short", day: "2-digit", month: "2-digit" };
    const formatted = date.toLocaleDateString("pt-BR", options);
    // Capitalize first letter
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

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

  const corBrand = professional.corPrincipal || "#6366f1";
  const initials = professional.nomeNegocio.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="flex-1 flex flex-col items-center bg-slate-950 min-h-screen relative overflow-hidden px-4 py-8 md:py-16">
      
      {/* Dynamic Background Glow based on brand color */}
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full blur-[120px] pointer-events-none opacity-15"
        style={{ backgroundColor: corBrand }}
      />

      <div className="w-full max-w-xl z-10 space-y-6">
        
        {/* Header / Brand Profile Card */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 text-center flex flex-col items-center shadow-lg relative overflow-hidden backdrop-blur-sm">
          {/* Top Brand Accent Line */}
          <div className="absolute top-0 inset-x-0 h-1.5" style={{ backgroundColor: corBrand }} />
          
          <div className="h-20 w-20 rounded-2xl border border-slate-800 bg-slate-950 flex items-center justify-center overflow-hidden mb-4 shadow-md">
            {professional.fotoLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={professional.fotoLogoUrl} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl font-black" style={{ color: corBrand }}>{initials}</span>
            )}
          </div>

          <h1 className="text-2xl font-extrabold text-slate-100">{professional.nomeNegocio}</h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">Responsável: {professional.nome}</p>
          
          {professional.descricaoCurta && (
            <p className="text-sm text-slate-400 mt-3 max-w-sm leading-relaxed">
              {professional.descricaoCurta}
            </p>
          )}
        </div>

        {/* Wizard Progress Steps */}
        {step < 4 && (
          <div className="bg-slate-900/20 border border-slate-850 rounded-2xl px-5 py-3.5 flex justify-between items-center text-xs font-semibold text-slate-500">
            <span className={step === 1 ? "text-indigo-400 font-bold" : "text-slate-450"}>1. Serviço</span>
            <ChevronRight className="h-3 w-3 text-slate-700" />
            <span className={step === 2 ? "text-indigo-400 font-bold" : "text-slate-450"}>2. Horário</span>
            <ChevronRight className="h-3 w-3 text-slate-700" />
            <span className={step === 3 ? "text-indigo-400 font-bold" : "text-slate-450"}>3. Seus Dados</span>
          </div>
        )}

        {/* Step Cards Container */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative backdrop-blur-xl">
          
          {error && (
            <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex gap-3 items-center">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p className="font-medium">{error}</p>
            </div>
          )}

          {/* STEP 1: SELECT SERVICE */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-white mb-1">Escolha o serviço desejado</h2>
                <p className="text-xs text-slate-450">Selecione uma das opções abaixo para ver os horários correspondentes.</p>
              </div>

              {services.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-sm border-2 border-dashed border-slate-800 rounded-2xl">
                  Nenhum serviço disponível no momento.
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  {services.map(service => {
                    const isSelected = selectedService?.id === service.id;
                    return (
                      <button
                        key={service.id}
                        onClick={() => {
                          setSelectedService(service);
                          setError("");
                        }}
                        className={`
                          w-full p-4 rounded-2xl border text-left flex items-start gap-4 transition-all duration-200
                          ${isSelected 
                            ? "bg-slate-900 border-indigo-500 shadow-md" 
                            : "bg-slate-950/40 border-slate-800/80 hover:border-slate-700"
                          }
                        `}
                      >
                        <div 
                          className={`
                            p-2.5 rounded-xl border shrink-0
                            ${isSelected ? "bg-indigo-600/10 border-indigo-500/30 text-indigo-400" : "bg-slate-950 border-slate-850 text-slate-500"}
                          `}
                        >
                          <Briefcase className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-bold text-slate-200 truncate text-sm sm:text-base">{service.nome}</h4>
                            <span className="text-xs font-semibold text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 shrink-0">
                              {service.duracaoEstimada}
                            </span>
                          </div>
                          {service.descricaoCurta && (
                            <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                              {service.descricaoCurta}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="pt-4">
                <button
                  onClick={handleNextStep}
                  disabled={!selectedService}
                  style={{ backgroundColor: selectedService ? corBrand : "" }}
                  className={`
                    w-full py-3.5 px-4 text-white font-semibold rounded-xl text-sm transition-all shadow-lg flex items-center justify-center gap-2 active:scale-[0.98]
                    ${!selectedService ? "bg-slate-800 text-slate-500 cursor-not-allowed shadow-none" : "hover:brightness-110 shadow-indigo-500/10"}
                  `}
                >
                  <span>Escolher Data & Horário</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: SELECT DATE & TIME */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-white mb-1">Selecione data e hora</h2>
                <p className="text-xs text-slate-450">Veja a disponibilidade de nossa agenda em tempo real.</p>
              </div>

              {Object.keys(groupedSlots).length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-sm border-2 border-dashed border-slate-800 rounded-2xl">
                  Nenhum horário disponível nos próximos dias.
                </div>
              ) : (
                <div className="space-y-5 pt-1">
                  {/* Date Selector Row */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">1. Escolha a data</label>
                    <div className="flex gap-2 overflow-x-auto pb-2 pr-1">
                      {Object.keys(groupedSlots).map(dateStr => {
                        const isSelected = selectedDate === dateStr;
                        return (
                          <button
                            key={dateStr}
                            onClick={() => {
                              setSelectedDate(dateStr);
                              setSelectedSlot(null); // reset slot
                            }}
                            className={`
                              py-2 px-3.5 rounded-xl border text-xs font-semibold text-center whitespace-nowrap transition-all shrink-0
                              ${isSelected 
                                ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-500/15" 
                                : "bg-slate-950 border-slate-800/80 text-slate-400 hover:border-slate-700"
                              }
                            `}
                          >
                            {formatDateTitle(dateStr)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Time Selector Slots */}
                  {selectedDate && (
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">2. Escolha o horário</label>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {groupedSlots[selectedDate].map(slot => {
                          const isSelected = selectedSlot?.id === slot.id;
                          return (
                            <button
                              key={slot.id}
                              onClick={() => setSelectedSlot(slot)}
                              className={`
                                py-2.5 px-1.5 rounded-xl border text-xs font-bold text-center flex items-center justify-center gap-1.5 transition-all
                                ${isSelected 
                                  ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-500/15" 
                                  : "bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700"
                                }
                              `}
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

              {/* Navigation Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handlePrevStep}
                  className="flex-1 py-3.5 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 font-semibold rounded-xl text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Voltar</span>
                </button>
                <button
                  onClick={handleNextStep}
                  disabled={!selectedDate || !selectedSlot}
                  style={{ backgroundColor: (selectedDate && selectedSlot) ? corBrand : "" }}
                  className={`
                    flex-[2] py-3.5 px-4 text-white font-semibold rounded-xl text-sm transition-all shadow-lg flex items-center justify-center gap-2 active:scale-[0.98]
                    ${(!selectedDate || !selectedSlot) ? "bg-slate-800 text-slate-500 cursor-not-allowed shadow-none" : "hover:brightness-110 shadow-indigo-500/10"}
                  `}
                >
                  <span>Preencher Seus Dados</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: CONTACT FORM */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-white mb-1">Informe seus dados para contato</h2>
                <p className="text-xs text-slate-450">Suas informações serão salvas no sistema de pré-agendamento.</p>
              </div>

              {/* Summary panel */}
              <div className="bg-slate-950/60 border border-slate-800/60 p-4 rounded-2xl text-xs space-y-2 text-slate-350">
                <p className="flex justify-between items-center"><span className="text-slate-500">Serviço:</span> <span className="font-bold text-slate-200">{selectedService?.nome}</span></p>
                {selectedSlot && (
                  <p className="flex justify-between items-center">
                    <span className="text-slate-500">Data e Horário:</span> 
                    <span className="font-bold text-slate-200">
                      {formatDateTitle(selectedSlot.data)} às {selectedSlot.horario}
                    </span>
                  </p>
                )}
              </div>

              <form onSubmit={handleBookAppointment} className="space-y-4">
                {/* Nome Client */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Seu Nome *</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500"><User className="h-4 w-4" /></span>
                    <input
                      type="text"
                      required
                      value={clientNome}
                      onChange={(e) => setClientNome(e.target.value)}
                      placeholder="Insira seu nome completo"
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-100 text-sm transition-all"
                    />
                  </div>
                </div>

                {/* Telefone Client */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Telefone com WhatsApp *</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500"><Phone className="h-4 w-4" /></span>
                    <input
                      type="text"
                      required
                      value={clientTelefone}
                      onChange={(e) => setClientTelefone(e.target.value)}
                      placeholder="Ex: (11) 99999-9999"
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-100 text-sm transition-all"
                    />
                  </div>
                </div>

                {/* Observação Client */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Observações (Opcional)</label>
                  <div className="relative">
                    <span className="absolute top-3 left-3 text-slate-500"><FileText className="h-4 w-4" /></span>
                    <textarea
                      value={clientObservacao}
                      onChange={(e) => setClientObservacao(e.target.value)}
                      placeholder="Gostaria de detalhar alguma necessidade ou preferência? (Opcional)"
                      rows={2}
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-100 text-sm transition-all resize-none"
                    />
                  </div>
                </div>

                {/* Submit button / Back button */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    disabled={submitting}
                    className="flex-1 py-3.5 bg-slate-950 hover:bg-slate-800 text-slate-350 border border-slate-800 font-semibold rounded-xl text-sm transition-all active:scale-[0.98]"
                  >
                    Voltar
                  </button>
                  
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{ backgroundColor: corBrand }}
                    className="flex-[2] py-3.5 px-4 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/10 hover:brightness-110 active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <Smartphone className="h-4 w-4" />
                        <span>Solicitar Horário no WhatsApp</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* STEP 4: REDIRECT SUCCESS */}
          {step === 4 && (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
              <div className="h-16 w-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/5">
                <Check className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Solicitação enviada com sucesso!</h2>
                <p className="text-sm text-slate-400 max-w-sm mt-2 leading-relaxed">
                  Estamos redirecionando você para o WhatsApp de <strong>{professional.nomeNegocio}</strong> para confirmar seu agendamento.
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  Se você não foi redirecionado automaticamente, clique no botão abaixo.
                </p>
              </div>
              <div className="pt-4 w-full">
                <button
                  onClick={() => {
                    const [year, month, day] = selectedSlot!.data.split("-");
                    const friendlyDate = `${day}/${month}/${year}`;
                    const message = `Olá, meu nome é ${clientNome.trim()}. Tenho interesse em ${selectedService!.nome} e gostaria de verificar a disponibilidade para ${friendlyDate} às ${selectedSlot!.horario}.`;
                    window.location.href = getWhatsAppLink(professional.telefoneWhatsapp, message);
                  }}
                  className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm transition-all shadow-lg flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <Smartphone className="h-5 w-5" />
                  <span>Abrir WhatsApp Manualmente</span>
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
