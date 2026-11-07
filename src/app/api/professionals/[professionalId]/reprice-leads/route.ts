import { NextRequest, NextResponse } from "next/server";
import { dbAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { REPRICE_MIGRATION, repriceLead, type ServicePrice } from "@/lib/repricing";

type Params = { params: Promise<{ professionalId: string }> };

const BATCH_LIMIT = 400;

// Correção única, pedida pelo usuário em 06/11/2026: agendamentos a partir de 01/11/2026 passam a ter
// o valor do preço atual dos serviços. O painel chama esta rota sozinho ao abrir; ela roda uma vez por
// profissional (marca em `migracoes.<key>` no perfil) e guarda o valor antigo em `valorAnterior`.
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

  const { key, fromDate } = REPRICE_MIGRATION;

  try {
    const profRef = dbAdmin.collection("professionals").doc(professionalId);
    const profSnap = await profRef.get();
    if (profSnap.data()?.migracoes?.[key]) {
      return NextResponse.json({ ok: true, alreadyDone: true, updated: 0 });
    }

    const [leadsSnap, servicesSnap] = await Promise.all([
      profRef.collection("leads").where("dataEscolhida", ">=", fromDate).get(),
      profRef.collection("services").get(),
    ]);

    const services = new Map<string, ServicePrice>();
    servicesSnap.docs.forEach((d: QueryDocumentSnapshot) => services.set(d.id, { nome: d.data().nome, preco: d.data().preco }));

    const leadDocs: QueryDocumentSnapshot[] = leadsSnap.docs;
    const changes = leadDocs
      .map((d) => {
        const l = d.data();
        const result = repriceLead(l, services);
        if (!result?.changed) return null;
        return { ref: d.ref, servicos: result.servicos, valorNovo: result.valorTotal, valorAntigo: typeof l.valorTotal === "number" ? l.valorTotal : null };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    for (let i = 0; i < changes.length; i += BATCH_LIMIT) {
      const batch = dbAdmin.batch();
      changes.slice(i, i + BATCH_LIMIT).forEach((c) => {
        batch.update(c.ref, {
          servicos: c.servicos,
          valorTotal: c.valorNovo,
          valorAnterior: c.valorAntigo,
          valorOrigem: "preco-atual-servico",
          valorAtualizadoEm: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
    }

    // Marca como feita só depois de gravar tudo: se algo falhar no meio, a próxima abertura do painel tenta de novo
    await profRef.set(
      { migracoes: { [key]: { feitoEm: FieldValue.serverTimestamp(), atualizados: changes.length, verificados: leadsSnap.size } } },
      { merge: true }
    );

    return NextResponse.json({ ok: true, alreadyDone: false, updated: changes.length, checked: leadsSnap.size });
  } catch (err) {
    console.error("[reprice-leads]", (err as { code?: string; message?: string }).code ?? (err as Error).message);
    return NextResponse.json({ error: "Erro interno ao atualizar os valores." }, { status: 500 });
  }
}
