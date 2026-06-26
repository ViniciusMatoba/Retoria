import { NextRequest, NextResponse } from "next/server";
import { dbAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import crypto from "crypto";
import { PLANS, type PlanId } from "@/lib/licenseTypes";

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

// GET — lista todos os tokens
export async function GET(req: NextRequest) {
  if (!dbAdmin || !authAdmin) return NextResponse.json({ error: "Config error." }, { status: 500 });
  const adminUid = await verifyAdmin(req);
  if (!adminUid) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const snap = await dbAdmin.collection("licenseTokens").orderBy("createdAt", "desc").limit(100).get();
  const tokens = snap.docs.map((d: any) => ({ token: d.id, ...d.data() }));
  return NextResponse.json({ tokens });
}

// POST — gera novo token
export async function POST(req: NextRequest) {
  if (!dbAdmin || !authAdmin) return NextResponse.json({ error: "Config error." }, { status: 500 });
  const adminUid = await verifyAdmin(req);
  if (!adminUid) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }

  const { plan, contractDays, label } = body ?? {};

  if (!plan || !PLANS[plan as PlanId]) {
    return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
  }
  if (!contractDays || contractDays < 1 || contractDays > 3650) {
    return NextResponse.json({ error: "contractDays deve ser entre 1 e 3650." }, { status: 400 });
  }

  const planConfig = PLANS[plan as PlanId];
  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + contractDays * 24 * 60 * 60 * 1000);

  await dbAdmin.collection("licenseTokens").doc(token).set({
    plan,
    contractDays,
    trialDays: planConfig.trialDays,
    label: label?.trim() ?? "",
    createdByAdminUid: adminUid,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt,
    usedAt: null,
    usedByUid: null,
  });

  return NextResponse.json({ token });
}
