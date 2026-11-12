import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/apiOwner";
import { isRateLimited } from "@/lib/rateLimit";
import { sendPushToProf } from "@/lib/sendPush";

type Params = { params: Promise<{ professionalId: string }> };

// POST: manda um aviso de teste para os aparelhos em que o profissional ativou as notificações.
export async function POST(req: NextRequest, { params }: Params) {
  const { professionalId } = await params;
  const denied = await requireOwner(req, professionalId);
  if (denied) return denied;
  if (isRateLimited(`push-test:${professionalId}`, 5, 60_000)) {
    return NextResponse.json({ error: "Aguarde um minuto para enviar outro teste." }, { status: 429 });
  }
  const result = await sendPushToProf(professionalId, {
    title: "🔔 Teste de aviso do Retoria",
    body: "Os avisos de agendamento estão funcionando neste aparelho.",
  });
  return NextResponse.json({ ok: true, ...result });
}
