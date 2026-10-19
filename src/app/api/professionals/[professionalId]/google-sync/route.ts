import { NextRequest, NextResponse } from "next/server";
import { dbAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { reconcileGoogleCancellations } from "@/lib/leadSync";

type Params = { params: Promise<{ professionalId: string }> };

// POST: cancela no app os agendamentos cujo evento foi apagado no Google Agenda (limitado a 1x/2 min).
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
  if (!professionalId || callerUid !== professionalId) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  try {
    const result = await reconcileGoogleCancellations(professionalId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.warn("[google-sync]", err?.code ?? err?.message);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
