import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { dbAdmin } from "@/lib/firebaseAdmin";
import { readJson, requireOwner, serverError } from "@/lib/apiOwner";
import { validateExpense } from "@/lib/costs";

type Params = { params: Promise<{ professionalId: string; expenseId: string }> };

// PATCH: corrige um lançamento (ex.: valor da conta de energia do mês). DELETE: apaga o lançamento.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { professionalId, expenseId } = await params;
  const denied = await requireOwner(req, professionalId);
  if (denied) return denied;
  const parsed = validateExpense(await readJson(req));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const ref = dbAdmin.collection("professionals").doc(professionalId).collection("expenses").doc(expenseId);
    if (!(await ref.get()).exists) return NextResponse.json({ error: "Lançamento não encontrado." }, { status: 404 });
    await ref.update({ ...parsed.data, updatedAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("[expenses:patch]", err);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { professionalId, expenseId } = await params;
  const denied = await requireOwner(req, professionalId);
  if (denied) return denied;
  try {
    await dbAdmin.collection("professionals").doc(professionalId).collection("expenses").doc(expenseId).delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("[expenses:delete]", err);
  }
}
