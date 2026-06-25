import { NextRequest, NextResponse } from "next/server";
import { dbAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

type Params = { params: Promise<{ professionalId: string; memberId: string }> };

// ── PATCH: owner edita ficha do membro ────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  if (!dbAdmin || !authAdmin) return NextResponse.json({ error: "Config error." }, { status: 500 });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let callerUid: string;
  try {
    const decoded = await authAdmin.verifyIdToken(authHeader.slice(7));
    callerUid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Token inválido." }, { status: 401 });
  }

  const { professionalId, memberId } = await params;
  if (callerUid !== professionalId) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  // Verificar que o membro pertence ao owner
  const memberSnap = await dbAdmin.collection("professionals").doc(memberId).get();
  if (!memberSnap.exists || memberSnap.data()?.parentProfessionalId !== professionalId) {
    return NextResponse.json({ error: "Membro não encontrado." }, { status: 404 });
  }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }

  const { especialidade, cargo, whatsapp, permissions } = body ?? {};

  const teamConfig: any = {
    especialidade: typeof especialidade === "string" ? especialidade.trim() : (memberSnap.data()?.teamConfig?.especialidade ?? ""),
    cargo: typeof cargo === "string" ? cargo.trim() : (memberSnap.data()?.teamConfig?.cargo ?? ""),
    permissions: {
      canEditProfile:    permissions?.canEditProfile    ?? memberSnap.data()?.teamConfig?.permissions?.canEditProfile    ?? false,
      canEditServices:   permissions?.canEditServices   ?? memberSnap.data()?.teamConfig?.permissions?.canEditServices   ?? false,
      canManageSlots:    permissions?.canManageSlots    ?? memberSnap.data()?.teamConfig?.permissions?.canManageSlots    ?? false,
      canViewAllLeads:   permissions?.canViewAllLeads   ?? memberSnap.data()?.teamConfig?.permissions?.canViewAllLeads   ?? false,
    },
  };

  // WhatsApp individual é opcional — salva só se fornecido; remove se string vazia
  if (typeof whatsapp === "string") {
    const clean = whatsapp.replace(/\D/g, "");
    teamConfig.whatsapp = clean.length >= 10 ? clean : null;
  } else {
    teamConfig.whatsapp = memberSnap.data()?.teamConfig?.whatsapp ?? null;
  }

  // Espelha especialidade no campo de topo do documento (usado na página pública)
  await dbAdmin.collection("professionals").doc(memberId).update({
    teamConfig,
    especialidade: teamConfig.especialidade,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true });
}
