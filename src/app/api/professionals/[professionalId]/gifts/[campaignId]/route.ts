import { NextRequest, NextResponse } from "next/server";
import { FieldValue, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { dbAdmin } from "@/lib/firebaseAdmin";
import { readJson, requireOwner, serverError } from "@/lib/apiOwner";
import { buildGiftClients, validateCampaign } from "@/lib/gifts";
import { campaignsCol, readCampaignLeads, readDeliveries, toCampaign } from "@/lib/giftsServer";
import { getSaoPauloToday } from "@/lib/timezone";

type Params = { params: Promise<{ professionalId: string; campaignId: string }> };

// GET: a campanha com as clientes do período (agendamentos juntos por cliente) e quem já recebeu.
// PATCH: altera nome e período. DELETE: exclui a campanha e o registro das entregas.
export async function GET(req: NextRequest, { params }: Params) {
  const { professionalId, campaignId } = await params;
  const denied = await requireOwner(req, professionalId);
  if (denied) return denied;
  try {
    const snap = await campaignsCol(professionalId).doc(campaignId).get();
    if (!snap.exists) return NextResponse.json({ error: "Brinde não encontrado." }, { status: 404 });
    const campaign = toCampaign(snap as QueryDocumentSnapshot);
    const [leads, deliveries] = await Promise.all([readCampaignLeads(professionalId, campaign), readDeliveries(professionalId, campaignId)]);
    return NextResponse.json(
      { campaign, clients: buildGiftClients(campaign, leads, deliveries), today: getSaoPauloToday() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return serverError("[gifts:get-one]", err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { professionalId, campaignId } = await params;
  const denied = await requireOwner(req, professionalId);
  if (denied) return denied;
  const parsed = validateCampaign(await readJson(req));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const ref = campaignsCol(professionalId).doc(campaignId);
    if (!(await ref.get()).exists) return NextResponse.json({ error: "Brinde não encontrado." }, { status: 404 });
    await ref.update({ ...parsed.data, updatedAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("[gifts:patch]", err);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { professionalId, campaignId } = await params;
  const denied = await requireOwner(req, professionalId);
  if (denied) return denied;
  try {
    const ref = campaignsCol(professionalId).doc(campaignId);
    const deliveries = await ref.collection("deliveries").get();
    // Lotes de até 400 (limite do Firestore: 500 operações por lote)
    for (let i = 0; i < deliveries.docs.length; i += 400) {
      const batch = dbAdmin.batch();
      deliveries.docs.slice(i, i + 400).forEach((d: QueryDocumentSnapshot) => batch.delete(d.ref));
      await batch.commit();
    }
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("[gifts:delete]", err);
  }
}
