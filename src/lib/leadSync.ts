import { dbAdmin } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendarEventState,
  getTokens,
  updateCalendarEvent,
  type CalendarEventParams,
} from "@/lib/googleCalendar";
import { overlapsActiveLead, type LeadLike } from "@/lib/availability";
import { getSaoPauloToday, minutesToTime, timeToMinutes } from "@/lib/timezone";

const PENDING_STATUSES = new Set(["Novo", "Em contato"]);
const ACTIVE_STATUSES = new Set(["Novo", "Em contato", "Agendado"]);

export function buildEventParams(lead: any): CalendarEventParams {
  const start: string = lead.horarioInicio ?? lead.horarioEscolhido;
  const end: string =
    lead.horarioFim ?? minutesToTime(timeToMinutes(start) + (lead.duracaoAgendamento || 30));
  const tentative = PENDING_STATUSES.has(lead.status);

  const details =
    `Cliente: ${lead.nome}\nTelefone: ${lead.telefone}` +
    (lead.observacao ? `\nObservações: ${lead.observacao}` : "");

  return {
    summary: tentative
      ? `⏳ Pendente — ${lead.nome} — ${lead.servicoEscolhido}`
      : `✅ ${lead.nome} — ${lead.servicoEscolhido}`,
    description: tentative ? `${details}\n\n⏳ Aguardando confirmação no Retoria` : details,
    date: lead.dataEscolhida,
    startTime: start,
    endTime: end,
    tentative,
  };
}

// Faz o evento do Google refletir o estado atual do agendamento:
//  Novo/Em contato => provisório (tentative) · Agendado => confirmado · Cancelado/Perdido => removido.
export async function syncLeadEvent(professionalId: string, leadId: string): Promise<void> {
  const leadRef = dbAdmin
    .collection("professionals").doc(professionalId)
    .collection("leads").doc(leadId);
  const snap = await leadRef.get();
  if (!snap.exists) return;
  const lead = snap.data()!;

  const tokens = await getTokens(professionalId);
  if (!tokens?.refresh_token) return;

  const eventId: string | null = lead.calendarEventId ?? null;

  if (lead.status === "Cancelado" || lead.status === "Perdido") {
    if (eventId) {
      await deleteCalendarEvent(professionalId, eventId);
      await leadRef.update({ calendarEventId: null, updatedAt: FieldValue.serverTimestamp() });
    }
    return;
  }

  if (!ACTIVE_STATUSES.has(lead.status)) return; // Atendido etc.: mantém o evento como está

  const params = buildEventParams(lead);

  if (eventId) {
    const result = await updateCalendarEvent(professionalId, eventId, params);
    if (result === "ok" || result === "error") return;
    // "missing": o evento foi apagado; esta é uma ação explícita do profissional, então recria
  }

  const newId = await createCalendarEvent(professionalId, params);
  if (newId) {
    await leadRef.update({ calendarEventId: newId, updatedAt: FieldValue.serverTimestamp() });
  }
}

// Libera os slots de um agendamento. Usa o índice privado slotBookings; sem ele
// (agendamentos manuais), libera os slots do intervalo que nenhum outro agendamento ativo ocupa.
export async function releaseLeadSlots(professionalId: string, leadId: string): Promise<number> {
  const profRef = dbAdmin.collection("professionals").doc(professionalId);
  const slotsRef = profRef.collection("availableSlots");
  const now = FieldValue.serverTimestamp();

  const indexSnap = await profRef.collection("slotBookings").doc(leadId).get();
  const indexed: string[] = indexSnap.exists ? (indexSnap.data()!.slotIds ?? []) : [];

  if (indexed.length > 0) {
    const batch = dbAdmin.batch();
    indexed.forEach((id: string) => batch.update(slotsRef.doc(id), { disponivel: true, updatedAt: now }));
    await batch.commit();
    return indexed.length;
  }

  const leadSnap = await profRef.collection("leads").doc(leadId).get();
  if (!leadSnap.exists) return 0;
  const lead = leadSnap.data()!;
  const start = timeToMinutes(lead.horarioInicio ?? lead.horarioEscolhido);
  const end = lead.horarioFim ? timeToMinutes(lead.horarioFim) : start + (lead.duracaoAgendamento || 30);

  const [daySlots, dayLeads] = await Promise.all([
    slotsRef.where("data", "==", lead.dataEscolhida).get(),
    profRef.collection("leads").where("dataEscolhida", "==", lead.dataEscolhida).get(),
  ]);
  const otherLeads: LeadLike[] = dayLeads.docs.filter((d: any) => d.id !== leadId).map((d: any) => d.data() as LeadLike);
  const slotStep: number = (await profRef.get()).data()?.agendaConfig?.duracaoSlot ?? 30;

  const batch = dbAdmin.batch();
  let count = 0;
  daySlots.docs.forEach((d: any) => {
    const s = d.data();
    if (s.disponivel) return;
    const sStart = timeToMinutes(s.horario);
    const sEnd = sStart + slotStep;
    if (!(sStart < end && sEnd > start)) return;
    if (overlapsActiveLead(otherLeads, lead.dataEscolhida, sStart, sEnd, slotStep)) return;
    batch.update(d.ref, { disponivel: true, updatedAt: now });
    count++;
  });
  if (count > 0) await batch.commit();
  return count;
}

// Evento apagado/cancelado no Google => agendamento cancelado no app, slots liberados.
async function cancelLeadFromGoogle(professionalId: string, leadId: string): Promise<boolean> {
  const leadRef = dbAdmin
    .collection("professionals").doc(professionalId)
    .collection("leads").doc(leadId);

  const changed = await dbAdmin.runTransaction(async (tx: any) => {
    const snap = await tx.get(leadRef);
    if (!snap.exists) return false;
    const lead = snap.data()!;
    if (!ACTIVE_STATUSES.has(lead.status)) return false;

    let indexRef: any = null;
    let indexSnap: any = null;
    if (lead.customerUid) {
      indexRef = dbAdmin
        .collection("customerAccounts").doc(lead.customerUid)
        .collection("bookings").doc(leadId);
      indexSnap = await tx.get(indexRef);
    }

    const now = FieldValue.serverTimestamp();
    tx.update(leadRef, { status: "Cancelado", canceladoPor: "google", calendarEventId: null, updatedAt: now });
    if (indexSnap?.exists) tx.update(indexRef, { status: "Cancelado", updatedAt: now });
    return true;
  });

  if (changed) await releaseLeadSlots(professionalId, leadId);
  return changed;
}

const RECONCILE_MIN_INTERVAL_MS = 120_000;
const RECONCILE_MAX_LEADS = 40;

// Confere os agendamentos futuros que têm evento no Google e cancela os que foram apagados lá.
export async function reconcileGoogleCancellations(
  professionalId: string
): Promise<{ skipped: boolean; cancelled: number }> {
  const integrationRef = dbAdmin
    .collection("professionals").doc(professionalId)
    .collection("integrations").doc("google");
  const integration = (await integrationRef.get()).data();
  if (!integration?.connected) return { skipped: true, cancelled: 0 };

  const last: number = integration.lastReconcileAt ?? 0;
  if (Date.now() - last < RECONCILE_MIN_INTERVAL_MS) return { skipped: true, cancelled: 0 };
  await integrationRef.set({ lastReconcileAt: Date.now() }, { merge: true });

  const today = getSaoPauloToday();
  const leadsSnap = await dbAdmin
    .collection("professionals").doc(professionalId)
    .collection("leads")
    .where("dataEscolhida", ">=", today)
    .get();

  const candidates = leadsSnap.docs
    .filter((d: any) => ACTIVE_STATUSES.has(d.data().status) && d.data().calendarEventId)
    .slice(0, RECONCILE_MAX_LEADS);

  let cancelled = 0;
  for (let i = 0; i < candidates.length; i += 10) {
    const chunk = candidates.slice(i, i + 10);
    const results = await Promise.all(
      chunk.map(async (d: any) => {
        const state = await getCalendarEventState(professionalId, d.data().calendarEventId);
        if (state === "missing" || state === "cancelled") {
          return cancelLeadFromGoogle(professionalId, d.id);
        }
        return false;
      })
    );
    cancelled += results.filter(Boolean).length;
  }
  return { skipped: false, cancelled };
}
