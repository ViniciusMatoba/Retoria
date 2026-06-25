import { NextRequest, NextResponse } from "next/server";
import { dbAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import crypto from "crypto";

type Params = { params: Promise<{ professionalId: string }> };

// ── GET: lista membros da equipe ───────────────────────────────────────────
export async function GET(req: NextRequest, { params }: Params) {
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

  const { professionalId } = await params;
  if (callerUid !== professionalId) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  // Membros ativos
  const membersSnap = await dbAdmin
    .collection("professionals")
    .where("parentProfessionalId", "==", professionalId)
    .where("role", "==", "team_member")
    .get();

  const members = membersSnap.docs.map((d: any) => ({
    id: d.id,
    nome: d.data().nome,
    especialidade: d.data().especialidade ?? "",
    fotoLogoUrl: d.data().fotoLogoUrl ?? null,
    professionalStatus: d.data().professionalStatus,
    email: d.data().email ?? null,
    teamConfig: d.data().teamConfig ?? null,
  }));

  // Convites pendentes
  const invitesSnap = await dbAdmin
    .collection("teamInvites")
    .where("ownerUid", "==", professionalId)
    .where("status", "==", "pending")
    .get();

  const invites = invitesSnap.docs.map((d: any) => ({
    token: d.id,
    email: d.data().email,
    nome: d.data().nome,
    createdAt: d.data().createdAt,
  }));

  const ownerSnap = await dbAdmin.collection("professionals").doc(professionalId).get();
  const teamSettings = ownerSnap.data()?.teamSettings ?? { whatsappMode: "single" };

  return NextResponse.json({ members, invites, teamSettings });
}

// ── POST: criar convite ────────────────────────────────────────────────────
export async function POST(req: NextRequest, { params }: Params) {
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

  const { professionalId } = await params;
  if (callerUid !== professionalId) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  // Validar que o caller é owner (role !== team_member)
  const ownerSnap = await dbAdmin.collection("professionals").doc(professionalId).get();
  if (!ownerSnap.exists) return NextResponse.json({ error: "Profissional não encontrado." }, { status: 404 });
  if (ownerSnap.data()?.role === "team_member") {
    return NextResponse.json({ error: "Membros da equipe não podem convidar outros membros." }, { status: 403 });
  }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }

  const { nome, email, especialidade, cargo, permissions } = body ?? {};
  if (!nome || typeof nome !== "string" || nome.trim().length < 2) {
    return NextResponse.json({ error: "Nome obrigatório (mínimo 2 caracteres)." }, { status: 400 });
  }
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
  }

  // Verificar limite de membros do plano
  const licenseSnap = await dbAdmin.collection("licenses").doc(professionalId).get();
  if (licenseSnap.exists()) {
    const license = licenseSnap.data()!;
    const maxMembers: number = license.maxMembers ?? 0;
    if (maxMembers !== -1) { // -1 = ilimitado
      const activeCount = (await dbAdmin.collection("professionals")
        .where("parentProfessionalId", "==", professionalId)
        .where("role", "==", "team_member")
        .where("professionalStatus", "==", "active")
        .get()).size;
      const pendingCount = (await dbAdmin.collection("teamInvites")
        .where("ownerUid", "==", professionalId)
        .where("status", "==", "pending")
        .get()).size;
      if (activeCount + pendingCount >= maxMembers) {
        return NextResponse.json(
          { error: `Limite de membros atingido para o seu plano (${maxMembers} membro${maxMembers !== 1 ? "s" : ""}). Faça upgrade para adicionar mais.` },
          { status: 403 }
        );
      }
    }
  }

  // Verificar se já existe membro ativo com esse e-mail
  try {
    await authAdmin.getUserByEmail(email.toLowerCase().trim());
    return NextResponse.json({ error: "Já existe uma conta com esse e-mail." }, { status: 409 });
  } catch (e: any) {
    if (e.code !== "auth/user-not-found") {
      return NextResponse.json({ error: "Erro ao verificar e-mail." }, { status: 500 });
    }
  }

  const token = crypto.randomBytes(32).toString("hex");

  const normalizedPermissions = {
    canEditProfile:  permissions?.canEditProfile  ?? false,
    canEditServices: permissions?.canEditServices ?? false,
    canManageSlots:  permissions?.canManageSlots  ?? false,
    canViewAllLeads: permissions?.canViewAllLeads ?? false,
  };

  await dbAdmin.collection("teamInvites").doc(token).set({
    ownerUid: professionalId,
    ownerNomeNegocio: ownerSnap.data()?.nomeNegocio ?? "",
    email: email.toLowerCase().trim(),
    nome: nome.trim(),
    especialidade: especialidade?.trim() ?? "",
    cargo: cargo?.trim() ?? "",
    permissions: normalizedPermissions,
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return NextResponse.json({ token });
}

// ── DELETE: remover membro ─────────────────────────────────────────────────
export async function DELETE(req: NextRequest, { params }: Params) {
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

  const { professionalId } = await params;
  if (callerUid !== professionalId) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { memberId, inviteToken } = body ?? {};

  if (inviteToken) {
    // Cancelar convite pendente
    const inviteSnap = await dbAdmin.collection("teamInvites").doc(inviteToken).get();
    if (!inviteSnap.exists || inviteSnap.data()?.ownerUid !== professionalId) {
      return NextResponse.json({ error: "Convite não encontrado." }, { status: 404 });
    }
    await dbAdmin.collection("teamInvites").doc(inviteToken).delete();
    return NextResponse.json({ ok: true });
  }

  if (!memberId) return NextResponse.json({ error: "memberId ou inviteToken obrigatório." }, { status: 400 });

  const memberSnap = await dbAdmin.collection("professionals").doc(memberId).get();
  if (!memberSnap.exists || memberSnap.data()?.parentProfessionalId !== professionalId) {
    return NextResponse.json({ error: "Membro não encontrado." }, { status: 404 });
  }

  await dbAdmin.collection("professionals").doc(memberId).update({
    professionalStatus: "suspended",
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true });
}

// ── PATCH: salvar teamSettings do owner (modo WhatsApp) ───────────────────
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

  const { professionalId } = await params;
  if (callerUid !== professionalId) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }

  const { whatsappMode } = body ?? {};
  if (whatsappMode !== "single" && whatsappMode !== "per_member") {
    return NextResponse.json({ error: "whatsappMode inválido." }, { status: 400 });
  }

  await dbAdmin.collection("professionals").doc(professionalId).update({
    "teamSettings.whatsappMode": whatsappMode,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true });
}
