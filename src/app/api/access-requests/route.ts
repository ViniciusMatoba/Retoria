import { NextRequest, NextResponse } from "next/server";
import { dbAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { isRateLimited } from "@/lib/rateLimit";

const ADMIN_UIDS = (process.env.ADMIN_UIDS ?? "").split(",").map(s => s.trim()).filter(Boolean);

async function verifyAdmin(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const decoded = await authAdmin!.verifyIdToken(authHeader.slice(7));
    return ADMIN_UIDS.includes(decoded.uid) ? decoded.uid : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (!dbAdmin) return NextResponse.json({ error: "Servidor indisponível." }, { status: 500 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";
  if (isRateLimited(`accessreq:${ip}`, 3, 3_600_000)) {
    return NextResponse.json({ error: "Muitas tentativas. Tente novamente mais tarde." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const nome = (body?.nome ?? "").trim();
    const email = (body?.email ?? "").trim().toLowerCase();
    const plano = body?.plano ?? "professional";

    if (!nome || !email) {
      return NextResponse.json({ error: "Nome e e-mail são obrigatórios." }, { status: 400 });
    }
    if (nome.length > 120 || email.length > 200) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }
    if (!["individual", "professional", "enterprise"].includes(plano)) {
      return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
    }

    await dbAdmin.collection("accessRequests").add({
      nome,
      email,
      plano,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!dbAdmin || !authAdmin) return NextResponse.json({ error: "Servidor indisponível." }, { status: 500 });

  const adminUid = await verifyAdmin(req);
  if (!adminUid) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  try {
    const snap = await dbAdmin
      .collection("accessRequests")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    const requests = snap.docs.map((d: any) => {
      const data = d.data();
      const ts = data.createdAt;
      let createdAt: number | null = null;
      if (ts?._seconds != null) createdAt = ts._seconds * 1000;
      else if (ts?.seconds != null) createdAt = ts.seconds * 1000;
      return { id: d.id, ...data, createdAt };
    });

    return NextResponse.json({ requests });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!dbAdmin || !authAdmin) return NextResponse.json({ error: "Servidor indisponível." }, { status: 500 });

  const adminUid = await verifyAdmin(req);
  if (!adminUid) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  try {
    const { id, status } = await req.json();
    if (!id || !["pending", "attended"].includes(status)) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }
    await dbAdmin.collection("accessRequests").doc(id).update({ status });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
