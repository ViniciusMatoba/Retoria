import { NextRequest, NextResponse } from "next/server";
import { readJson, requireOwner, serverError } from "@/lib/apiOwner";
import { dbAdmin } from "@/lib/firebaseAdmin";
import { clientKey, inCampaign, isGiftEligible } from "@/lib/gifts";
import { campaignsCol, giftProfessionalIds } from "@/lib/giftsServer";

type Params = { params: Promise<{ professionalId: string; campaignId: string }> };

const ID = /^[A-Za-z0-9_-]{1,128}$/;

// POST { leadId, pid }: registra o brinde entregue à cliente desse agendamento.
// O documento é criado com o id = chave da cliente; se já existir, o Firestore recusa e a resposta é 409
// (a cliente já recebeu, mesmo que por outro agendamento ou em outro aparelho ao mesmo tempo).
// DELETE { key }: desfaz a entrega.
export async function POST(req: NextRequest, { params }: Params) {
  const { professionalId, campaignId } = await params;
  const denied = await requireOwner(req, professionalId);
  if (denied) return denied;
  const body = ((await readJson(req)) ?? {}) as { leadId?: unknown; pid?: unknown };
  const leadId = typeof body.leadId === "string" ? body.leadId : "";
  const pid = typeof body.pid === "string" && body.pid ? body.pid : professionalId;
  if (!ID.test(leadId) || !ID.test(pid)) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  try {
    const campaignRef = campaignsCol(professionalId).doc(campaignId);
    const campaign = (await campaignRef.get()).data();
    if (!campaign) return NextResponse.json({ error: "Brinde não encontrado." }, { status: 404 });
    if (pid !== professionalId && !(await giftProfessionalIds(professionalId)).includes(pid)) {
      return NextResponse.json({ error: "Agendamento não encontrado." }, { status: 404 });
    }
    const lead = (await dbAdmin.collection("professionals").doc(pid).collection("leads").doc(leadId).get()).data();
    if (!lead) return NextResponse.json({ error: "Agendamento não encontrado." }, { status: 404 });
    if (!inCampaign(campaign as { inicio: string; fim: string }, lead.dataEscolhida) || !isGiftEligible(lead)) {
      return NextResponse.json({ error: "Este agendamento não participa deste brinde." }, { status: 422 });
    }
    const key = clientKey(lead.telefone, lead.nome);
    if (!key) return NextResponse.json({ error: "Agendamento sem nome e sem telefone." }, { status: 422 });

    const delivery = { nome: String(lead.nome ?? ""), leadId, pid, data: lead.dataEscolhida as string, entregueEm: Date.now() };
    try {
      await campaignRef.collection("deliveries").doc(key).create(delivery);
    } catch (err) {
      const code = (err as { code?: number | string }).code;
      if (code === 6 || code === "already-exists") {
        const existing = (await campaignRef.collection("deliveries").doc(key).get()).data();
        return NextResponse.json(
          { error: "Esta cliente já recebeu o brinde.", key, delivery: existing ? { entregueEm: existing.entregueEm, data: existing.data ?? null } : null },
          { status: 409 }
        );
      }
      throw err;
    }
    return NextResponse.json({ ok: true, key, delivery: { entregueEm: delivery.entregueEm, data: delivery.data } });
  } catch (err) {
    return serverError("[gifts:deliver]", err);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { professionalId, campaignId } = await params;
  const denied = await requireOwner(req, professionalId);
  if (denied) return denied;
  const body = ((await readJson(req)) ?? {}) as { key?: unknown };
  const key = typeof body.key === "string" ? body.key : "";
  if (!ID.test(key)) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  try {
    await campaignsCol(professionalId).doc(campaignId).collection("deliveries").doc(key).delete();
    return NextResponse.json({ ok: true, key });
  } catch (err) {
    return serverError("[gifts:undo]", err);
  }
}
