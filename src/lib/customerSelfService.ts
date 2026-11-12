import { FieldValue, type DocumentReference, type DocumentSnapshot, type Transaction } from "firebase-admin/firestore";
import { dbAdmin } from "@/lib/firebaseAdmin";
import { canCustomerChange, CUSTOMER_CHANGE_MIN_HOURS, type AppointmentSource } from "@/lib/customerAppointments";
import { releaseLeadSlots, syncLeadEvent } from "@/lib/leadSync";

// Cancelamento e remarcação feitos pela própria cliente na página pública (sem login, pelo WhatsApp).
// Regras em lib/customerAppointments (canCustomerChange): agendamento ativo e 12 h ou mais de antecedência.
// Só no servidor (Admin SDK).

export const SELF_SERVICE_ERRORS: Record<string, { status: number; message: string }> = {
  "nao-encontrado": { status: 404, message: "Agendamento não encontrado." },
  status: { status: 422, message: "Este agendamento não pode mais ser alterado." },
  "sem-horario": { status: 422, message: "Este agendamento não pode ser alterado por aqui. Fale com o profissional." },
  prazo: {
    status: 422,
    message: `Faltam menos de ${CUSTOMER_CHANGE_MIN_HOURS} horas para o horário. Para cancelar ou remarcar, fale com o profissional.`,
  },
};

export class SelfServiceError extends Error {
  constructor(public code: keyof typeof SELF_SERVICE_ERRORS | string) { super(code); }
}

// O profissional (dono ou membro ativo da equipe) pertence à página pública deste slug?
export async function professionalBelongsToSlug(slug: string, professionalId: string): Promise<boolean> {
  const ownerSnap = await dbAdmin.collection("professionals").where("slugPublico", "==", slug).limit(1).get();
  if (ownerSnap.empty) return false;
  const ownerId: string = ownerSnap.docs[0].id;
  if (ownerId === professionalId) return true;
  const member = (await dbAdmin.collection("professionals").doc(professionalId).get()).data();
  return !!member && member.parentProfessionalId === ownerId && member.role === "team_member" && member.professionalStatus === "active";
}

// Confere, dentro de uma transação, se a cliente deste telefone pode alterar o agendamento. Devolve os dados dele.
export async function readChangeableLead(tx: Transaction, professionalId: string, leadId: string, phoneDigits: string, nowMs: number) {
  const leadRef: DocumentReference = dbAdmin.collection("professionals").doc(professionalId).collection("leads").doc(leadId);
  const snap: DocumentSnapshot = await tx.get(leadRef);
  const lead = snap.data();
  // Telefone diferente responde igual a "não existe": não revela agendamentos de outras pessoas.
  if (!snap.exists || !lead || String(lead.telefone ?? "").replace(/\D/g, "") !== phoneDigits) throw new SelfServiceError("nao-encontrado");
  const check = canCustomerChange(lead as AppointmentSource, nowMs);
  if (!check.ok) throw new SelfServiceError(check.reason);

  const indexRef: DocumentReference | null = lead.customerUid
    ? dbAdmin.collection("customerAccounts").doc(lead.customerUid).collection("bookings").doc(leadId)
    : null;
  const indexExists = indexRef ? (await tx.get(indexRef)).exists : false;
  return { leadRef, lead, indexRef: indexExists ? indexRef : null };
}

// Marca o agendamento como cancelado pela cliente (parte de escrita da transação).
export function writeCustomerCancellation(
  tx: Transaction,
  target: Awaited<ReturnType<typeof readChangeableLead>>,
  extra: Record<string, unknown> = {}
) {
  const now = FieldValue.serverTimestamp();
  tx.update(target.leadRef, { status: "Cancelado", canceladoPor: "cliente", canceladoEm: now, updatedAt: now, ...extra });
  if (target.indexRef) tx.update(target.indexRef, { status: "Cancelado", updatedAt: now });
}

// Depois da transação: libera os horários e remove o evento do Google Agenda. Falhas não desfazem o cancelamento.
export async function afterCustomerCancellation(professionalId: string, leadId: string) {
  try { await releaseLeadSlots(professionalId, leadId); } catch (err) { console.error("[self-service] liberar horários", (err as Error).message); }
  try { await syncLeadEvent(professionalId, leadId); } catch (err) { console.warn("[self-service] Google Agenda", (err as Error).message); }
}

export async function cancelByCustomer(professionalId: string, leadId: string, phoneDigits: string) {
  const lead = await dbAdmin.runTransaction(async (tx: Transaction) => {
    const target = await readChangeableLead(tx, professionalId, leadId, phoneDigits, Date.now());
    writeCustomerCancellation(tx, target);
    return target.lead;
  });
  await afterCustomerCancellation(professionalId, leadId);
  return lead as { nome?: string; servicoEscolhido?: string; dataEscolhida?: string; horarioInicio?: string; horarioEscolhido?: string };
}
