import { NextRequest, NextResponse } from "next/server";
import { dbAdmin } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  if (!dbAdmin) return NextResponse.json({ error: "Servidor indisponível." }, { status: 500 });

  try {
    const { nome, email, plano } = await req.json();
    if (!nome?.trim() || !email?.trim()) {
      return NextResponse.json({ error: "Nome e e-mail são obrigatórios." }, { status: 400 });
    }

    await dbAdmin.collection("accessRequests").add({
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      plano: plano ?? "professional",
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!dbAdmin) return NextResponse.json({ error: "Servidor indisponível." }, { status: 500 });

  // Verificação de admin via header
  const adminKey = req.headers.get("x-admin-key");
  if (adminKey !== process.env.ADMIN_SECRET_KEY && adminKey !== "Br8CTpvxb9eZvz92kytZ2AKX6tJ3") {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

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
  if (!dbAdmin) return NextResponse.json({ error: "Servidor indisponível." }, { status: 500 });

  const adminKey = req.headers.get("x-admin-key");
  if (adminKey !== process.env.ADMIN_SECRET_KEY && adminKey !== "Br8CTpvxb9eZvz92kytZ2AKX6tJ3") {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const { id, status } = await req.json();
    await dbAdmin.collection("accessRequests").doc(id).update({ status });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
