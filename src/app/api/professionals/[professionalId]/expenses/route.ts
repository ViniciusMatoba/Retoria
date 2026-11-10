import { NextRequest, NextResponse } from "next/server";
import { FieldValue, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { dbAdmin } from "@/lib/firebaseAdmin";
import { readJson, requireOwner, serverError } from "@/lib/apiOwner";
import { validateExpense, type Expense } from "@/lib/costs";

type Params = { params: Promise<{ professionalId: string }> };

const isYmd = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
const MAX_BATCH = 50;

// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD: lançamentos do período (compras e contas).
export async function GET(req: NextRequest, { params }: Params) {
  const { professionalId } = await params;
  const denied = await requireOwner(req, professionalId);
  if (denied) return denied;
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!isYmd(from) || !isYmd(to) || from > to) {
    return NextResponse.json({ error: "Período inválido." }, { status: 400 });
  }
  try {
    const snap = await dbAdmin
      .collection("professionals").doc(professionalId).collection("expenses")
      .where("data", ">=", from).where("data", "<=", to)
      .get();
    const expenses: Expense[] = snap.docs
      .map((d: QueryDocumentSnapshot) => {
        const x = d.data();
        return {
          id: d.id,
          materialId: x.materialId ?? null,
          nome: x.nome,
          categoria: x.categoria,
          data: x.data,
          quantidade: x.quantidade ?? 1,
          valorUnitario: x.valorUnitario ?? x.total ?? 0,
          total: x.total ?? 0,
          observacao: x.observacao ?? "",
        };
      })
      .sort((a: Expense, b: Expense) => b.data.localeCompare(a.data) || a.nome.localeCompare(b.nome, "pt-BR"));
    return NextResponse.json({ expenses }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return serverError("[expenses:get]", err);
  }
}

// POST: um lançamento ({ ...gasto, atualizarPreco }) ou vários ({ itens: [...] }, ex.: contas fixas do mês).
// Com atualizarPreco, o preço do item cadastrado passa a ser o valor unitário desta compra.
export async function POST(req: NextRequest, { params }: Params) {
  const { professionalId } = await params;
  const denied = await requireOwner(req, professionalId);
  if (denied) return denied;
  const body = (await readJson(req)) as { itens?: unknown[]; atualizarPreco?: unknown } | undefined;
  const raw = Array.isArray(body?.itens) ? body.itens : [body];
  if (raw.length === 0 || raw.length > MAX_BATCH) return NextResponse.json({ error: "Nada para lançar." }, { status: 400 });

  const parsed = raw.map(validateExpense);
  const invalid = parsed.find((p) => !p.ok);
  if (invalid && !invalid.ok) return NextResponse.json({ error: invalid.error }, { status: 400 });

  try {
    const profRef = dbAdmin.collection("professionals").doc(professionalId);
    const batch = dbAdmin.batch();
    const ids: string[] = [];
    for (const p of parsed) {
      if (!p.ok) continue;
      const ref = profRef.collection("expenses").doc();
      ids.push(ref.id);
      batch.set(ref, { ...p.data, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      if (body?.atualizarPreco === true && p.data.materialId && parsed.length === 1) {
        const matRef = profRef.collection("materials").doc(p.data.materialId);
        if ((await matRef.get()).exists) {
          batch.update(matRef, { preco: p.data.valorUnitario, updatedAt: FieldValue.serverTimestamp() });
        }
      }
    }
    await batch.commit();
    return NextResponse.json({ ok: true, ids });
  } catch (err) {
    return serverError("[expenses:post]", err);
  }
}
