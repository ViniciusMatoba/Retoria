import { NextRequest, NextResponse } from "next/server";
import { dbAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import type * as FirebaseFirestore from "firebase-admin/firestore";

type Params = { params: Promise<{ professionalId: string }> };

/**
 * POST /api/professionals/[professionalId]/slots/cleanup
 *
 * Varre todos os slots com disponivel=false e bookingId preenchido.
 * Para cada um, verifica se o lead associado está Cancelado, Perdido ou
 * não existe mais. Se sim, libera o slot (disponivel=true, bookingId=null).
 *
 * Retorna { fixed, checked } com contadores para auditoria.
 */
export async function POST(req: NextRequest, { params }: Params) {
  if (!dbAdmin || !authAdmin) {
    return NextResponse.json({ error: "Configuração inválida." }, { status: 500 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let callerUid: string;
  try {
    const decoded = await authAdmin.verifyIdToken(authHeader.slice(7));
    callerUid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Token inválido." }, { status: 401 });
  }

  const { professionalId } = await params;
  if (callerUid !== professionalId) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const slotsRef = dbAdmin.collection("professionals").doc(professionalId).collection("availableSlots");
  const leadsRef = dbAdmin.collection("professionals").doc(professionalId).collection("leads");

  // Busca todos slots bloqueados — filtra bookingId em JS para evitar índice composto
  const blockedSnap = await slotsRef
    .where("disponivel", "==", false)
    .get();

  if (blockedSnap.empty) {
    return NextResponse.json({ fixed: 0, checked: 0 });
  }

  // Agrupa por bookingId para minimizar leituras
  type QSnap = FirebaseFirestore.QueryDocumentSnapshot;
  const rawIds = blockedSnap.docs
    .map((d: QSnap) => d.data().bookingId as string | undefined)
    .filter((id: string | undefined): id is string => !!id);
  const bookingIds: string[] = [...new Set<string>(rawIds)];

  const INACTIVE_STATUSES = new Set(["Cancelado", "Perdido"]);
  const shouldRelease = new Map<string, boolean>();

  await Promise.all(
    bookingIds.map(async (bid) => {
      const leadSnap = await leadsRef.doc(bid).get();
      if (!leadSnap.exists) {
        shouldRelease.set(bid, true);
      } else {
        const status = leadSnap.data()?.status;
        shouldRelease.set(bid, INACTIVE_STATUSES.has(status));
      }
    })
  );

  const toFree = blockedSnap.docs.filter((d: QSnap) => shouldRelease.get(d.data().bookingId));

  if (toFree.length === 0) {
    return NextResponse.json({ fixed: 0, checked: blockedSnap.size });
  }

  // Commit em batches de 500 (limite Firestore)
  const BATCH_SIZE = 500;
  for (let i = 0; i < toFree.length; i += BATCH_SIZE) {
    const batch = dbAdmin.batch();
    toFree.slice(i, i + BATCH_SIZE).forEach((d: FirebaseFirestore.QueryDocumentSnapshot) => {
      batch.update(d.ref, {
        disponivel: true,
        bookingId: null,
        ocupacaoTipo: null,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  }

  console.log(`[slots/cleanup] prof=${professionalId} checked=${blockedSnap.size} fixed=${toFree.length}`);
  return NextResponse.json({ fixed: toFree.length, checked: blockedSnap.size });
}
