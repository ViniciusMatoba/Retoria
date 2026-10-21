import { NextRequest, NextResponse } from "next/server";
import { dbAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

type Params = { params: Promise<{ professionalId: string }> };

// Preenche valorTotal em agendamentos antigos que não o têm (ex.: manuais criados antes da correção),
// usando o preço atual do serviço. Nunca sobrescreve um valorTotal existente; é idempotente.
export async function POST(req: NextRequest, { params }: Params) {
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

  const { professionalId } = await params;
  if (!professionalId || callerUid !== professionalId) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  try {
    const profRef = dbAdmin.collection("professionals").doc(professionalId);
    const [leadsSnap, servicesSnap] = await Promise.all([
      profRef.collection("leads").get(),
      profRef.collection("services").get(),
    ]);

    const services = new Map<string, any>();
    servicesSnap.docs.forEach((d: any) => services.set(d.id, d.data()));

    const targets = leadsSnap.docs.filter((d: any) => {
      const l = d.data();
      if (typeof l.valorTotal === "number") return false;
      const svc = l.serviceId ? services.get(l.serviceId) : null;
      return !!svc && typeof svc.preco === "number";
    });

    const BATCH = 400;
    for (let i = 0; i < targets.length; i += BATCH) {
      const batch = dbAdmin.batch();
      targets.slice(i, i + BATCH).forEach((d: any) => {
        const l = d.data();
        const svc = services.get(l.serviceId);
        batch.update(d.ref, {
          servicos: [{
            id: l.serviceId,
            nome: svc.nome ?? l.servicoEscolhido ?? "",
            preco: svc.preco,
            exibirPreco: svc.exibirPreco ?? true,
            duracaoEstimada: svc.duracaoEstimada || "30 min",
            duracaoMin: Number(l.duracaoAgendamento) || 30,
          }],
          valorTotal: svc.preco,
          valorOrigem: "preco-atual-servico",
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
    }

    return NextResponse.json({ ok: true, updated: targets.length });
  } catch (err: any) {
    console.warn("[backfill-values]", err?.code ?? err?.message);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
