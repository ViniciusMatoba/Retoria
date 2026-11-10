import { NextRequest, NextResponse } from "next/server";
import { authAdmin, dbAdmin } from "@/lib/firebaseAdmin";

// Confere o token do Firebase e se quem chama é o próprio profissional da rota.
// Devolve uma resposta de erro pronta ou null quando pode seguir.
export async function requireOwner(req: NextRequest, professionalId: string): Promise<NextResponse | null> {
  if (!dbAdmin || !authAdmin) {
    return NextResponse.json({ error: "Erro de configuração no servidor." }, { status: 500 });
  }
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let callerUid: string;
  try {
    callerUid = (await authAdmin.verifyIdToken(authHeader.slice(7))).uid;
  } catch {
    return NextResponse.json({ error: "Token inválido ou expirado." }, { status: 401 });
  }
  if (!professionalId || callerUid !== professionalId) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }
  return null;
}

export const readJson = async (req: NextRequest): Promise<unknown | undefined> => {
  try { return await req.json(); } catch { return undefined; }
};

export const serverError = (tag: string, err: unknown) => {
  console.error(tag, (err as { code?: string; message?: string }).code ?? (err as Error).message);
  return NextResponse.json({ error: "Erro interno. Tente novamente." }, { status: 500 });
};
