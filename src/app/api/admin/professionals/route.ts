import { NextRequest, NextResponse } from "next/server";
import { dbAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

const ADMIN_UIDS = (process.env.ADMIN_UIDS ?? "").split(",").map(s => s.trim()).filter(Boolean);

async function verifyAdmin(req: NextRequest): Promise<string | null> {
  const header = req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const decoded = await authAdmin!.verifyIdToken(header.slice(7));
    return ADMIN_UIDS.includes(decoded.uid) ? decoded.uid : null;
  } catch {
    return null;
  }
}

// Converte qualquer formato de timestamp para milissegundos Unix — mais confiável que ISO string
function toMs(ts: any): number | null {
  if (!ts) return null;
  try {
    if (typeof ts === "number") return ts;
    if (typeof ts === "string") { const d = new Date(ts); return isNaN(d.getTime()) ? null : d.getTime(); }
    if (ts instanceof Date) return isNaN(ts.getTime()) ? null : ts.getTime();
    if (typeof ts.toDate === "function") { const d = ts.toDate(); return isNaN(d.getTime()) ? null : d.getTime(); }
    if (ts._seconds != null) return ts._seconds * 1000 + Math.floor((ts._nanoseconds ?? 0) / 1e6);
    if (ts.seconds != null) return ts.seconds * 1000 + Math.floor((ts.nanoseconds ?? 0) / 1e6);
  } catch {}
  return null;
}

async function deleteSubcollection(parentPath: string, subcollection: string) {
  const snap = await dbAdmin!.collection(`${parentPath}/${subcollection}`).limit(500).get();
  if (snap.empty) return;
  const batch = dbAdmin!.batch();
  snap.docs.forEach((d: any) => batch.delete(d.ref));
  await batch.commit();
}

// GET — lista todos os profissionais owners
export async function GET(req: NextRequest) {
  if (!dbAdmin || !authAdmin) return NextResponse.json({ error: "Config error." }, { status: 500 });
  const adminUid = await verifyAdmin(req);
  if (!adminUid) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const profId = searchParams.get("id");

  // GET individual — detalhes completos de um cliente
  if (profId) {
    const [profSnap, licenseSnap] = await Promise.all([
      dbAdmin.collection("professionals").doc(profId).get(),
      dbAdmin.collection("licenses").doc(profId).get(),
    ]);
    if (!profSnap.exists) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });

    const data = profSnap.data()!;
    const license = licenseSnap.exists ? licenseSnap.data() : null;

    const [membersSnap, invitesSnap] = await Promise.all([
      dbAdmin.collection("professionals").where("parentProfessionalId", "==", profId).where("role", "==", "team_member").get(),
      dbAdmin.collection("teamInvites").where("ownerUid", "==", profId).get(),
    ]);

    const members = membersSnap.docs.map((d: any) => ({
      id: d.id,
      nome: d.data().nome ?? "",
      email: d.data().email ?? "",
      status: d.data().professionalStatus ?? "",
    }));

    return NextResponse.json({
      id: profId,
      nome: data.nome ?? "",
      nomeNegocio: data.nomeNegocio ?? "",
      email: data.email ?? "",
      telefone: data.telefoneWhatsapp ?? "",
      professionalStatus: data.professionalStatus ?? "",
      slugPublico: data.slugPublico ?? "",
      plan: license?.plan ?? data.plan ?? "individual",
      licenseStatus: license?.status ?? "trial",
      maxMembers: license?.maxMembers ?? 0,
      contractDays: license?.contractDays ?? 30,
      trialDays: license?.trialDays ?? 7,
      sourceToken: license?.sourceToken ?? null,
      activatedAt: toMs(license?.activatedAt ?? data.createdAt),
      trialEndsAt: toMs(license?.trialEndsAt ?? data.trialEndsAt),
      currentPeriodEnd: toMs(license?.currentPeriodEnd),
      suspendedAt: toMs(license?.suspendedAt),
      createdAt: toMs(data.createdAt),
      memberCount: membersSnap.size,
      pendingInvites: invitesSnap.size,
      members,
    });
  }

  // GET lista
  const snap = await dbAdmin.collection("professionals").orderBy("createdAt", "desc").limit(500).get();
  const ownerDocs = snap.docs.filter((d: any) => d.data().role !== "team_member");

  const professionals = await Promise.all(ownerDocs.map(async (d: any) => {
    const data = d.data();
    const membersSnap = await dbAdmin!.collection("professionals")
      .where("parentProfessionalId", "==", d.id)
      .where("role", "==", "team_member")
      .where("professionalStatus", "==", "active")
      .get();
    const licenseSnap = await dbAdmin!.collection("licenses").doc(d.id).get();
    const license = licenseSnap.exists ? licenseSnap.data() : null;

    return {
      id: d.id,
      nome: data.nome ?? "",
      nomeNegocio: data.nomeNegocio ?? "",
      email: data.email ?? "",
      professionalStatus: data.professionalStatus ?? "unknown",
      plan: license?.plan ?? data.plan ?? "individual",
      licenseStatus: license?.status ?? "trial",
      currentPeriodEnd: toMs(license?.currentPeriodEnd ?? data.trialEndsAt),
      trialEndsAt: toMs(license?.trialEndsAt ?? data.trialEndsAt),
      memberCount: membersSnap.size,
      maxMembers: license?.maxMembers ?? 0,
      createdAt: toMs(data.createdAt),
    };
  }));

  return NextResponse.json({ professionals });
}

// PATCH — suspender, reativar, upgrade de plano, renovar licença
export async function PATCH(req: NextRequest) {
  if (!dbAdmin || !authAdmin) return NextResponse.json({ error: "Config error." }, { status: 500 });
  const adminUid = await verifyAdmin(req);
  if (!adminUid) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }

  const { professionalId, action, plan, newPeriodEnd } = body ?? {};
  if (!professionalId) return NextResponse.json({ error: "professionalId obrigatório." }, { status: 400 });

  const licenseRef = dbAdmin.collection("licenses").doc(professionalId);
  const profRef = dbAdmin.collection("professionals").doc(professionalId);

  if (action === "suspend") {
    await licenseRef.set({ status: "suspended", suspendedAt: new Date(), updatedAt: new Date() }, { merge: true });
    await profRef.update({ professionalStatus: "suspended", updatedAt: new Date() });

  } else if (action === "reactivate") {
    await licenseRef.set({ status: "active", suspendedAt: null, updatedAt: new Date() }, { merge: true });
    await profRef.update({ professionalStatus: "active", updatedAt: new Date() });

  } else if (action === "upgrade" && plan) {
    const { PLANS } = await import("@/lib/licenseTypes");
    const planConfig = PLANS[plan as keyof typeof PLANS];
    if (!planConfig) return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
    const update: any = { plan, maxMembers: planConfig.maxMembers, status: "active", updatedAt: new Date() };
    if (newPeriodEnd) update.currentPeriodEnd = new Date(newPeriodEnd);
    await licenseRef.set(update, { merge: true });
    await profRef.update({ plan, professionalStatus: "active", updatedAt: new Date() });

  } else if (action === "renew" && newPeriodEnd) {
    await licenseRef.set({
      status: "active",
      currentPeriodEnd: new Date(newPeriodEnd),
      suspendedAt: null,
      updatedAt: new Date(),
    }, { merge: true });
    await profRef.update({ professionalStatus: "active", updatedAt: new Date() });

  } else {
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE — excluir cliente e todos os dados relacionados
export async function DELETE(req: NextRequest) {
  if (!dbAdmin || !authAdmin) return NextResponse.json({ error: "Config error." }, { status: 500 });
  const adminUid = await verifyAdmin(req);
  if (!adminUid) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }

  const { professionalId } = body ?? {};
  if (!professionalId) return NextResponse.json({ error: "professionalId obrigatório." }, { status: 400 });

  // Buscar membros da equipe para excluir também
  const membersSnap = await dbAdmin.collection("professionals")
    .where("parentProfessionalId", "==", professionalId)
    .where("role", "==", "team_member")
    .get();

  // Excluir subcoleções e dados de cada membro
  for (const memberDoc of membersSnap.docs) {
    const mid = memberDoc.id;
    await deleteSubcollection(`professionals/${mid}`, "services");
    await deleteSubcollection(`professionals/${mid}`, "availableSlots");
    await deleteSubcollection(`professionals/${mid}`, "leads");
    await dbAdmin.collection("professionals").doc(mid).delete();
    try { await authAdmin.deleteUser(mid); } catch {}
  }

  // Excluir subcoleções do owner
  await deleteSubcollection(`professionals/${professionalId}`, "services");
  await deleteSubcollection(`professionals/${professionalId}`, "availableSlots");
  await deleteSubcollection(`professionals/${professionalId}`, "leads");

  // Excluir convites pendentes
  const invitesSnap = await dbAdmin.collection("teamInvites").where("ownerUid", "==", professionalId).get();
  if (!invitesSnap.empty) {
    const batch = dbAdmin.batch();
    invitesSnap.docs.forEach((d: any) => batch.delete(d.ref));
    await batch.commit();
  }

  // Excluir doc do profissional e licença
  await dbAdmin.collection("licenses").doc(professionalId).delete();
  await dbAdmin.collection("professionals").doc(professionalId).delete();

  // Excluir usuário do Firebase Auth
  try { await authAdmin.deleteUser(professionalId); } catch {}

  return NextResponse.json({ ok: true });
}
