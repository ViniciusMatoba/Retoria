import { NextRequest, NextResponse } from "next/server";
import { dbAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue, DocumentSnapshot, DocumentData } from "firebase-admin/firestore";
import type { Transaction } from "firebase-admin/firestore";
import { deleteCalendarEvent } from "@/lib/googleCalendar";

type Params = { params: Promise<{ leadId: string }> };

// Estados que o cliente pode cancelar (não permite cancelar o que já foi atendido ou já cancelado)
const CANCELLABLE_STATUSES = new Set(["Novo", "Em contato", "Agendado"]);

export async function POST(req: NextRequest, { params }: Params) {
  if (!dbAdmin || !authAdmin) {
    return NextResponse.json({ error: "Servidor indisponível." }, { status: 500 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let customerUid: string;
  try {
    const decoded = await authAdmin.verifyIdToken(authHeader.slice(7));
    customerUid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Sessão inválida. Faça login novamente." }, { status: 401 });
  }

  const { leadId } = await params;
  if (!leadId) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  // Encontrar o lead no índice do cliente para obter o professionalId
  const bookingIndexRef = dbAdmin
    .collection("customerAccounts").doc(customerUid)
    .collection("bookings").doc(leadId);

  const indexSnap = await bookingIndexRef.get();
  if (!indexSnap.exists) {
    return NextResponse.json({ error: "Agendamento não encontrado." }, { status: 404 });
  }

  const indexData = indexSnap.data()!;
  const professionalId: string = indexData.professionalId;

  try {
    await dbAdmin.runTransaction(async (tx: Transaction) => {
      const leadRef = dbAdmin
        .collection("professionals").doc(professionalId)
        .collection("leads").doc(leadId);

      const leadSnap = await tx.get(leadRef) as unknown as DocumentSnapshot<DocumentData>;
      if (!leadSnap.exists) {
        throw Object.assign(new Error("lead-not-found"), { httpStatus: 404 });
      }

      const lead = leadSnap.data()!;

      // Verificar que o lead pertence a este cliente
      if (lead.customerUid !== customerUid) {
        throw Object.assign(new Error("not-owner"), { httpStatus: 403 });
      }

      // Só permite cancelar status canceláveis
      if (!CANCELLABLE_STATUSES.has(lead.status)) {
        throw Object.assign(new Error("not-cancellable"), { httpStatus: 422 });
      }

      const now = FieldValue.serverTimestamp();

      // Liberar slots via índice slotBookings
      const slotBookingsRef = dbAdmin
        .collection("professionals").doc(professionalId)
        .collection("slotBookings").doc(leadId);
      const slotBookingsSnap = await tx.get(slotBookingsRef) as unknown as DocumentSnapshot<DocumentData>;
      const slotIds: string[] = slotBookingsSnap.exists
        ? (slotBookingsSnap.data()!.slotIds as string[])
        : [];

      const slotsRef = dbAdmin.collection("professionals").doc(professionalId).collection("availableSlots");
      for (const slotId of slotIds) {
        tx.update(slotsRef.doc(slotId), { disponivel: true, updatedAt: now });
      }

      // Atualizar status do lead
      tx.update(leadRef, { status: "Cancelado", updatedAt: now });

      // Atualizar índice do cliente
      tx.update(bookingIndexRef, { status: "Cancelado", updatedAt: now });

      // Deletar evento do Google Calendar se existir
      if (lead.calendarEventId) {
        try {
          await deleteCalendarEvent(professionalId, lead.calendarEventId);
        } catch { /* silencioso — cancelamento prossegue mesmo sem Calendar */ }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    const status = err.httpStatus ?? 500;
    const messages: Record<string, string> = {
      "lead-not-found": "Agendamento não encontrado.",
      "not-owner": "Não autorizado.",
      "not-cancellable": "Este agendamento não pode mais ser cancelado.",
    };
    return NextResponse.json(
      { error: messages[err.message] ?? "Erro ao cancelar. Tente novamente." },
      { status }
    );
  }
}
