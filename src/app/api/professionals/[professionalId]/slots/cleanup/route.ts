import { NextRequest, NextResponse } from "next/server";
import { dbAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import type * as FirebaseFirestore from "firebase-admin/firestore";

type Params = { params: Promise<{ professionalId: string }> };

/**
 * POST /api/professionals/[professionalId]/slots/cleanup
 *
 * SEC-005: slots não armazenam bookingId. O índice de quais slots pertencem
 * a cada lead fica em slotBookings/{leadId}.
 *
 * Algoritmo:
 * 1. Lê todos os documentos em slotBookings (um por lead)
 * 2. Para cada lead, verifica se está Cancelado, Perdido ou não existe
 * 3. Se sim, libera os slots listados e remove o documento slotBookings
 *
 * Retorna { fixed, checked } para auditoria.
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

  const profRef   = dbAdmin.collection("professionals").doc(professionalId);
  const slotsRef  = profRef.collection("availableSlots");
  const leadsRef  = profRef.collection("leads");
  const sbRef     = profRef.collection("slotBookings");

  // 1. Ler todos os índices slotBookings (um documento por lead ativo)
  const sbSnap = await sbRef.get();
  if (sbSnap.empty) {
    return NextResponse.json({ fixed: 0, checked: 0 });
  }

  const INACTIVE_STATUSES = new Set(["Cancelado", "Perdido"]);
  type SBDoc = FirebaseFirestore.QueryDocumentSnapshot;

  // 2. Verificar status de cada lead em paralelo
  const results = await Promise.all(
    sbSnap.docs.map(async (sbDoc: SBDoc) => {
      const leadId = sbDoc.id;
      const slotIds: string[] = sbDoc.data().slotIds ?? [];

      const leadSnap = await leadsRef.doc(leadId).get();
      const shouldRelease =
        !leadSnap.exists || INACTIVE_STATUSES.has(leadSnap.data()?.status);

      return { leadId, slotIds, sbDocRef: sbDoc.ref, shouldRelease };
    })
  );

  const toRelease = results.filter((r) => r.shouldRelease);

  if (toRelease.length === 0) {
    return NextResponse.json({ fixed: 0, checked: sbSnap.size });
  }

  // 3. Liberar slots em batches de 500 (limite Firestore)
  const BATCH_SIZE = 500;
  const now = FieldValue.serverTimestamp();

  // Flatten: { slotId, sbDocRef (só do primeiro slot do lead para deletar depois) }
  const allSlotIds = toRelease.flatMap((r) => r.slotIds);
  const sbDocRefs  = toRelease.map((r) => r.sbDocRef);

  for (let i = 0; i < allSlotIds.length; i += BATCH_SIZE) {
    const batch = dbAdmin.batch();
    allSlotIds.slice(i, i + BATCH_SIZE).forEach((slotId) => {
      batch.update(slotsRef.doc(slotId), { disponivel: true, updatedAt: now });
    });
    await batch.commit();
  }

  // 4. Remover documentos slotBookings dos leads liberados
  for (let i = 0; i < sbDocRefs.length; i += BATCH_SIZE) {
    const batch = dbAdmin.batch();
    sbDocRefs.slice(i, i + BATCH_SIZE).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }

  return NextResponse.json({ fixed: allSlotIds.length, checked: sbSnap.size });
}
