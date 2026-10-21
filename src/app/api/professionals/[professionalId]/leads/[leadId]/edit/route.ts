import { NextRequest, NextResponse } from "next/server";
import { dbAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { syncLeadEvent } from "@/lib/leadSync";
import { timeToMinutes, minutesToTime } from "@/lib/timezone";
import type * as FirebaseFirestore from "firebase-admin/firestore";

type Params = { params: Promise<{ professionalId: string; leadId: string }> };

const STATUSES = ["Novo", "Em contato", "Agendado", "Atendido", "Cancelado", "Perdido"];

interface SlotEntry {
  ref: FirebaseFirestore.DocumentReference;
  id: string;
  horario: string;
  disponivel: boolean;
}

// Edição completa de um agendamento pelo profissional. O índice privado
// slotBookings só pode ser escrito pelo Admin SDK (firestore.rules), por isso
// a liberação/reserva de slots acontece aqui e não no cliente.
export async function PATCH(req: NextRequest, { params }: Params) {
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

  const { professionalId, leadId } = await params;
  if (!professionalId || !leadId) {
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
    nome, telefone, serviceId, servicoEscolhido, dataEscolhida, horarioEscolhido,
    origem, status, duracaoAgendamento,
  } = body ?? {};

  const nomeT = typeof nome === "string" ? nome.trim() : "";
  const telefoneD = typeof telefone === "string" ? telefone.replace(/\D/g, "") : "";
  const duration = Number(duracaoAgendamento);

  if (nomeT.length < 2 || nomeT.length > 80) {
    return NextResponse.json({ error: "O nome deve ter entre 2 e 80 caracteres." }, { status: 400 });
  }
  if (telefoneD.length < 10 || telefoneD.length > 20) {
    return NextResponse.json({ error: "O telefone deve ter entre 10 e 20 dígitos (incluindo o DDD)." }, { status: 400 });
  }
  if (
    typeof dataEscolhida !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dataEscolhida) ||
    typeof horarioEscolhido !== "string" || !/^\d{2}:\d{2}$/.test(horarioEscolhido)
  ) {
    return NextResponse.json({ error: "Data (YYYY-MM-DD) e horário (HH:MM) são obrigatórios." }, { status: 400 });
  }
  if (!Number.isInteger(duration) || duration <= 0 || duration > 24 * 60) {
    return NextResponse.json({ error: "Duração inválida." }, { status: 400 });
  }
  if (typeof status !== "string" || !STATUSES.includes(status)) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }
  if (typeof origem !== "string" || origem.length > 40) {
    return NextResponse.json({ error: "Origem inválida." }, { status: 400 });
  }

  const newStart = timeToMinutes(horarioEscolhido);
  const newEnd = newStart + duration;
  const newHorarioFim = minutesToTime(newEnd);
  const willBeInactive = status === "Cancelado";

  try {
    await dbAdmin.runTransaction(async (tx: any) => {
      const profRef = dbAdmin.collection("professionals").doc(professionalId);
      const leadRef = profRef.collection("leads").doc(leadId);
      const slotsRef = profRef.collection("availableSlots");
      const slotBookingsRef = profRef.collection("slotBookings").doc(leadId);

      // ── READs ──
      const leadSnap = await tx.get(leadRef);
      if (!leadSnap.exists) throw Object.assign(new Error("lead-not-found"), { httpStatus: 404 });
      const leadData = leadSnap.data()!;
      if (leadData.professionalId && leadData.professionalId !== professionalId) {
        throw Object.assign(new Error("lead-wrong-owner"), { httpStatus: 403 });
      }

      const serviceSnap = typeof serviceId === "string" && serviceId
        ? await tx.get(profRef.collection("services").doc(serviceId))
        : null;
      if (serviceSnap && !serviceSnap.exists) throw Object.assign(new Error("service-not-found"), { httpStatus: 400 });

      const profSnap = await tx.get(profRef);
      const slotDuration: number = profSnap.data()?.agendaConfig?.duracaoSlot ?? 30;

      const sbSnap = await tx.get(slotBookingsRef);
      const oldSlotIds: Set<string> = new Set(sbSnap.exists ? (sbSnap.data()!.slotIds as string[]) : []);
      const oldSlotSnaps = await Promise.all(Array.from(oldSlotIds).map(id => tx.get(slotsRef.doc(id))));

      let overlapping: SlotEntry[] = [];
      if (!willBeInactive) {
        const daySnap = await tx.get(slotsRef.where("data", "==", dataEscolhida));
        overlapping = daySnap.docs
          .map((d: FirebaseFirestore.QueryDocumentSnapshot) => ({
            ref: d.ref,
            id: d.id,
            horario: d.data().horario as string,
            disponivel: d.data().disponivel as boolean,
          }))
          .filter((s: SlotEntry) => {
            const ini = timeToMinutes(s.horario);
            return ini < newEnd && ini + slotDuration > newStart;
          })
          .sort((a: SlotEntry, b: SlotEntry) => timeToMinutes(a.horario) - timeToMinutes(b.horario));

        let isCovered = false;
        if (overlapping.length > 0) {
          const firstStart = timeToMinutes(overlapping[0].horario);
          const lastEnd = timeToMinutes(overlapping[overlapping.length - 1].horario) + slotDuration;
          if (firstStart <= newStart && lastEnd >= newEnd) {
            isCovered = true;
            for (let i = 0; i < overlapping.length - 1; i++) {
              if (timeToMinutes(overlapping[i].horario) + slotDuration < timeToMinutes(overlapping[i + 1].horario)) {
                isCovered = false;
                break;
              }
            }
          }
        }
        if (!isCovered) throw Object.assign(new Error("slot-not-found"), { httpStatus: 400 });

        if (overlapping.some(s => !s.disponivel && !oldSlotIds.has(s.id))) {
          throw Object.assign(new Error("slot-already-booked"), { httpStatus: 409 });
        }
      }

      const customerUid: string | undefined = leadData.customerUid;
      const indexRef = customerUid
        ? dbAdmin.collection("customerAccounts").doc(customerUid).collection("bookings").doc(leadId)
        : null;
      const indexSnap = indexRef ? await tx.get(indexRef) : null;

      // ── WRITEs ──
      const now = FieldValue.serverTimestamp();

      oldSlotSnaps.forEach((snap: any) => {
        if (snap.exists) tx.update(snap.ref, { disponivel: true, updatedAt: now });
      });
      overlapping.forEach(s => tx.update(s.ref, { disponivel: false, updatedAt: now }));

      // SEC-005: vínculo lead → slots só no índice privado
      tx.set(slotBookingsRef, { slotIds: overlapping.map(s => s.id), updatedAt: now });

      const serviceFields: Record<string, any> = {};
      if (serviceSnap) {
        const svc = serviceSnap.data()!;
        // recalcula o valor só se o serviço mudou; o preço atual do serviço passa a valer
        if (leadData.serviceId !== serviceId || leadData.valorTotal === undefined) {
          serviceFields.servicos = [{
            id: serviceId,
            nome: svc.nome as string,
            preco: (svc.preco ?? null) as number | null,
            exibirPreco: (svc.exibirPreco ?? true) as boolean,
            duracaoEstimada: (svc.duracaoEstimada || "30 min") as string,
            duracaoMin: duration,
          }];
          serviceFields.valorTotal = svc.preco ?? 0;
        }
      }

      tx.update(leadRef, {
        ...serviceFields,
        nome: nomeT,
        telefone: telefoneD,
        serviceId: typeof serviceId === "string" ? serviceId : "",
        servicoEscolhido: serviceSnap ? (serviceSnap.data()!.nome as string) : (typeof servicoEscolhido === "string" ? servicoEscolhido : ""),
        dataEscolhida,
        horarioEscolhido,
        horarioInicio: horarioEscolhido,
        horarioFim: newHorarioFim,
        origem,
        status,
        duracaoAgendamento: duration,
        updatedAt: now,
      });

      if (indexRef && indexSnap?.exists) {
        tx.update(indexRef, {
          date: dataEscolhida,
          startTime: horarioEscolhido,
          endTime: newHorarioFim,
          updatedAt: now,
        });
      }
    });
  } catch (err: any) {
    const httpStatus: number = err.httpStatus ?? 500;
    const msg =
      err.message === "service-not-found" ? "Serviço não encontrado." :
      err.message === "lead-not-found" ? "Agendamento não encontrado." :
      err.message === "lead-wrong-owner" ? "Acesso negado." :
      err.message === "slot-not-found" ? "Um ou mais horários necessários não estão disponíveis na agenda." :
      err.message === "slot-already-booked" ? "Desculpe, este período já está ocupado por outro cliente." :
      "Erro interno ao salvar o agendamento.";
    if (httpStatus === 500) console.error("[lead-edit]", err.code ?? err.message);
    return NextResponse.json({ error: msg }, { status: httpStatus });
  }

  try {
    await syncLeadEvent(professionalId, leadId);
  } catch (calErr: any) {
    console.warn("[lead-edit] Falha ao atualizar Calendar:", calErr.code ?? calErr.message);
  }

  return NextResponse.json({ ok: true });
}
