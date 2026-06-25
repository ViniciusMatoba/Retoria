import { NextRequest, NextResponse } from "next/server";
import { dbAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

type Params = { params: Promise<{ token: string }> };

// ── GET: ler dados do convite (sem autenticação) ────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  if (!dbAdmin) return NextResponse.json({ error: "Config error." }, { status: 500 });

  const { token } = await params;
  const snap = await dbAdmin.collection("teamInvites").doc(token).get();

  if (!snap.exists) return NextResponse.json({ error: "Convite não encontrado." }, { status: 404 });

  const data = snap.data()!;
  if (data.status !== "pending") {
    return NextResponse.json({ error: "Este convite já foi utilizado ou expirou." }, { status: 410 });
  }

  const expires = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
  if (expires < new Date()) {
    return NextResponse.json({ error: "Este convite expirou." }, { status: 410 });
  }

  return NextResponse.json({
    nome: data.nome,
    email: data.email,
    especialidade: data.especialidade ?? "",
    ownerNomeNegocio: data.ownerNomeNegocio ?? "",
  });
}

// ── POST: aceitar convite (cria conta + documento profissional) ─────────────
export async function POST(req: NextRequest, { params }: Params) {
  if (!dbAdmin || !authAdmin) return NextResponse.json({ error: "Config error." }, { status: 500 });

  const { token } = await params;
  const snap = await dbAdmin.collection("teamInvites").doc(token).get();

  if (!snap.exists) return NextResponse.json({ error: "Convite não encontrado." }, { status: 404 });

  const invite = snap.data()!;
  if (invite.status !== "pending") {
    return NextResponse.json({ error: "Este convite já foi utilizado ou expirou." }, { status: 410 });
  }

  const expires = invite.expiresAt?.toDate ? invite.expiresAt.toDate() : new Date(invite.expiresAt);
  if (expires < new Date()) {
    return NextResponse.json({ error: "Este convite expirou." }, { status: 410 });
  }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }

  const { senha } = body ?? {};
  if (!senha || typeof senha !== "string" || senha.length < 6) {
    return NextResponse.json({ error: "Senha obrigatória (mínimo 6 caracteres)." }, { status: 400 });
  }

  // Criar conta Firebase Auth
  let userRecord: any;
  try {
    userRecord = await authAdmin.createUser({
      email: invite.email,
      password: senha,
      displayName: invite.nome,
    });
  } catch (e: any) {
    if (e.code === "auth/email-already-exists") {
      return NextResponse.json({ error: "Já existe uma conta com esse e-mail." }, { status: 409 });
    }
    console.error("[invite/accept]", e);
    return NextResponse.json({ error: "Erro ao criar conta." }, { status: 500 });
  }

  const memberUid = userRecord.uid;

  // Buscar dados do dono para herdar nomeNegocio e slugPublico base
  const ownerSnap = await dbAdmin.collection("professionals").doc(invite.ownerUid).get();
  const ownerData = ownerSnap.data() ?? {};

  // Gerar slug único para o membro
  const baseSlug = `${ownerData.slugPublico ?? "prof"}-${invite.nome.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}`;
  const slugPublico = `${baseSlug}-${memberUid.slice(-4)}`;

  // Criar documento do profissional membro
  await dbAdmin.collection("professionals").doc(memberUid).set({
    id: memberUid,
    userId: memberUid,
    email: invite.email,
    nome: invite.nome,
    nomeNegocio: ownerData.nomeNegocio ?? "",
    especialidade: invite.especialidade ?? "",
    slugPublico,
    telefoneWhatsapp: ownerData.telefoneWhatsapp ?? "",
    professionalStatus: "active",
    role: "team_member",
    parentProfessionalId: invite.ownerUid,
    themeConfig: ownerData.themeConfig ?? null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Marcar convite como aceito
  await dbAdmin.collection("teamInvites").doc(token).update({
    status: "accepted",
    memberUid,
    acceptedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true, memberUid });
}
