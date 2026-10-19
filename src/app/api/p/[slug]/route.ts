import { NextRequest, NextResponse } from "next/server";
import { dbAdmin } from "@/lib/firebaseAdmin";

type Params = { params: Promise<{ slug: string }> };

// Campos permitidos no DTO público do profissional.
// Nunca inclui: email, plan, professionalStatus, trialEndsAt, licenseStatus,
// currentPeriodEnd, maxMembers, userId, createdAt, updatedAt, role, parentProfessionalId.
const PUBLIC_PROF_FIELDS = new Set([
  "nome", "nomeNegocio", "slugPublico", "descricaoCurta", "fotoLogoUrl",
  "corPrincipal", "themeConfig", "instagram", "showPublicInstagram",
  "publicPhone", "showPublicPhone", "showPublicWhatsApp",
  "publicAddress", "showPublicAddress", "showMiniMap",
  "serviceLocationType", "showResponsibleName", "showWelcomeMessage",
  // Necessários para o fluxo de agendamento
  "telefoneWhatsapp",
  "teamSettings",
]);

// Subconjunto de agendaConfig exposto ao público
const PUBLIC_AGENDA_FIELDS = new Set(["duracaoSlot", "janelaAgendamentoDias"]);

function buildProfDto(id: string, data: FirebaseFirestore.DocumentData) {
  const dto: Record<string, unknown> = { id };
  for (const field of PUBLIC_PROF_FIELDS) {
    if (data[field] !== undefined) dto[field] = data[field];
  }
  if (data.slotSuggestion) {
    dto.slotSuggestion = {
      enabled: data.slotSuggestion.enabled !== false,
      requestMessage: typeof data.slotSuggestion.requestMessage === "string" ? data.slotSuggestion.requestMessage : undefined,
    };
  }
  if (data.agendaConfig) {
    const agendaDto: Record<string, unknown> = {};
    for (const f of PUBLIC_AGENDA_FIELDS) {
      if (data.agendaConfig[f] !== undefined) agendaDto[f] = data.agendaConfig[f];
    }
    dto.agendaConfig = agendaDto;
  }
  return dto;
}

export async function GET(_req: NextRequest, { params }: Params) {
  if (!dbAdmin) return NextResponse.json({ error: "Servidor indisponível." }, { status: 500 });

  const { slug } = await params;
  if (!slug || typeof slug !== "string") {
    return NextResponse.json({ error: "Slug inválido." }, { status: 400 });
  }

  try {
    const snap = await dbAdmin
      .collection("professionals")
      .where("slugPublico", "==", slug)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({ error: "Profissional não encontrado." }, { status: 404 });
    }

    const profDoc = snap.docs[0];
    const profData = profDoc.data();
    const profDto = buildProfDto(profDoc.id, profData);

    // Carregar membros da equipe com campos mínimos
    const membersSnap = await dbAdmin
      .collection("professionals")
      .where("parentProfessionalId", "==", profDoc.id)
      .where("role", "==", "team_member")
      .where("professionalStatus", "==", "active")
      .get();

    const teamMembers = membersSnap.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => ({
      id: d.id,
      nome: d.data().nome ?? "",
      especialidade: d.data().teamConfig?.especialidade ?? d.data().especialidade ?? "",
      fotoLogoUrl: d.data().fotoLogoUrl ?? null,
      whatsapp: d.data().teamConfig?.whatsapp ?? null,
    }));

    const whatsappMode: "single" | "per_member" =
      profData.teamSettings?.whatsappMode ?? "single";

    return NextResponse.json(
      { professional: profDto, teamMembers, whatsappMode },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (err: any) {
    console.error("[api/p/slug]", err?.code ?? err?.message);
    return NextResponse.json({ error: "Erro ao carregar dados." }, { status: 500 });
  }
}
