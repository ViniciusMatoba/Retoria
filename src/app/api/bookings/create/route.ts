import { NextRequest, NextResponse } from "next/server";
import { dbAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import {
  timeToMinutes,
  minutesToTime,
  isPastDateTimeSaoPaulo,
} from "@/lib/timezone";

// Parser helper to extract duration in minutes from service description
const parseServiceDurationMinutes = (duracaoStr: string): number => {
  if (!duracaoStr) return 30;
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
  return totalMinutes > 0 ? totalMinutes : 30;
};

export async function POST(req: NextRequest) {
  try {
    // Optionally resolve customerUid from auth token (server-side only, never from body)
    let customerUid: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const decoded = await authAdmin.verifyIdToken(authHeader.slice(7));
        customerUid = decoded.uid;
      } catch {
        // Token invalid — proceed as anonymous booking
      }
    }

    const body = await req.json();

    // 1. Strict payload validation
    const allowedKeys = ["professionalId", "serviceId", "nome", "telefone", "dataEscolhida", "horarioEscolhido", "observacao"];
    const payloadKeys = Object.keys(body);
    const hasExtraKeys = payloadKeys.some(k => !allowedKeys.includes(k));
    
    if (hasExtraKeys) {
      return NextResponse.json({ error: "Payload inválido. Campos extras não permitidos." }, { status: 400 });
    }

    const { professionalId, serviceId, nome, telefone, dataEscolhida, horarioEscolhido, observacao } = body;

    // Type validation
    if (
      typeof professionalId !== "string" || !professionalId ||
      typeof serviceId !== "string" || !serviceId ||
      typeof nome !== "string" ||
      typeof telefone !== "string" ||
      typeof dataEscolhida !== "string" ||
      typeof horarioEscolhido !== "string"
    ) {
      return NextResponse.json({ error: "Dados inválidos ou ausentes." }, { status: 400 });
    }

    // Characters limits
    const trimmedNome = nome.trim();
    if (trimmedNome.length < 2 || trimmedNome.length > 80) {
      return NextResponse.json({ error: "O nome deve ter entre 2 e 80 caracteres." }, { status: 400 });
    }

    const formattedPhone = telefone.replace(/\D/g, "");
    if (formattedPhone.length < 10 || formattedPhone.length > 20) {
      return NextResponse.json({ error: "O telefone deve ter entre 10 e 20 dígitos." }, { status: 400 });
    }

    const trimmedObservacao = (observacao || "").trim();
    if (trimmedObservacao.length > 500) {
      return NextResponse.json({ error: "A observação deve ter no máximo 500 caracteres." }, { status: 400 });
    }

    // Date/time format validation (YYYY-MM-DD and HH:MM)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataEscolhida) || !/^\d{2}:\d{2}$/.test(horarioEscolhido)) {
      return NextResponse.json({ error: "Formato de data ou horário inválido." }, { status: 400 });
    }

    // Future validation
    if (isPastDateTimeSaoPaulo(dataEscolhida, horarioEscolhido)) {
      return NextResponse.json({ error: "Este horário já passou. Por favor, escolha um horário futuro." }, { status: 400 });
    }

    // 2. Transaction safe booking
    const result = await dbAdmin.runTransaction(async (transaction) => {
      // Read professional
      const profRef = dbAdmin.collection("professionals").doc(professionalId);
      const profSnap = await transaction.get(profRef);
      if (!profSnap.exists) {
        throw new Error("professional-not-found");
      }
      const profData = profSnap.data();
      const slotDuration = profData?.agendaConfig?.duracaoSlot || 30;

      // Read service
      const serviceRef = profRef.collection("services").doc(serviceId);
      const serviceSnap = await transaction.get(serviceRef);
      if (!serviceSnap.exists || !serviceSnap.data()?.ativo) {
        throw new Error("service-not-found-or-inactive");
      }
      const serviceData = serviceSnap.data()!;
      
      const serviceDurationStr = serviceData.duracaoEstimada || "30 minutos";
      const duration = parseServiceDurationMinutes(serviceDurationStr);
      
      const startMin = timeToMinutes(horarioEscolhido);
      const endMin = startMin + duration;
      const horarioFim = minutesToTime(endMin);

      // Query all slots for this professional on the chosen date to apply overlap formula
      const slotsRef = profRef.collection("availableSlots");
      const slotsSnap = await transaction.get(slotsRef.where("data", "==", dataEscolhida));
      
      const allSlots = slotsSnap.docs.map(doc => ({
        ref: doc.ref,
        id: doc.id,
        ...doc.data()
      })) as Array<{ ref: FirebaseFirestore.DocumentReference; id: string; data: string; horario: string; disponivel: boolean }>;

      // Overlap formula: slotInicio < agendamentoFim && slotFim > agendamentoInicio
      const overlappingSlots = allSlots.filter(slot => {
        const slotInicio = timeToMinutes(slot.horario);
        const slotFim = slotInicio + slotDuration;
        return slotInicio < endMin && slotFim > startMin;
      });

      // Sort by start time to verify sequential coverage
      overlappingSlots.sort((a, b) => timeToMinutes(a.horario) - timeToMinutes(b.horario));

      // Validate coverage: do the slots cover the entire range [startMin, endMin) without gaps?
      let isCovered = false;
      if (overlappingSlots.length > 0) {
        const firstSlotStart = timeToMinutes(overlappingSlots[0].horario);
        const lastSlot = overlappingSlots[overlappingSlots.length - 1];
        const lastSlotEnd = timeToMinutes(lastSlot.horario) + slotDuration;

        if (firstSlotStart <= startMin && lastSlotEnd >= endMin) {
          let hasGap = false;
          for (let i = 0; i < overlappingSlots.length - 1; i++) {
            const currentEnd = timeToMinutes(overlappingSlots[i].horario) + slotDuration;
            const nextStart = timeToMinutes(overlappingSlots[i+1].horario);
            if (currentEnd < nextStart) {
              hasGap = true;
              break;
            }
          }
          if (!hasGap) {
            isCovered = true;
          }
        }
      }

      if (!isCovered) {
        throw new Error("slot-not-found");
      }

      // Check slot availability
      const anyUnavailable = overlappingSlots.some(s => !s.disponivel);
      if (anyUnavailable) {
        throw new Error("slot-already-booked");
      }

      // Create Lead
      const newLeadRef = profRef.collection("leads").doc();
      const leadPayload: Record<string, unknown> = {
        professionalId,
        nome: trimmedNome,
        telefone: formattedPhone,
        servicoEscolhido: serviceData.nome,
        serviceId,
        dataEscolhida,
        horarioEscolhido,
        observacao: trimmedObservacao,
        status: "Novo",
        origem: "web-slug",
        duracaoServicoPadrao: serviceDurationStr,
        duracaoAgendamento: duration,
        horarioInicio: horarioEscolhido,
        horarioFim,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...(customerUid ? { customerUid } : {}),
      };

      transaction.set(newLeadRef, leadPayload);

      // If authenticated: write customer booking index (Admin SDK — matches firestore.rules allow write: if false)
      if (customerUid) {
        const bookingIndexRef = dbAdmin
          .collection("customerAccounts").doc(customerUid)
          .collection("bookings").doc(newLeadRef.id);
        transaction.set(bookingIndexRef, {
          bookingId: newLeadRef.id,
          professionalId,
          professionalName: profData?.nome ?? profData?.nomeNegocio ?? "",
          professionalSlug: profData?.slugPublico ?? "",
          serviceName: serviceData.nome,
          date: dataEscolhida,
          startTime: horarioEscolhido,
          endTime: horarioFim,
          status: "Novo",
          sourcePath: `professionals/${professionalId}/leads/${newLeadRef.id}`,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Write customer relationship to professional's subcollection
        const customerRelRef = dbAdmin
          .collection("professionals").doc(professionalId)
          .collection("customers").doc(customerUid);
        transaction.set(customerRelRef, {
          customerUid,
          lastBookingId: newLeadRef.id,
          lastBookingDate: dataEscolhida,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      // Mark slots as unavailable
      overlappingSlots.forEach((slot, index) => {
        transaction.update(slot.ref, {
          disponivel: false,
          bookingId: newLeadRef.id,
          ocupacaoTipo: index === 0 ? "principal" : "continuacao",
          updatedAt: new Date()
        });
      });

      return { leadId: newLeadRef.id, horarioFim };
    });

    return NextResponse.json({ success: true, leadId: result.leadId, horarioFim: result.horarioFim });

  } catch (err: any) {
    console.error("Booking api transaction error:", err);
    let friendlyMessage = "Erro ao criar agendamento. Tente novamente.";
    if (err.message === "professional-not-found") {
      friendlyMessage = "Profissional não encontrado.";
    } else if (err.message === "service-not-found-or-inactive") {
      friendlyMessage = "Serviço não está mais ativo ou não foi encontrado.";
    } else if (err.message === "slot-not-found") {
      friendlyMessage = "Um ou mais horários no intervalo selecionado não estão disponíveis na agenda.";
    } else if (err.message === "slot-already-booked") {
      friendlyMessage = "Desculpe, este período já foi reservado por outro cliente.";
    }
    return NextResponse.json({ error: friendlyMessage }, { status: 400 });
  }
}
