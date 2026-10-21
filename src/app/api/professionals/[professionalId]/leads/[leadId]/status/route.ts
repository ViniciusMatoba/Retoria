import { NextRequest, NextResponse } from "next/server";
import { dbAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { isValidLeadStatus, type LeadStatus } from "@/lib/leadTypes";
import { syncLeadEvent, releaseLeadSlots } from "@/lib/leadSync";
import type * as FirebaseFirestore from "firebase-admin/firestore";

type Params = { params: Promise<{ professionalId: string; leadId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!dbAdmin || !authAdmin) {
    return NextResponse.json(
      { error: "Erro de configuração no servidor." },
      { status: 500 }
    );
  }

  // ── 1. Autenticação ────────────────────────────────────────────────────────
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

  // ── 2. Parâmetros de rota ──────────────────────────────────────────────────
  const { professionalId, leadId } = await params;
  if (!professionalId || !leadId) {
    return NextResponse.json({ error: "Parâmetros de rota inválidos." }, { status: 400 });
  }

  // ── 3. Autorização ─────────────────────────────────────────────────────────
  if (callerUid !== professionalId) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  // ── 4. Validar payload ─────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const extraKeys = Object.keys(body as object).filter((k) => k !== "status");
  if (extraKeys.length > 0) {
    return NextResponse.json(
      { error: `Campos extras não permitidos: ${extraKeys.join(", ")}.` },
      { status: 400 }
    );
  }

  const { status } = body as { status: unknown };
  if (!isValidLeadStatus(status)) {
    return NextResponse.json(
      { error: "Status inválido. Valores permitidos: Novo, Em contato, Agendado, Atendido, Cancelado, Perdido." },
      { status: 400 }
    );
  }
  const newStatus: LeadStatus = status;

  // ── 5. Transação atômica ───────────────────────────────────────────────────
  let leadData: any;
  try {
    await dbAdmin.runTransaction(async (tx: any) => {
      const leadRef = dbAdmin
        .collection("professionals").doc(professionalId)
        .collection("leads").doc(leadId);

      const leadSnap = await tx.get(leadRef);
      if (!leadSnap.exists) {
        throw Object.assign(new Error("lead-not-found"), { httpStatus: 404 });
      }

      leadData = leadSnap.data()!;

      if (leadData.professionalId && leadData.professionalId !== professionalId) {
        throw Object.assign(new Error("lead-wrong-owner"), { httpStatus: 403 });
      }

      // Cancelado/Perdido já liberaram os slots; reativar por aqui deixaria o agendamento
      // sem horário reservado. A reativação deve passar pela edição, que reserva os slots.
      const INACTIVE = ["Cancelado", "Perdido"];
      if (INACTIVE.includes(leadData.status) && !INACTIVE.includes(newStatus)) {
        throw Object.assign(new Error("reactivate-blocked"), { httpStatus: 409 });
      }

      // ── Todos os READs antes de qualquer WRITE ──────────────────────────────
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
      tx.update(leadRef, { status: newStatus, updatedAt: now });

      if (customerUid) {
        if (indexSnap?.exists) {
          const indexRef = dbAdmin
            .collection("customerAccounts").doc(customerUid)
            .collection("bookings").doc(leadId);
          tx.update(indexRef, { status: newStatus, updatedAt: now });
        } else {
          console.warn(`[lead-status] índice ausente para customerUid=${customerUid} lead=${leadId}`);
        }
      }
    });
  } catch (err: any) {
    const httpStatus: number = err.httpStatus ?? 500;
    const msg =
      err.message === "lead-not-found" ? "Agendamento não encontrado." :
      err.message === "lead-wrong-owner" ? "Acesso negado." :
      err.message === "reactivate-blocked" ? "Este agendamento foi cancelado e seu horário liberado. Para reativá-lo, use Editar agendamento na Agenda e escolha um horário." :
      "Erro interno ao atualizar status.";
    if (httpStatus === 500) console.error("[lead-status]", err);
    return NextResponse.json({ error: msg }, { status: httpStatus });
  }

  // ── 6. Google Calendar (fora da transação — falha silenciosa) ──────────────
  // Novo/Em contato => evento provisório; Agendado => confirmado; Cancelado/Perdido => removido.
  try {
    await syncLeadEvent(professionalId, leadId);
  } catch (calErr) {
    console.warn("[google-calendar] Falha ao sincronizar evento:", calErr);
  }

  // ── 7. Liberar slots quando cancelado ou perdido ────────────────────────────
  if (newStatus === "Cancelado" || newStatus === "Perdido") {
    try {
      await releaseLeadSlots(professionalId, leadId);
    } catch (slotErr) {
      console.warn("[lead-status] Falha ao liberar slots:", slotErr);
    }
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
