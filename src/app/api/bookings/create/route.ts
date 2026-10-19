import { NextRequest, NextResponse } from "next/server";
import { dbAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import {
  timeToMinutes,
  minutesToTime,
  isPastDateTimeSaoPaulo,
  formatDateFriendlySaoPaulo,
} from "@/lib/timezone";
import { buildCustomerBookingIndex } from "@/lib/leadTypes";
import { isRateLimited } from "@/lib/rateLimit";
import { sendPushToProf } from "@/lib/sendPush";
import { isFullName, normalizeName, FULL_NAME_ERROR } from "@/lib/nameUtils";
import { parseServiceDurationMinutes, overlapsActiveLead, type LeadLike } from "@/lib/availability";

export async function POST(req: NextRequest) {
  if (!dbAdmin || !authAdmin) {
    return NextResponse.json(
      { error: "Erro de configuração no servidor: As credenciais do Firebase Admin não puderam ser carregadas." },
      { status: 500 }
    );
  }

  // Rate limiting: 10 bookings por IP por minuto, 30 por profissional por hora
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";

  if (isRateLimited(`booking:ip:${ip}`, 10, 60_000)) {
    return NextResponse.json(
      { error: "Muitas solicitações. Aguarde um momento e tente novamente." },
      { status: 429 }
    );
  }

  try {
    // Resolve customerUid do token Bearer (server-side only, nunca do body)
    let customerUid: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      // Header presente: token DEVE ser válido. Token inválido ou expirado → 401.
      // Isso evita que um usuário autenticado pense que o agendamento está vinculado
      // à sua conta quando na verdade o token expirou e seria criado de forma anônima.
      try {
        const decoded = await authAdmin.verifyIdToken(authHeader.slice(7));
        customerUid = decoded.uid;
      } catch {
        return NextResponse.json(
          { error: "Sessão expirada. Faça login novamente para vincular o agendamento à sua conta." },
          { status: 401 }
        );
      }
    }
    // Sem header Authorization → agendamento anônimo permitido (customerUid = null)

    const body = await req.json();

    // 1. Strict payload validation
    const allowedKeys = ["professionalId", "servicos", "serviceId", "nome", "telefone", "dataEscolhida", "horarioEscolhido", "observacao"];
    const payloadKeys = Object.keys(body);
    const hasExtraKeys = payloadKeys.some(k => !allowedKeys.includes(k));

    if (hasExtraKeys) {
      return NextResponse.json({ error: "Payload inválido. Campos extras não permitidos." }, { status: 400 });
    }

    const { professionalId, nome, telefone, dataEscolhida, horarioEscolhido, observacao } = body;

    // Aceita novo formato (servicos[]) ou legado (serviceId string)
    let servicosInput: { id: string }[] = [];
    if (Array.isArray(body.servicos) && body.servicos.length > 0) {
      servicosInput = body.servicos;
    } else if (typeof body.serviceId === "string" && body.serviceId) {
      servicosInput = [{ id: body.serviceId }];
    }

    if (servicosInput.length === 0 || servicosInput.length > 10) {
      return NextResponse.json({ error: "Selecione entre 1 e 10 serviços." }, { status: 400 });
    }
    if (!servicosInput.every(s => typeof s.id === "string" && s.id.trim().length > 0)) {
      return NextResponse.json({ error: "Dados de serviço inválidos." }, { status: 400 });
    }
    // Deduplica mantendo ordem
    const servicoIds = [...new Map(servicosInput.map(s => [s.id, s])).keys()];

    // Type validation
    if (
      typeof professionalId !== "string" || !professionalId ||
      typeof nome !== "string" ||
      typeof telefone !== "string" ||
      typeof dataEscolhida !== "string" ||
      typeof horarioEscolhido !== "string"
    ) {
      return NextResponse.json({ error: "Dados inválidos ou ausentes." }, { status: 400 });
    }

    // Characters limits
    const typedNome = normalizeName(nome);
    if (typedNome.length > 80) {
      return NextResponse.json({ error: "O nome deve ter no máximo 80 caracteres." }, { status: 400 });
    }
    if (!isFullName(typedNome)) {
      return NextResponse.json({ error: FULL_NAME_ERROR }, { status: 400 });
    }

    const formattedPhone = telefone.replace(/\D/g, "");
    if (formattedPhone.length < 10 || formattedPhone.length > 20) {
      return NextResponse.json({ error: "O telefone deve ter entre 10 e 20 dígitos." }, { status: 400 });
    }

    const trimmedObservacao = (observacao || "").trim();
    if (trimmedObservacao.length > 500) {
      return NextResponse.json({ error: "A observação deve ter no máximo 500 caracteres." }, { status: 400 });
    }

    // Rate limiting por profissional: 30 bookings por hora
    if (isRateLimited(`booking:prof:${professionalId}`, 30, 3_600_000)) {
      return NextResponse.json(
        { error: "Agenda temporariamente indisponível. Tente novamente em breve." },
        { status: 429 }
      );
    }

    // Date/time format validation (YYYY-MM-DD and HH:MM)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataEscolhida) || !/^\d{2}:\d{2}$/.test(horarioEscolhido)) {
      return NextResponse.json({ error: "Formato de data ou horário inválido." }, { status: 400 });
    }

    // Future validation
    if (isPastDateTimeSaoPaulo(dataEscolhida, horarioEscolhido)) {
      return NextResponse.json({ error: "Este horário já passou. Por favor, escolha um horário futuro." }, { status: 400 });
    }

    // 2. Tenta vincular o agendamento a uma conta de cliente existente via número de telefone
    if (!customerUid) {
      try {
        const customersRef = dbAdmin.collection("customerAccounts");
        let querySnap = await customersRef.where("phone", "==", formattedPhone).limit(1).get();
        if (!querySnap.empty) {
          customerUid = querySnap.docs[0].id;
        } else {
          const formattedFriendly = `(${formattedPhone.slice(0, 2)}) ${formattedPhone.slice(2, 7)}-${formattedPhone.slice(7)}`;
          querySnap = await customersRef.where("phone", "==", formattedFriendly).limit(1).get();
          if (!querySnap.empty) {
            customerUid = querySnap.docs[0].id;
          }
        }
      } catch (err) {
        console.error("Error looking up customer by phone:", err);
      }
    }

    // 3. Transaction safe booking
    const result = await dbAdmin.runTransaction(async (transaction: any) => {
      // Read professional
      const profRef = dbAdmin.collection("professionals").doc(professionalId);
      const profSnap = await transaction.get(profRef);
      if (!profSnap.exists) {
        throw new Error("professional-not-found");
      }
      const profData = profSnap.data();

      // Telefone amarrado ao nome (por profissional): se já existe cliente com este telefone,
      // o nome cadastrado prevalece sobre o digitado. Cadastros antigos sem nome completo são atualizados.
      const knownCustomerSnap = await transaction.get(
        profRef.collection("customers").where("telefone", "==", formattedPhone).limit(1)
      );
      const knownNome = knownCustomerSnap.empty ? null : (knownCustomerSnap.docs[0].data().nome as string | undefined);
      const trimmedNome = knownNome && isFullName(knownNome) ? normalizeName(knownNome) : typedNome;
      const slotDuration = profData?.agendaConfig?.duracaoSlot || 30;

      // Read all services
      const serviceSnaps = await Promise.all(
        servicoIds.map(id => transaction.get(profRef.collection("services").doc(id)))
      );
      for (const snap of serviceSnaps) {
        if (!snap.exists || !snap.data()?.ativo) throw new Error("service-not-found-or-inactive");
      }

      const servicosEnriquecidos = serviceSnaps.map((snap, i) => {
        const d = snap.data()!;
        return {
          id: servicoIds[i],
          nome: d.nome as string,
          preco: (d.preco ?? null) as number | null,
          exibirPreco: (d.exibirPreco ?? true) as boolean,
          duracaoEstimada: (d.duracaoEstimada || "30 min") as string,
          duracaoMin: parseServiceDurationMinutes(d.duracaoEstimada || "30 min"),
        };
      });

      const duration = servicosEnriquecidos.reduce((sum, s) => sum + s.duracaoMin, 0);
      const valorTotal = servicosEnriquecidos.reduce((sum, s) => sum + (s.preco ?? 0), 0);
      const servicoEscolhido = servicosEnriquecidos.map(s => s.nome).join(" + ");
      const serviceId = servicoIds[0]; // compatibilidade legada

      const startMin = timeToMinutes(horarioEscolhido);
      const endMin = startMin + duration;
      const horarioFim = minutesToTime(endMin);

      // Query all slots for this professional on the chosen date to apply overlap formula
      const slotsRef = profRef.collection("availableSlots");
      const slotsSnap = await transaction.get(slotsRef.where("data", "==", dataEscolhida));
      
      // Agendamentos ativos do dia: protege contra slots desatualizados que ainda aparecem como livres
      const dayLeadsSnap = await transaction.get(profRef.collection("leads").where("dataEscolhida", "==", dataEscolhida));
      const dayLeads = dayLeadsSnap.docs.map((d: any) => d.data() as LeadLike);
      if (overlapsActiveLead(dayLeads, dataEscolhida, startMin, endMin, slotDuration)) {
        throw new Error("slot-already-booked");
      }

      const allSlots = slotsSnap.docs.map((doc: any) => ({
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
        servicoEscolhido,
        serviceId,
        servicos: servicosEnriquecidos,
        valorTotal,
        dataEscolhida,
        horarioEscolhido,
        observacao: trimmedObservacao,
        status: "Novo",
        origem: "web-slug",
        duracaoAgendamento: duration,
        horarioInicio: horarioEscolhido,
        horarioFim,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...(customerUid ? { customerUid } : {}),
      };

      transaction.set(newLeadRef, leadPayload);

      // Se autenticado: atualiza perfil do cliente e grava índice do agendamento para ele
      if (customerUid) {
        // Sincroniza dados de contato no perfil de cliente (customerAccounts)
        const customerRef = dbAdmin.collection("customerAccounts").doc(customerUid);
        transaction.set(customerRef, {
          name: trimmedNome,
          phone: formattedPhone,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        const bookingIndexRef = dbAdmin
          .collection("customerAccounts").doc(customerUid)
          .collection("bookings").doc(newLeadRef.id);
        const now = FieldValue.serverTimestamp();
        transaction.set(bookingIndexRef, buildCustomerBookingIndex({
          bookingId: newLeadRef.id,
          professionalId,
          professionalName: profData?.nome ?? profData?.nomeNegocio ?? "",
          professionalSlug: profData?.slugPublico ?? "",
          serviceName: servicoEscolhido,
          date: dataEscolhida,
          startTime: horarioEscolhido,
          endTime: horarioFim,
          status: "Novo",
          createdAt: now,
          updatedAt: now,
        }));
      }

      // Grava relacionamento do cliente na subcoleção do profissional (para gestão e futuros contatos)
      const customerId = customerUid || `phone_${formattedPhone}`;
      const customerRelRef = dbAdmin
        .collection("professionals").doc(professionalId)
        .collection("customers").doc(customerId);
      transaction.set(customerRelRef, {
        nome: trimmedNome,
        telefone: formattedPhone,
        customerUid: customerUid || null,
        lastBookingId: newLeadRef.id,
        lastBookingDate: dataEscolhida,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      // Mark slots as unavailable — sem bookingId/ocupacaoTipo (SEC-005)
      overlappingSlots.forEach((slot) => {
        transaction.update(slot.ref, {
          disponivel: false,
          updatedAt: new Date(),
        });
      });

      // Índice privado: leadId → slotIds (Admin SDK only, sem exposição pública)
      const slotBookingsRef = dbAdmin
        .collection("professionals").doc(professionalId)
        .collection("slotBookings").doc(newLeadRef.id);
      transaction.set(slotBookingsRef, {
        slotIds: overlappingSlots.map(s => s.id),
        updatedAt: new Date(),
      });

      return { leadId: newLeadRef.id, horarioFim, profData, serviceNome: servicoEscolhido, nome: trimmedNome };
    });

    // Notificação push — falha silenciosa, não bloqueia a resposta
    const dataFriendly = formatDateFriendlySaoPaulo(dataEscolhida);
    sendPushToProf(professionalId, {
      title: `📅 Novo agendamento — ${result.nome}`,
      body: `${result.serviceNome} · ${dataFriendly} às ${horarioEscolhido}`,
      url: "/dashboard",
    }).catch(() => {});

    return NextResponse.json({ success: true, leadId: result.leadId, horarioFim: result.horarioFim, nome: result.nome });

  } catch (err: any) {
    console.error("Booking api transaction error:", err);
    let friendlyMessage = "Erro ao criar agendamento. Tente novamente.";
    const errMsg = err?.message;
    if (errMsg === "professional-not-found") {
      friendlyMessage = "Profissional não encontrado.";
    } else if (errMsg === "service-not-found-or-inactive") {
      friendlyMessage = "Serviço não está mais ativo ou não foi encontrado.";
    } else if (errMsg === "slot-not-found") {
      friendlyMessage = "Um ou mais horários no intervalo selecionado não estão disponíveis na agenda.";
    } else if (errMsg === "slot-already-booked") {
      friendlyMessage = "Desculpe, este período já foi reservado por outro cliente.";
    }
    return NextResponse.json({ error: friendlyMessage }, { status: 400 });
  }
}
