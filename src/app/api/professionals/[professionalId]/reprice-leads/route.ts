import { NextRequest, NextResponse } from "next/server";
import { dbAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { repriceLead, type ServicePrice } from "@/lib/repricing";

type Params = { params: Promise<{ professionalId: string }> };

const BATCH_LIMIT = 400;

// Atualiza o valor dos agendamentos a partir de uma data para o preço atual dos serviços.
// { fromDate, apply: false } só devolve a prévia (nada é gravado). Com apply: true grava,
// guardando o valor anterior em `valorAnterior` para conferência ou para desfazer.
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

  let body: { fromDate?: unknown; apply?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const fromDate = typeof body.fromDate === "string" ? body.fromDate : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
    return NextResponse.json({ error: "Informe a data inicial." }, { status: 400 });
  }
  const apply = body.apply === true;

  try {
    const profRef = dbAdmin.collection("professionals").doc(professionalId);
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
        return {
          ref: d.ref,
          servicos: result.servicos,
          row: {
            id: d.id,
            nome: String(l.nome ?? ""),
            data: String(l.dataEscolhida ?? ""),
            horario: String(l.horarioInicio || l.horarioEscolhido || ""),
            status: String(l.status ?? ""),
            servico: result.servicos.map((s) => s.nome).filter(Boolean).join(" + ") || String(l.servicoEscolhido ?? ""),
            valorAntigo: typeof l.valorTotal === "number" ? l.valorTotal : null,
            valorNovo: result.valorTotal,
          },
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => `${a.row.data} ${a.row.horario}`.localeCompare(`${b.row.data} ${b.row.horario}`));

    if (apply) {
      for (let i = 0; i < changes.length; i += BATCH_LIMIT) {
        const batch = dbAdmin.batch();
        changes.slice(i, i + BATCH_LIMIT).forEach((c) => {
          batch.update(c.ref, {
            servicos: c.servicos,
            valorTotal: c.row.valorNovo,
            valorAnterior: c.row.valorAntigo,
            valorOrigem: "preco-atual-servico",
            valorAtualizadoEm: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        });
        await batch.commit();
      }
    }

    return NextResponse.json({
      ok: true,
      applied: apply,
      total: leadsSnap.size,
      changes: changes.map((c) => c.row),
    });
  } catch (err) {
    console.error("[reprice-leads]", (err as { code?: string; message?: string }).code ?? (err as Error).message);
    return NextResponse.json({ error: "Erro interno ao atualizar os valores." }, { status: 500 });
  }
}
