import { NextRequest, NextResponse } from "next/server";
import { authAdmin } from "@/lib/firebaseAdmin";

const ADMIN_UIDS = (process.env.ADMIN_UIDS ?? "").split(",").map(s => s.trim()).filter(Boolean);

export async function GET(req: NextRequest) {
  if (!authAdmin) return NextResponse.json({ isAdmin: false }, { status: 200 });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return NextResponse.json({ isAdmin: false }, { status: 200 });

  try {
    const decoded = await authAdmin.verifyIdToken(authHeader.slice(7));
    return NextResponse.json({ isAdmin: ADMIN_UIDS.includes(decoded.uid) });
  } catch {
    return NextResponse.json({ isAdmin: false });
  }
}
