import { NextRequest, NextResponse } from "next/server";
import { dbAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue, type QueryDocumentSnapshot, type WriteBatch } from "firebase-admin/firestore";
import { validateCustomerEdit } from "@/lib/customerEdit";

type Params = { params: Promise<{ professionalId: string }> };

const BATCH_LIMIT = 400;

// Alteração do cadastro de um cliente pelo profissional (nome e telefone). `customers` só aceita
// escrita pelo Admin SDK. O nome e o telefone também são atualizados nos agendamentos desse cliente,
// e as notas privadas acompanham a troca de telefone.
export async function PATCH(req: NextRequest, { params }: Params) {
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

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const parsed = validateCustomerEdit(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { telefoneAtual, nome, telefone } = parsed;
  const phoneChanged = telefone !== telefoneAtual;

  const profRef = dbAdmin.collection("professionals").doc(professionalId);
  const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");

  try {
    // Telefones podem ter sido gravados com máscara em cadastros antigos: compara só os dígitos.
    const [customersSnap, leadsSnap] = await Promise.all([
      profRef.collection("customers").get(),
      profRef.collection("leads").get(),
    ]);
    const customerDocs = customersSnap.docs.filter((d: QueryDocumentSnapshot) => digits(d.data().telefone) === telefoneAtual);
    const leadDocs = leadsSnap.docs.filter((d: QueryDocumentSnapshot) => digits(d.data().telefone) === telefoneAtual);

    if (phoneChanged && customersSnap.docs.some((d: QueryDocumentSnapshot) => digits(d.data().telefone) === telefone)) {
      return NextResponse.json({ error: "Já existe um cliente cadastrado com este telefone." }, { status: 409 });
    }

    const writes: ((b: WriteBatch) => void)[] = [];
    const now = FieldValue.serverTimestamp();

    if (customerDocs.length === 0) {
      // Cliente que só existia nos agendamentos (antes do cadastro automático): cria o cadastro
      const ref = profRef.collection("customers").doc(`phone_${telefone}`);
      writes.push((b) => b.set(ref, { nome, telefone, customerUid: null, updatedAt: now }, { merge: true }));
    } else {
      customerDocs.forEach((d: QueryDocumentSnapshot) => writes.push((b) => b.update(d.ref, { nome, telefone, updatedAt: now })));
    }

    leadDocs.forEach((d: QueryDocumentSnapshot) => writes.push((b) => b.update(d.ref, { nome, telefone, updatedAt: now })));

    if (phoneChanged) {
      const oldNotesRef = profRef.collection("customerNotes").doc(telefoneAtual);
      const newNotesRef = profRef.collection("customerNotes").doc(telefone);
      const [oldNotes, newNotes] = await Promise.all([oldNotesRef.get(), newNotesRef.get()]);
      if (oldNotes.exists && !newNotes.exists) {
        const data = oldNotes.data() ?? {};
        writes.push((b) => b.set(newNotesRef, { ...data, updatedAt: new Date() }));
        writes.push((b) => b.delete(oldNotesRef));
      }
    }

    for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
      const batch = dbAdmin.batch();
      writes.slice(i, i + BATCH_LIMIT).forEach((w) => w(batch));
      await batch.commit();
    }

    return NextResponse.json({ ok: true, nome, telefone, leadsAtualizados: leadDocs.length });
  } catch (err) {
    console.error("[customer-edit]", (err as { code?: string; message?: string }).code ?? (err as Error).message);
    return NextResponse.json({ error: "Erro interno ao salvar o cadastro." }, { status: 500 });
  }
}
