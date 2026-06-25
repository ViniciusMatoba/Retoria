import { NextRequest, NextResponse } from "next/server";
import { authAdmin } from "@/lib/firebaseAdmin";
import { getAuthUrl } from "@/lib/googleCalendar";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const decoded = await authAdmin.verifyIdToken(authHeader.slice(7));
    const url = await getAuthUrl(decoded.uid);
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }
}
