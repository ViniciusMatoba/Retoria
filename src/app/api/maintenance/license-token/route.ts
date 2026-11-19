import { NextRequest, NextResponse } from "next/server";
import { dbAdmin } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import crypto from "crypto";
import { PLANS } from "@/lib/licenseTypes";

// ROTA TEMPORÁRIA (2026-11-19): gera um link de ativação sem conta de administrador.
// Protegida por uma chave secreta que não está no código (aqui só o SHA-256 dela).
// Será removida logo após o uso.
const KEY_SHA256 = "720c4530faec6fa4deae3267454641ca07b7289bbfd5330cec93d6fa4dc07375";

function keyMatches(key: string | null): boolean {
  if (!key) return false;
  const got = crypto.createHash("sha256").update(key).digest();
  const want = Buffer.from(KEY_SHA256, "hex");
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

export async function POST(req: NextRequest) {
  if (!keyMatches(req.headers.get("x-maintenance-key"))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!dbAdmin) return NextResponse.json({ error: "Config error." }, { status: 500 });

  let body: { label?: string; contractDays?: number } = {};
  try { body = await req.json(); } catch { /* usa padrões */ }
  const contractDays = Number(body.contractDays) || 365;
  if (contractDays < 1 || contractDays > 3650) {
    return NextResponse.json({ error: "contractDays inválido." }, { status: 400 });
  }

  const token = crypto.randomBytes(24).toString("hex");
  await dbAdmin.collection("licenseTokens").doc(token).set({
    plan: "individual",
    contractDays,
    trialDays: PLANS.individual.trialDays,
    label: String(body.label ?? "").trim().slice(0, 80),
    createdByAdminUid: "maintenance-route",
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: new Date(Date.now() + contractDays * 24 * 60 * 60 * 1000),
    usedAt: null,
    usedByUid: null,
  });

  return NextResponse.json({ token });
}
