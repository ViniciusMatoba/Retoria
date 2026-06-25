import { NextRequest, NextResponse } from "next/server";
import { authAdmin } from "@/lib/firebaseAdmin";
import { disconnectGoogle } from "@/lib/googleCalendar";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const decoded = await authAdmin.verifyIdToken(authHeader.slice(7));
    await disconnectGoogle(decoded.uid);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }
}
