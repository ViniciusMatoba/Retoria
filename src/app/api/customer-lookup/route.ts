import { NextRequest, NextResponse } from "next/server";
import { dbAdmin } from "@/lib/firebaseAdmin";
import { isRateLimited } from "@/lib/rateLimit";
import { isFullName, maskName } from "@/lib/nameUtils";

// GET /api/customer-lookup?professionalId=...&phone=...
// Reconhece cliente já cadastrado com ESTE profissional. Devolve só "Maria S." (nunca o nome completo).
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

    const nome = snap.empty ? "" : String(snap.docs[0].data().nome ?? "");
    if (!nome || !isFullName(nome)) return NextResponse.json({ found: false }, { headers: { "Cache-Control": "no-store" } });

    return NextResponse.json({ found: true, display: maskName(nome) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    console.error("[api/customer-lookup]", err?.code ?? err?.message);
    return NextResponse.json({ found: false }, { status: 200 });
  }
}
