import { NextRequest, NextResponse } from "next/server";
import { dbAdmin } from "@/lib/firebaseAdmin";
import { isRateLimited } from "@/lib/rateLimit";
import { isFullName, maskName } from "@/lib/nameUtils";
import { findPendingFee } from "@/lib/noShowFeeServer";
import { readNoShowFeeSettings } from "@/lib/leadStatus";

// GET /api/customer-lookup?professionalId=...&phone=...
// Reconhece cliente já cadastrado com ESTE profissional. Devolve só "Maria S." (nunca o nome completo).
// Com taxa de não comparecimento pendente, devolve também { valor, primeiroNome } para o aviso da página.
export async function GET(req: NextRequest) {
  if (!dbAdmin) return NextResponse.json({ found: false }, { status: 200 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? req.headers.get("x-real-ip") ?? "unknown";
  if (isRateLimited(`lookup:${ip}`, 20, 600_000)) {
    return NextResponse.json({ found: false, error: "rate-limited" }, { status: 429 });
  }

  const professionalId = req.nextUrl.searchParams.get("professionalId") ?? "";
  const phone = (req.nextUrl.searchParams.get("phone") ?? "").replace(/\D/g, "");
  if (!professionalId || phone.length < 10 || phone.length > 20) {
    return NextResponse.json({ found: false }, { status: 200 });
  }

  try {
    const snap = await dbAdmin
      .collection("professionals").doc(professionalId)
      .collection("customers")
      .where("telefone", "==", phone)
      .limit(1)
      .get();

    const fee = await findPendingFee(professionalId, phone);
    const chavePix = fee
      ? readNoShowFeeSettings((await dbAdmin.collection("professionals").doc(professionalId).get()).data()?.taxaNaoComparecimento).chavePix
      : "";
    const taxaPendente = fee ? { valor: fee.valor, primeiroNome: (fee.nome || "").trim().split(/\s+/)[0], chavePix } : null;

    const nome = snap.empty ? "" : String(snap.docs[0].data().nome ?? "");
    if (!nome || !isFullName(nome)) return NextResponse.json({ found: false, taxaPendente }, { headers: { "Cache-Control": "no-store" } });

    return NextResponse.json({ found: true, display: maskName(nome), taxaPendente }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    console.error("[api/customer-lookup]", err?.code ?? err?.message);
    return NextResponse.json({ found: false }, { status: 200 });
  }
}
