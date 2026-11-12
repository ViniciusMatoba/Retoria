import { after, NextRequest, NextResponse } from "next/server";
import { dbAdmin } from "@/lib/firebaseAdmin";
import { isRateLimited } from "@/lib/rateLimit";
import { formatDateFriendlySaoPaulo } from "@/lib/timezone";
import { cancelByCustomer, professionalBelongsToSlug, SELF_SERVICE_ERRORS, SelfServiceError } from "@/lib/customerSelfService";
import { sendPushToProf } from "@/lib/sendPush";

type Params = { params: Promise<{ slug: string }> };

const NO_STORE = { "Cache-Control": "no-store" };
const ID = /^[A-Za-z0-9_-]{1,128}$/;

// POST /api/p/{slug}/appointments/cancel  { telefone, id, pid }
// A cliente cancela o próprio agendamento (achado pela consulta por WhatsApp), com 12 h ou mais de antecedência.
// Sem senha: confere o telefone do agendamento, limita tentativas e avisa o profissional.
export async function POST(req: NextRequest, { params }: Params) {
  if (!dbAdmin) return NextResponse.json({ error: "Servidor indisponível." }, { status: 500 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? req.headers.get("x-real-ip") ?? "unknown";
  if (isRateLimited(`appointments-cancel:${ip}`, 5, 600_000)) {
    return NextResponse.json({ error: "Muitas tentativas. Tente novamente em alguns minutos." }, { status: 429, headers: NO_STORE });
  }

  let body: { telefone?: unknown; id?: unknown; pid?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400, headers: NO_STORE });
  }
  const phone = typeof body.telefone === "string" ? body.telefone.replace(/\D/g, "") : "";
  const id = typeof body.id === "string" ? body.id : "";
  const pid = typeof body.pid === "string" ? body.pid : "";
  if (phone.length < 10 || phone.length > 20 || !ID.test(id) || !ID.test(pid)) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers: NO_STORE });
  }

  const { slug } = await params;
  try {
    if (!(await professionalBelongsToSlug(slug, pid))) {
      return NextResponse.json({ error: SELF_SERVICE_ERRORS["nao-encontrado"].message }, { status: 404, headers: NO_STORE });
    }
    const lead = await cancelByCustomer(pid, id, phone);

    after(() =>
      sendPushToProf(pid, {
        title: `❌ Cancelado pela cliente — ${lead.nome ?? ""}`.trim(),
        body: `${lead.servicoEscolhido ?? "Agendamento"} · ${formatDateFriendlySaoPaulo(lead.dataEscolhida ?? "")} às ${lead.horarioInicio || lead.horarioEscolhido || ""}. O horário foi liberado.`,
      })
    );
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof SelfServiceError) {
      const e = SELF_SERVICE_ERRORS[err.code] ?? { status: 400, message: "Não foi possível cancelar." };
      return NextResponse.json({ error: e.message }, { status: e.status, headers: NO_STORE });
    }
    console.error("[api/p/appointments/cancel]", (err as { code?: string; message?: string }).code ?? (err as Error).message);
    return NextResponse.json({ error: "Não foi possível cancelar agora. Tente novamente." }, { status: 500, headers: NO_STORE });
  }
}
