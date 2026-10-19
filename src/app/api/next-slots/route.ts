import { NextRequest, NextResponse } from "next/server";
import { dbAdmin } from "@/lib/firebaseAdmin";
import { isRateLimited } from "@/lib/rateLimit";
import { computeNextSlots, parseServiceDurationMinutes, type LeadLike, type SlotLike } from "@/lib/availability";
import { addDaysSaoPaulo, getSaoPauloToday, isPastDateTimeSaoPaulo } from "@/lib/timezone";

// GET /api/next-slots?professionalId=...&services=id1,id2
// Devolve os próximos 3 horários realmente livres: dentro do expediente e sem choque com agendamentos.
export async function GET(req: NextRequest) {
  if (!dbAdmin) return NextResponse.json({ error: "Servidor indisponível." }, { status: 500 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? req.headers.get("x-real-ip") ?? "unknown";
  if (isRateLimited(`nextslots:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: "Muitas solicitações. Tente novamente em instantes." }, { status: 429 });
  }

  const professionalId = req.nextUrl.searchParams.get("professionalId") ?? "";
  const serviceIds = (req.nextUrl.searchParams.get("services") ?? "")
    .split(",").map(s => s.trim()).filter(Boolean);
  if (!professionalId || serviceIds.length === 0 || serviceIds.length > 10) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }

  try {
    const profRef = dbAdmin.collection("professionals").doc(professionalId);
    const profSnap = await profRef.get();
    if (!profSnap.exists) return NextResponse.json({ error: "Profissional não encontrado." }, { status: 404 });
    const prof = profSnap.data()!;

    const serviceSnaps = await Promise.all(serviceIds.map(id => profRef.collection("services").doc(id).get()));
    if (serviceSnaps.some(s => !s.exists || !s.data()?.ativo)) {
      return NextResponse.json({ error: "Serviço indisponível." }, { status: 400 });
    }
    const durationMin = serviceSnaps.reduce(
      (sum, s) => sum + parseServiceDurationMinutes(s.data()?.duracaoEstimada || "30 min"), 0
    );

    const slotStepMin = prof.agendaConfig?.duracaoSlot || 30;
    const windowDays = prof.agendaConfig?.janelaAgendamentoDias || 30;
    const today = getSaoPauloToday();
    const maxDate = addDaysSaoPaulo(today, windowDays);

    const slotsSnap = await profRef.collection("availableSlots")
      .where("data", ">=", today).where("data", "<=", maxDate).get();
    const slots: SlotLike[] = slotsSnap.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => ({ id: d.id, ...(d.data() as any) }));

    const leadsSnap = await profRef.collection("leads")
      .where("dataEscolhida", ">=", today).where("dataEscolhida", "<=", maxDate).get();
    const leads = leadsSnap.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => d.data() as LeadLike);

    const next = computeNextSlots({
      agendaConfig: prof.agendaConfig,
      slots, leads, durationMin, slotStepMin, count: 3,
      isPast: isPastDateTimeSaoPaulo,
    });

    return NextResponse.json(
      { slots: next.map(s => ({ id: s.id, data: s.data, horario: s.horario, disponivel: true })) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    console.error("[api/next-slots]", err?.code ?? err?.message);
    return NextResponse.json({ error: "Erro ao calcular horários." }, { status: 500 });
  }
}
