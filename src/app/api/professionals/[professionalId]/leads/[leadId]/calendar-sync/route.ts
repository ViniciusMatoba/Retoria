import { NextRequest, NextResponse } from "next/server";
import { dbAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { syncLeadEvent } from "@/lib/leadSync";

type Params = { params: Promise<{ professionalId: string; leadId: string }> };

// POST: faz o evento do Google refletir o estado atual do agendamento (provisório/confirmado/removido).
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

  const { professionalId, leadId } = await params;
  if (!professionalId || !leadId) {
    return NextResponse.json({ error: "Parâmetros de rota inválidos." }, { status: 400 });
  }
  if (callerUid !== professionalId) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  try {
    await syncLeadEvent(professionalId, leadId);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.warn("[calendar-sync]", err?.code ?? err?.message);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
