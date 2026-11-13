import { NextRequest, NextResponse } from "next/server";
import { FieldValue, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { readJson, requireOwner, serverError } from "@/lib/apiOwner";
import { validateCampaign } from "@/lib/gifts";
import { campaignsCol, readDeliveries, toCampaign } from "@/lib/giftsServer";

type Params = { params: Promise<{ professionalId: string }> };

const MAX_CAMPAIGNS = 30;

// GET: campanhas de brinde (mais recente primeiro), cada uma com quem já recebeu — usado pela tela Brindes
// e pelo selo em Leads e Lembretes. POST: cria uma campanha.
export async function GET(req: NextRequest, { params }: Params) {
  const { professionalId } = await params;
  const denied = await requireOwner(req, professionalId);
  if (denied) return denied;
  try {
    const snap = await campaignsCol(professionalId).get();
    const campaigns = (snap.docs as QueryDocumentSnapshot[]).map(toCampaign).sort((a, b) => b.inicio.localeCompare(a.inicio));
    const withDelivered = await Promise.all(
      campaigns.map(async (c) => {
        const deliveries = await readDeliveries(professionalId, c.id);
        return { ...c, delivered: Object.fromEntries(deliveries.map((d) => [d.key, { entregueEm: d.entregueEm, data: d.data }])) };
      })
    );
    return NextResponse.json({ campaigns: withDelivered }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return serverError("[gifts:get]", err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { professionalId } = await params;
  const denied = await requireOwner(req, professionalId);
  if (denied) return denied;
  const parsed = validateCampaign(await readJson(req));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const col = campaignsCol(professionalId);
    if ((await col.count().get()).data().count >= MAX_CAMPAIGNS) {
      return NextResponse.json({ error: "Limite de brindes cadastrados atingido. Exclua um antigo." }, { status: 400 });
    }
    const ref = await col.add({ ...parsed.data, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (err) {
    return serverError("[gifts:post]", err);
  }
}
