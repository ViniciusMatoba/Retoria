import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { dbAdmin } from "@/lib/firebaseAdmin";
import { readJson, requireOwner, serverError } from "@/lib/apiOwner";
import { validateMaterial } from "@/lib/costs";

type Params = { params: Promise<{ professionalId: string; materialId: string }> };

// PATCH: altera um item (nome, categoria, preço...). DELETE: remove o item; os lançamentos já feitos ficam.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { professionalId, materialId } = await params;
  const denied = await requireOwner(req, professionalId);
  if (denied) return denied;
  const parsed = validateMaterial(await readJson(req));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const ref = dbAdmin.collection("professionals").doc(professionalId).collection("materials").doc(materialId);
    if (!(await ref.get()).exists) return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
    await ref.update({ ...parsed.data, updatedAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("[materials:patch]", err);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { professionalId, materialId } = await params;
  const denied = await requireOwner(req, professionalId);
  if (denied) return denied;
  try {
    await dbAdmin.collection("professionals").doc(professionalId).collection("materials").doc(materialId).delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("[materials:delete]", err);
  }
}
