import { NextRequest, NextResponse } from "next/server";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { dbAdmin } from "@/lib/firebaseAdmin";
import { isRateLimited } from "@/lib/rateLimit";
import { getSaoPauloToday } from "@/lib/timezone";
import { splitAppointments, type AppointmentSource } from "@/lib/customerAppointments";

type Params = { params: Promise<{ slug: string }> };

const NO_STORE = { "Cache-Control": "no-store" };

// POST /api/p/{slug}/appointments  { telefone }
// Agendamentos do cliente com ESTE profissional (e equipe). O telefone vai no corpo para não ficar em URLs e logs.
// Sem senha: resposta mínima (ver lib/customerAppointments) e limite de tentativas contra varredura de números.
export async function POST(req: NextRequest, { params }: Params) {
  if (!dbAdmin) return NextResponse.json({ error: "Servidor indisponível." }, { status: 500 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? req.headers.get("x-real-ip") ?? "unknown";
  if (isRateLimited(`appointments:${ip}`, 10, 600_000)) {
    return NextResponse.json({ error: "Muitas consultas. Tente novamente em alguns minutos." }, { status: 429, headers: NO_STORE });
  }

  let body: { telefone?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400, headers: NO_STORE });
  }
  const phone = typeof body.telefone === "string" ? body.telefone.replace(/\D/g, "") : "";
  if (phone.length < 10 || phone.length > 20) {
    return NextResponse.json({ error: "Informe o WhatsApp com DDD." }, { status: 400, headers: NO_STORE });
  }

  const { slug } = await params;
  try {
    const profSnap = await dbAdmin.collection("professionals").where("slugPublico", "==", slug).limit(1).get();
    if (profSnap.empty) return NextResponse.json({ error: "Profissional não encontrado." }, { status: 404, headers: NO_STORE });

    const ownerId: string = profSnap.docs[0].id;
    const membersSnap = await dbAdmin
      .collection("professionals")
      .where("parentProfessionalId", "==", ownerId)
      .where("role", "==", "team_member")
      .where("professionalStatus", "==", "active")
      .get();
    const profIds: string[] = [ownerId, ...membersSnap.docs.map((d: QueryDocumentSnapshot) => d.id)];

    const snaps = await Promise.all(
      profIds.map((id) => dbAdmin.collection("professionals").doc(id).collection("leads").where("telefone", "==", phone).get())
    );
    const leads: AppointmentSource[] = snaps.flatMap((s) => s.docs.map((d: QueryDocumentSnapshot) => d.data() as AppointmentSource));

    return NextResponse.json(splitAppointments(leads, getSaoPauloToday()), { headers: NO_STORE });
  } catch (err) {
    console.error("[api/p/appointments]", (err as { code?: string; message?: string }).code ?? (err as Error).message);
    return NextResponse.json({ error: "Não foi possível consultar agora." }, { status: 500, headers: NO_STORE });
  }
}
