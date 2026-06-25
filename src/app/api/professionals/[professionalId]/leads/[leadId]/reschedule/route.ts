import { NextRequest, NextResponse } from "next/server";
import { dbAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { createCalendarEvent, deleteCalendarEvent, getTokens } from "@/lib/googleCalendar";

type Params = { params: Promise<{ professionalId: string; leadId: string }> };

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

  // ── Atualiza Firestore ─────────────────────────────────────────────────────
  const leadRef = dbAdmin
    .collection("professionals").doc(professionalId)
    .collection("leads").doc(leadId);

  const leadSnap = await leadRef.get();
  if (!leadSnap.exists) {
    return NextResponse.json({ error: "Agendamento não encontrado." }, { status: 404 });
  }

  const leadData = leadSnap.data()!;

  if (leadData.professionalId && leadData.professionalId !== professionalId) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  await leadRef.update({
    dataEscolhida,
    horarioEscolhido,
    horarioInicio: horarioEscolhido,
    horarioFim,
    updatedAt: FieldValue.serverTimestamp(),
  });

  // ── Sincroniza Google Calendar (apenas se status "Agendado") ───────────────
  if (leadData.status === "Agendado") {
    try {
      const tokens = await getTokens(professionalId);
      if (tokens?.refresh_token) {
        // Remove evento antigo e cria novo com os horários atualizados
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
          await leadRef.update({ calendarEventId: newEventId });
        }
      }
    } catch (calErr) {
      console.warn("[reschedule] Falha ao atualizar Calendar:", calErr);
    }
  }

  return NextResponse.json({ ok: true });
}
