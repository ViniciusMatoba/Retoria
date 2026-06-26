import { NextRequest, NextResponse } from "next/server";
import { dbAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { createCalendarEvent, deleteCalendarEvent, getTokens } from "@/lib/googleCalendar";
import { timeToMinutes, minutesToTime, isPastDateTimeSaoPaulo } from "@/lib/timezone";
import type * as FirebaseFirestore from "firebase-admin/firestore";

type Params = { params: Promise<{ professionalId: string; leadId: string }> };

interface SlotEntry {
  ref: FirebaseFirestore.DocumentReference;
  id: string;
  horario: string;
  disponivel: boolean;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!dbAdmin || !authAdmin) {
    return NextResponse.json({ error: "Erro de configuração no servidor." }, { status: 500 });
  }

  // ── Autenticação ───────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let callerUid: string;
  try {
    const decoded = await authAdmin.verifyIdToken(authHeader.slice(7));
    callerUid = decoded.uid;
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

  // ── Validação de payload ───────────────────────────────────────────────────
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const { dataEscolhida, horarioEscolhido, horarioFim } = body ?? {};

  if (
    typeof dataEscolhida !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dataEscolhida) ||
    typeof horarioEscolhido !== "string" || !/^\d{2}:\d{2}$/.test(horarioEscolhido) ||
    typeof horarioFim !== "string" || !/^\d{2}:\d{2}$/.test(horarioFim)
  ) {
    return NextResponse.json(
      { error: "Campos obrigatórios: dataEscolhida (YYYY-MM-DD), horarioEscolhido (HH:MM), horarioFim (HH:MM)." },
      { status: 400 }
    );
  }

  if (horarioFim <= horarioEscolhido) {
    return NextResponse.json({ error: "Horário de fim deve ser após o horário de início." }, { status: 400 });
  }

  // Bloquear datas no passado
  if (isPastDateTimeSaoPaulo(dataEscolhida, horarioEscolhido)) {
    return NextResponse.json({ error: "Não é possível reagendar para uma data/horário no passado." }, { status: 400 });
  }

  const newStartMin = timeToMinutes(horarioEscolhido);
  const newEndMin   = timeToMinutes(horarioFim);

  // ── Transação atômica ─────────────────────────────────────────────────────
  // Garante que todos os READs precedem todos os WRITEs (requisito do Firestore)
  let leadData: any;

  try {
    await dbAdmin.runTransaction(async (tx: any) => {
      const profRef  = dbAdmin.collection("professionals").doc(professionalId);
      const leadRef  = profRef.collection("leads").doc(leadId);
      const slotsRef = profRef.collection("availableSlots");

      // ── READs ──────────────────────────────────────────────────────────────

      // 1. Ler lead atual
      const leadSnap = await tx.get(leadRef);
      if (!leadSnap.exists) {
        throw Object.assign(new Error("lead-not-found"), { httpStatus: 404 });
      }
      leadData = leadSnap.data()!;

      // 2. Verificar ownership dentro da transação
      if (leadData.professionalId && leadData.professionalId !== professionalId) {
        throw Object.assign(new Error("lead-wrong-owner"), { httpStatus: 403 });
      }

      // 3. Ler configuração do slot do profissional para saber duração padrão
      const profSnap = await tx.get(profRef);
      const slotDuration: number = profSnap.data()?.agendaConfig?.duracaoSlot ?? 30;

      // 4. Ler índice privado de slots antigos (SEC-005 — sem bookingId nos slots)
      const slotBookingsRef = profRef.collection("slotBookings").doc(leadId);
      const slotBookingsSnap = await tx.get(slotBookingsRef);
      const oldSlotIds: Set<string> = new Set(
        slotBookingsSnap.exists ? (slotBookingsSnap.data()!.slotIds as string[]) : []
      );

      // 5. Ler slots antigos por ID (a partir do índice)
      const oldSlotRefs = Array.from(oldSlotIds).map(id => slotsRef.doc(id));
      const oldSlotSnaps = await Promise.all(oldSlotRefs.map(r => tx.get(r)));

      // 6. Ler TODOS os slots do novo dia para verificar disponibilidade
      const newDaySlotsSnap = await tx.get(slotsRef.where("data", "==", dataEscolhida));
      const allNewDaySlots: SlotEntry[] = newDaySlotsSnap.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => ({
        ref: d.ref,
        id: d.id,
        horario: d.data().horario as string,
        disponivel: d.data().disponivel as boolean,
      }));

      // 7. Calcular quais slots cobrem o novo intervalo
      const overlappingNew: SlotEntry[] = allNewDaySlots
        .filter((slot) => {
          const slotInicio = timeToMinutes(slot.horario);
          const slotFim    = slotInicio + slotDuration;
          return slotInicio < newEndMin && slotFim > newStartMin;
        })
        .sort((a, b) => timeToMinutes(a.horario) - timeToMinutes(b.horario));

      // 8. Validar cobertura sem lacunas
      let isCovered = false;
      if (overlappingNew.length > 0) {
        const firstStart = timeToMinutes(overlappingNew[0].horario);
        const lastEnd    = timeToMinutes(overlappingNew[overlappingNew.length - 1].horario) + slotDuration;
        if (firstStart <= newStartMin && lastEnd >= newEndMin) {
          let hasGap = false;
          for (let i = 0; i < overlappingNew.length - 1; i++) {
            const curEnd   = timeToMinutes(overlappingNew[i].horario) + slotDuration;
            const nextStart = timeToMinutes(overlappingNew[i + 1].horario);
            if (curEnd < nextStart) { hasGap = true; break; }
          }
          if (!hasGap) isCovered = true;
        }
      }
      if (!isCovered) {
        throw Object.assign(new Error("slot-not-found"), { httpStatus: 400 });
      }

      // 9. Verificar disponibilidade — slots ocupados por outro booking
      const blocked = overlappingNew.filter(s => !s.disponivel && !oldSlotIds.has(s.id));
      if (blocked.length > 0) {
        throw Object.assign(new Error("slot-already-booked"), { httpStatus: 409 });
      }

      // 10. Ler índice do cliente (se existir) para atualização
      const customerUid: string | undefined = leadData.customerUid;
      let indexSnap: any = null;
      if (customerUid) {
        const indexRef = dbAdmin
          .collection("customerAccounts").doc(customerUid)
          .collection("bookings").doc(leadId);
        indexSnap = await tx.get(indexRef);
      }

      // ── WRITEs ─────────────────────────────────────────────────────────────
      const now = FieldValue.serverTimestamp();

      // 11. Liberar slots antigos — SEC-005: sem bookingId no slot
      oldSlotSnaps.forEach((snap: any) => {
        if (snap.exists) {
          tx.update(snap.ref, { disponivel: true, updatedAt: now });
        }
      });

      // 12. Reservar slots novos — SEC-005: sem bookingId no slot
      overlappingNew.forEach((slot) => {
        tx.update(slot.ref, { disponivel: false, updatedAt: now });
      });

      // 13. Atualizar índice privado slotBookings
      tx.set(slotBookingsRef, {
        slotIds: overlappingNew.map(s => s.id),
        updatedAt: now,
      });

      // 14. Atualizar o lead
      tx.update(leadRef, {
        dataEscolhida,
        horarioEscolhido,
        horarioInicio: horarioEscolhido,
        horarioFim,
        updatedAt: now,
      });

      // 15. Atualizar índice do cliente
      if (customerUid && indexSnap?.exists) {
        const indexRef = dbAdmin
          .collection("customerAccounts").doc(customerUid)
          .collection("bookings").doc(leadId);
        tx.update(indexRef, {
          date: dataEscolhida,
          startTime: horarioEscolhido,
          endTime: horarioFim,
          updatedAt: now,
        });
      }
    });
  } catch (err: any) {
    const httpStatus: number = err.httpStatus ?? 500;
    const msg =
      err.message === "lead-not-found"     ? "Agendamento não encontrado." :
      err.message === "lead-wrong-owner"   ? "Acesso negado." :
      err.message === "slot-not-found"     ? "Um ou mais horários do novo intervalo não estão disponíveis na agenda." :
      err.message === "slot-already-booked" ? "Este período já foi reservado por outro cliente." :
      "Erro interno ao reagendar.";
    if (httpStatus === 500) console.error("[reschedule]", err.code ?? err.message);
    return NextResponse.json({ error: msg }, { status: httpStatus });
  }

  // ── Sincroniza Google Calendar fora da transação (falha silenciosa) ────────
  if (leadData?.status === "Agendado") {
    try {
      const tokens = await getTokens(professionalId);
      if (tokens?.refresh_token) {
        if (leadData.calendarEventId) {
          await deleteCalendarEvent(professionalId, leadData.calendarEventId);
        }
        const newEventId = await createCalendarEvent(professionalId, {
          summary: `✅ ${leadData.nome} — ${leadData.servicoEscolhido}`,
          description: `Cliente: ${leadData.nome}\nTelefone: ${leadData.telefone}${leadData.observacao ? `\nObservações: ${leadData.observacao}` : ""}\n\n⏱️ Reagendado`,
          date: dataEscolhida,
          startTime: horarioEscolhido,
          endTime: horarioFim,
        });
        if (newEventId) {
          await dbAdmin
            .collection("professionals").doc(professionalId)
            .collection("leads").doc(leadId)
            .update({ calendarEventId: newEventId });
        }
      }
    } catch (calErr: any) {
      console.warn("[reschedule] Falha ao atualizar Calendar:", calErr.code ?? calErr.message);
    }
  }

  return NextResponse.json({ ok: true });
}
