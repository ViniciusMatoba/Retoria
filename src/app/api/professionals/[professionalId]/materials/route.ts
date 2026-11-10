import { NextRequest, NextResponse } from "next/server";
import { FieldValue, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { dbAdmin } from "@/lib/firebaseAdmin";
import { readJson, requireOwner, serverError } from "@/lib/apiOwner";
import { validateMaterial } from "@/lib/costs";

type Params = { params: Promise<{ professionalId: string }> };

const MAX_MATERIALS = 300;

// GET: itens cadastrados (materiais, higiene, contas). POST: cadastra um item.
export async function GET(req: NextRequest, { params }: Params) {
  const { professionalId } = await params;
  const denied = await requireOwner(req, professionalId);
  if (denied) return denied;
  try {
    const snap = await dbAdmin.collection("professionals").doc(professionalId).collection("materials").get();
    const materials = snap.docs
      .map((d: QueryDocumentSnapshot) => {
        const x = d.data();
        return { id: d.id, nome: x.nome, categoria: x.categoria, unidade: x.unidade ?? "un", preco: x.preco ?? 0, fixo: x.fixo === true };
      })
      .sort((a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome, "pt-BR"));
    return NextResponse.json({ materials }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return serverError("[materials:get]", err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { professionalId } = await params;
  const denied = await requireOwner(req, professionalId);
  if (denied) return denied;
  const parsed = validateMaterial(await readJson(req));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const col = dbAdmin.collection("professionals").doc(professionalId).collection("materials");
    const count = await col.count().get();
    if (count.data().count >= MAX_MATERIALS) {
      return NextResponse.json({ error: "Limite de itens cadastrados atingido." }, { status: 400 });
    }
    const ref = await col.add({ ...parsed.data, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (err) {
    return serverError("[materials:post]", err);
  }
}
