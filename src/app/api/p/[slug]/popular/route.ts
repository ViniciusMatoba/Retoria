import { NextRequest, NextResponse } from "next/server";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { dbAdmin } from "@/lib/firebaseAdmin";
import { professionalBelongsToSlug } from "@/lib/customerSelfService";
import { addDaysSaoPaulo, getSaoPauloToday } from "@/lib/timezone";
import { mostRequestedService, POPULAR_WINDOW_DAYS, type PopularLead } from "@/lib/popularService";

type Params = { params: Promise<{ slug: string }> };

const ID = /^[A-Za-z0-9_-]{1,128}$/;
// Resultado público e igual para todos: guardado 1 h na borda do Vercel (não pesa a página nem o banco)
const CACHE = { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" };

// GET /api/p/{slug}/popular?pid=...  →  { serviceId } do serviço mais pedido (selo "Mais pedido"), ou null.
// Responde só o id do serviço; nenhum dado de cliente sai daqui.
export async function GET(req: NextRequest, { params }: Params) {
  if (!dbAdmin) return NextResponse.json({ serviceId: null });
  const { slug } = await params;
  const pid = req.nextUrl.searchParams.get("pid") ?? "";
  if (!ID.test(pid)) return NextResponse.json({ serviceId: null }, { status: 400 });
  try {
    if (!(await professionalBelongsToSlug(slug, pid))) return NextResponse.json({ serviceId: null }, { headers: CACHE });
    const since = addDaysSaoPaulo(getSaoPauloToday(), -POPULAR_WINDOW_DAYS);
    const snap = await dbAdmin.collection("professionals").doc(pid).collection("leads").where("dataEscolhida", ">=", since).get();
    const leads = snap.docs.map((d: QueryDocumentSnapshot) => {
      const x = d.data();
      return { status: x.status, dataEscolhida: x.dataEscolhida, serviceId: x.serviceId, servicos: x.servicos } as PopularLead;
    });
    return NextResponse.json({ serviceId: mostRequestedService(leads, since) }, { headers: CACHE });
  } catch (err) {
    console.error("[api/p/popular]", (err as { code?: string; message?: string }).code ?? (err as Error).message);
    return NextResponse.json({ serviceId: null });
  }
}
