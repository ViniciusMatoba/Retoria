import { NextRequest, NextResponse } from "next/server";
import { dbAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { PLANS, type PlanId } from "@/lib/licenseTypes";

type Params = { params: Promise<{ token: string }> };

// GET — verifica token sem autenticação (para mostrar detalhes na página)
export async function GET(_req: NextRequest, { params }: Params) {
  if (!dbAdmin) return NextResponse.json({ error: "Config error." }, { status: 500 });
  const { token } = await params;

  const snap = await dbAdmin.collection("licenseTokens").doc(token).get();
  if (!snap.exists) return NextResponse.json({ error: "Link inválido ou expirado." }, { status: 404 });

  const data = snap.data()!;

  if (data.usedAt !== null) {
    return NextResponse.json({ error: "Este link já foi utilizado." }, { status: 410 });
  }

  const expiresAt: Date = data.expiresAt instanceof Date ? data.expiresAt : data.expiresAt.toDate();
  if (expiresAt < new Date()) {
    return NextResponse.json({ error: "Este link expirou." }, { status: 410 });
  }

  const plan = PLANS[data.plan as PlanId];

  return NextResponse.json({
    plan: data.plan,
    planLabel: plan?.label ?? data.plan,
    maxMembers: plan?.maxMembers ?? 0,
    contractDays: data.contractDays,
    trialDays: data.trialDays,
    label: data.label ?? "",
  });
}

// POST — cria conta + licença a partir do token
export async function POST(req: NextRequest, { params }: Params) {
  if (!dbAdmin || !authAdmin) return NextResponse.json({ error: "Config error." }, { status: 500 });
  const { token } = await params;

  // Verifica token atomicamente
  const tokenRef = dbAdmin.collection("licenseTokens").doc(token);
  const tokenSnap = await tokenRef.get();
  if (!tokenSnap.exists) return NextResponse.json({ error: "Link inválido." }, { status: 404 });

  const tokenData = tokenSnap.data()!;

  if (tokenData.usedAt !== null) {
    return NextResponse.json({ error: "Este link já foi utilizado." }, { status: 410 });
  }
  const expiresAt: Date = tokenData.expiresAt instanceof Date ? tokenData.expiresAt : tokenData.expiresAt.toDate();
  if (expiresAt < new Date()) {
    return NextResponse.json({ error: "Este link expirou." }, { status: 410 });
  }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }

  const { nome, email, password } = body ?? {};
  if (!nome || !email || !password) {
    return NextResponse.json({ error: "nome, email e password são obrigatórios." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Senha deve ter no mínimo 6 caracteres." }, { status: 400 });
  }

  // Verificar se e-mail já existe
  try {
    await authAdmin.getUserByEmail(email.toLowerCase().trim());
    return NextResponse.json({ error: "Já existe uma conta com este e-mail." }, { status: 409 });
  } catch (e: any) {
    if (e.code !== "auth/user-not-found") {
      return NextResponse.json({ error: "Erro ao verificar e-mail." }, { status: 500 });
    }
  }

  // Criar usuário no Firebase Auth
  let userRecord;
  try {
    userRecord = await authAdmin.createUser({
      email: email.toLowerCase().trim(),
      password,
      displayName: nome.trim(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erro ao criar conta." }, { status: 500 });
  }

  const uid = userRecord.uid;
  const now = new Date();
  const planConfig = PLANS[tokenData.plan as PlanId];
  const trialDays: number = tokenData.trialDays ?? 7;
  const contractDays: number = tokenData.contractDays ?? 30;

  const trialEndsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
  const currentPeriodEnd = new Date(now.getTime() + contractDays * 24 * 60 * 60 * 1000);

  const batch = dbAdmin.batch();

  // Professional doc (status onboarding — ainda precisa completar o perfil)
  batch.set(dbAdmin.collection("professionals").doc(uid), {
    id: uid,
    userId: uid,
    email: email.toLowerCase().trim(),
    nome: nome.trim(),
    nomeNegocio: "",
    slugPublico: "",
    telefoneWhatsapp: "",
    professionalStatus: "onboarding",
    plan: tokenData.plan,
    trialStartedAt: now,
    trialEndsAt,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // License doc
  batch.set(dbAdmin.collection("licenses").doc(uid), {
    uid,
    plan: tokenData.plan,
    status: "trial",
    maxMembers: planConfig?.maxMembers ?? 0,
    trialDays,
    trialEndsAt,
    contractDays,
    currentPeriodEnd,
    graceDays: planConfig?.graceDays ?? 3,
    sourceToken: token,
    activatedAt: now,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    suspendedAt: null,
  });

  // Mark token as used (uso único)
  batch.update(tokenRef, {
    usedAt: now,
    usedByUid: uid,
  });

  await batch.commit();

  return NextResponse.json({ uid, email: email.toLowerCase().trim() });
}
