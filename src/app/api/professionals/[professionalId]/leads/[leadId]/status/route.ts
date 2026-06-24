import { NextRequest, NextResponse } from "next/server";
import { dbAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { isValidLeadStatus, type LeadStatus } from "@/lib/leadTypes";

type Params = { params: Promise<{ professionalId: string; leadId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!dbAdmin || !authAdmin) {
    return NextResponse.json(
      { error: "Erro de configuração no servidor: As credenciais do Firebase Admin não puderam ser carregadas." },
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

  // ── 3. Autorização: caller deve ser o próprio profissional ─────────────────
  // Arquitetura atual: professionalId === auth.uid (sem organizations)
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

  const allowedBodyKeys = ["status"];
  const extraKeys = Object.keys(body as object).filter((k) => !allowedBodyKeys.includes(k));
  if (extraKeys.length > 0) {
    return NextResponse.json(
      { error: `Campos extras não permitidos: ${extraKeys.join(", ")}.` },
      { status: 400 }
    );
  }

  const { status } = body as { status: unknown };
  if (!isValidLeadStatus(status)) {
    return NextResponse.json(
      { error: `Status inválido. Valores permitidos: Novo, Em contato, Agendado, Atendido, Cancelado, Perdido.` },
      { status: 400 }
    );
  }
  const newStatus: LeadStatus = status;

  // ── 5. Transação atômica ───────────────────────────────────────────────────
  try {
    await dbAdmin.runTransaction(async (tx: any) => {
      // a) Ler o lead principal
      const leadRef = dbAdmin
        .collection("professionals")
        .doc(professionalId)
        .collection("leads")
        .doc(leadId);

      const leadSnap = await tx.get(leadRef);

      if (!leadSnap.exists) {
        throw Object.assign(new Error("lead-not-found"), { httpStatus: 404 });
      }

      const leadData = leadSnap.data()!;

      // b) Confirmar propriedade do lead (defesa em profundidade)
      if (leadData.professionalId && leadData.professionalId !== professionalId) {
        throw Object.assign(new Error("lead-wrong-owner"), { httpStatus: 403 });
      }

      const now = FieldValue.serverTimestamp();

      // c) Atualizar o lead principal
      tx.update(leadRef, { status: newStatus, updatedAt: now });

      // d) Sincronizar o índice do cliente, se houver customerUid
      const customerUid: string | undefined = leadData.customerUid;
      if (customerUid) {
        const indexRef = dbAdmin
          .collection("customerAccounts")
          .doc(customerUid)
          .collection("bookings")
          .doc(leadId);

        const indexSnap = await tx.get(indexRef);

        if (indexSnap.exists) {
          // Atualizar somente campos que o cliente vê
          tx.update(indexRef, { status: newStatus, updatedAt: now });
        } else {
          // Índice ausente: situação anômala — o lead tem customerUid mas o índice
          // nunca foi criado (possível se o agendamento ocorreu antes do dual-auth,
          // ou se houve falha parcial). Registramos sem criar silenciosamente,
          // pois seria inconsistente criar agora sem os campos completos do índice.
          console.warn(
            `[lead-status] customerUid=${customerUid} tem lead ${leadId} sem índice em customerAccounts. ` +
              `Status atualizado apenas no lead principal. Corrija via vinculação retroativa.`
          );
        }
      }
    });

    return NextResponse.json({ ok: true, status: newStatus });
  } catch (err: any) {
    const httpStatus: number = err.httpStatus ?? 500;
    const msg =
      err.message === "lead-not-found"
        ? "Agendamento não encontrado."
        : err.message === "lead-wrong-owner"
          ? "Acesso negado."
          : "Erro interno ao atualizar status.";
    if (httpStatus === 500) console.error("[lead-status]", err);
    return NextResponse.json({ error: msg }, { status: httpStatus });
  }
}
