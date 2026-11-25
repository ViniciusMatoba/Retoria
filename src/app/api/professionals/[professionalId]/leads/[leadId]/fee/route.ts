import { NextRequest, NextResponse } from "next/server";
import { dbAdmin } from "@/lib/firebaseAdmin";
import { readJson, requireOwner, serverError } from "@/lib/apiOwner";

type Params = { params: Promise<{ professionalId: string; leadId: string }> };

// PATCH { acao: "paga" | "dispensada" | "pendente" }: dá baixa, dispensa ou volta a cobrar a taxa de não comparecimento.
// Com a taxa paga ou dispensada, a cliente volta a conseguir agendar pela página pública.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { professionalId, leadId } = await params;
  const denied = await requireOwner(req, professionalId);
  if (denied) return denied;
  const body = ((await readJson(req)) ?? {}) as { acao?: unknown };
  const acao = body.acao;
  if (acao !== "paga" && acao !== "dispensada" && acao !== "pendente") {
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  }
  try {
    const ref = dbAdmin.collection("professionals").doc(professionalId).collection("leads").doc(leadId);
    const lead = (await ref.get()).data();
    if (!lead?.taxaNaoComparecimento) return NextResponse.json({ error: "Este agendamento não tem taxa." }, { status: 404 });
    const fee = { ...lead.taxaNaoComparecimento, status: acao, resolvidaEm: acao === "pendente" ? null : Date.now() };
    await ref.update({ taxaNaoComparecimento: fee });
    return NextResponse.json({ ok: true, taxaNaoComparecimento: fee });
  } catch (err) {
    return serverError("[lead-fee]", err);
  }
}
