import { NextRequest, NextResponse } from "next/server";
import { dbAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { syncLeadEvent } from "@/lib/leadSync";
import { timeToMinutes, addMinutesToTime } from "@/lib/timezone";

type Params = { params: Promise<{ professionalId: string }> };

// Criação de agendamento manual pelo profissional. Reserva os slots e grava o
// índice privado slotBookings (escrita permitida apenas ao Admin SDK).
export async function POST(req: NextRequest, { params }: Params) {
  if (!dbAdmin || !authAdmin) {
    return NextResponse.json({ error: "Erro de configuração no servidor." }, { status: 500 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let callerUid: string;
  try {
    callerUid = (await authAdmin.verifyIdToken(authHeader.slice(7))).uid;
  } catch {
    return NextResponse.json({ error: "Token inválido ou expirado." }, { status: 401 });
  }

  const { professionalId } = await params;
  if (!professionalId) {
    return NextResponse.json({ error: "Parâmetros de rota inválidos." }, { status: 400 });
  }
  if (callerUid !== professionalId) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const {
    nome, telefone, serviceId, dataEscolhida, horarioEscolhido,
    origem, observacao, duracaoServicoPadrao, duracaoAgendamento,
  } = body ?? {};

  const nomeT = typeof nome === "string" ? nome.trim() : "";
  const telefoneD = typeof telefone === "string" ? telefone.replace(/\D/g, "") : "";
  const duration = Number(duracaoAgendamento);

  if (nomeT.length < 2 || nomeT.length > 80) {
    return NextResponse.json({ error: "O nome do cliente deve conter entre 2 e 80 caracteres." }, { status: 400 });
  }
  if (telefoneD.length < 10 || telefoneD.length > 20) {
    return NextResponse.json({ error: "O telefone deve ter entre 10 e 20 dígitos (incluindo o DDD)." }, { status: 400 });
  }
  if (typeof serviceId !== "string" || !serviceId) {
    return NextResponse.json({ error: "Por favor, selecione um serviço." }, { status: 400 });
  }
  if (
    typeof dataEscolhida !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dataEscolhida) ||
    typeof horarioEscolhido !== "string" || !/^\d{2}:\d{2}$/.test(horarioEscolhido)
  ) {
    return NextResponse.json({ error: "Por favor, selecione data e horário." }, { status: 400 });
  }
  if (!Number.isInteger(duration) || duration <= 0 || duration > 24 * 60) {
    return NextResponse.json({ error: "Duração inválida." }, { status: 400 });
  }
  if (typeof origem !== "string" || origem.length > 40) {
    return NextResponse.json({ error: "Origem inválida." }, { status: 400 });
  }
  if (observacao !== undefined && (typeof observacao !== "string" || observacao.length > 1000)) {
    return NextResponse.json({ error: "Observação inválida." }, { status: 400 });
  }

  const startMin = timeToMinutes(horarioEscolhido);
  const endMin = startMin + duration;
  let leadId = "";

  try {
    await dbAdmin.runTransaction(async (tx: any) => {
      const profRef = dbAdmin.collection("professionals").doc(professionalId);
      const leadsRef = profRef.collection("leads");
      const slotsRef = profRef.collection("availableSlots");

      // ── READs ──
      const profSnap = await tx.get(profRef);
      const defaultSlotDuration: number = profSnap.data()?.agendaConfig?.duracaoSlot ?? 30;

      const serviceSnap = await tx.get(profRef.collection("services").doc(serviceId));
      if (!serviceSnap.exists) throw Object.assign(new Error("service-not-found"), { httpStatus: 400 });
      const svc = serviceSnap.data()!;
      const servicos = [{
        id: serviceId,
        nome: svc.nome as string,
        preco: (svc.preco ?? null) as number | null,
        exibirPreco: (svc.exibirPreco ?? true) as boolean,
        duracaoEstimada: (svc.duracaoEstimada || "30 min") as string,
        duracaoMin: duration,
      }];

      const daySlotsSnap = await tx.get(slotsRef.where("data", "==", dataEscolhida));
      const target = daySlotsSnap.docs.filter((d: any) => {
        const m = timeToMinutes(d.data().horario as string);
        return m >= startMin && m < endMin;
      });
      if (target.length === 0) throw Object.assign(new Error("slot-not-found"), { httpStatus: 400 });
      if (target.some((d: any) => !d.data().disponivel)) {
        throw Object.assign(new Error("slot-already-booked"), { httpStatus: 409 });
      }

      // Conflito com leads ativos no mesmo dia
      const dayLeadsSnap = await tx.get(leadsRef.where("dataEscolhida", "==", dataEscolhida));
      const conflict = dayLeadsSnap.docs.some((d: any) => {
        const l = d.data();
        if (l.status === "Perdido" || l.status === "Cancelado") return false;
        const exStart = timeToMinutes(l.horarioInicio || l.horarioEscolhido);
        const exDur = Number(l.duracaoAgendamento) || defaultSlotDuration;
        return startMin < exStart + exDur && exStart < endMin;
      });
      if (conflict) throw Object.assign(new Error("slot-already-booked"), { httpStatus: 409 });

      // Cliente já cadastrado com este telefone (página pública ou agendamento manual anterior)
      const knownCustomerSnap = await tx.get(profRef.collection("customers").where("telefone", "==", telefoneD).limit(1));

      // ── WRITEs ──
      const now = FieldValue.serverTimestamp();
      const newLeadRef = leadsRef.doc();
      leadId = newLeadRef.id;

      tx.set(newLeadRef, {
        professionalId,
        nome: nomeT,
        telefone: telefoneD,
        servicoEscolhido: svc.nome as string,
        serviceId,
        servicos,
        valorTotal: servicos[0].preco ?? 0,
        dataEscolhida,
        horarioEscolhido,
        observacao: typeof observacao === "string" ? observacao.trim() : "",
        status: "Agendado",
        origem,
        duracaoServicoPadrao: typeof duracaoServicoPadrao === "string" ? duracaoServicoPadrao : "",
        duracaoAgendamento: duration,
        horarioInicio: horarioEscolhido,
        horarioFim: addMinutesToTime(horarioEscolhido, duration),
        createdAt: now,
        updatedAt: now,
      });

      target.forEach((d: any) => tx.update(d.ref, { disponivel: false, updatedAt: now }));

      // Cadastro do cliente para o preenchimento automático dos próximos agendamentos (mesmo formato da rota pública)
      const knownCustomer = knownCustomerSnap.empty ? null : knownCustomerSnap.docs[0];
      const customerRef = knownCustomer?.ref ?? profRef.collection("customers").doc(`phone_${telefoneD}`);
      tx.set(customerRef, {
        ...(knownCustomer?.data()?.nome ? {} : { nome: nomeT }),
        telefone: telefoneD,
        ...(knownCustomer ? {} : { customerUid: null }),
        lastBookingId: leadId,
        lastBookingDate: dataEscolhida,
        updatedAt: now,
      }, { merge: true });

      // SEC-005: vínculo lead → slots só no índice privado
      tx.set(profRef.collection("slotBookings").doc(leadId), {
        slotIds: target.map((d: any) => d.id),
        updatedAt: now,
      });
    });
  } catch (err: any) {
    const httpStatus: number = err.httpStatus ?? 500;
    const msg =
      err.message === "service-not-found" ? "Serviço não encontrado." :
      err.message === "slot-not-found" ? "O horário de início selecionado não está cadastrado na agenda." :
      err.message === "slot-already-booked" ? "Este período entra em conflito com outro agendamento já existente." :
      "Erro interno ao salvar o agendamento.";
    if (httpStatus === 500) console.error("[lead-create]", err.code ?? err.message);
    return NextResponse.json({ error: msg }, { status: httpStatus });
  }

  try {
    await syncLeadEvent(professionalId, leadId);
  } catch (calErr: any) {
    console.warn("[lead-create] Falha ao atualizar Calendar:", calErr.code ?? calErr.message);
  }

  return NextResponse.json({ ok: true, leadId });
}
