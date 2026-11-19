import { NextRequest, NextResponse } from "next/server";
import { FieldValue, type Firestore, type Transaction, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { dbAdmin } from "@/lib/firebaseAdmin";
import { readJson, requireOwner, serverError } from "@/lib/apiOwner";

type Params = { params: Promise<{ professionalId: string }> };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Conclusão do primeiro acesso (conta criada pelo link de ativação).
// Roda no servidor porque as regras do Firestore não deixam o próprio profissional
// mudar professionalStatus (SEC: campos de licença só pelo Admin SDK).
// Só sai de "onboarding" para "trial"; plano e datas da licença ficam como a ativação gravou.
export async function POST(req: NextRequest, { params }: Params) {
  const { professionalId } = await params;
  const denied = await requireOwner(req, professionalId);
  if (denied) return denied;

  const body = (await readJson(req)) as Record<string, unknown> | undefined;
  const nome = str(body?.nome, 80);
  const nomeNegocio = str(body?.nomeNegocio, 80);
  const segment = str(body?.segment, 60);
  const slug = str(body?.slug, 60).toLowerCase().replace(/[^a-z0-9-]/g, "");
  const telefone = str(body?.telefone, 20).replace(/\D/g, "");

  if (!nome || !nomeNegocio) return NextResponse.json({ error: "Informe o nome e o nome do negócio." }, { status: 400 });
  if (slug.length < 3) return NextResponse.json({ error: "Link público inválido." }, { status: 400 });
  if (telefone.length < 10 || telefone.length > 13) return NextResponse.json({ error: "Telefone inválido. Inclua o DDD." }, { status: 400 });

  try {
    const db = dbAdmin as Firestore;
    const profRef = db.collection("professionals").doc(professionalId);
    const accRef = db.collection("accounts").doc(professionalId);

    const result = await db.runTransaction(async (tx: Transaction) => {
      const prof = await tx.get(profRef);
      if (!prof.exists) return { status: 404, error: "Conta não encontrada. Use o link de ativação." };
      const data = prof.data()!;
      if (data.professionalStatus !== "onboarding") return { status: 409, error: "Cadastro já concluído." };

      const same = await tx.get(db.collection("professionals").where("slugPublico", "==", slug).limit(2));
      if (same.docs.some((d: QueryDocumentSnapshot) => d.id !== professionalId)) {
        return { status: 409, error: "Este link já está em uso. Escolha outro." };
      }
      const acc = await tx.get(accRef);

      tx.update(profRef, {
        nome,
        nomeNegocio,
        slugPublico: slug,
        telefoneWhatsapp: telefone,
        segment,
        descricaoCurta: data.descricaoCurta || "Seja bem-vindo ao meu canal de pré-agendamentos!",
        professionalStatus: "trial",
        trialStartedAt: data.trialStartedAt ?? FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (acc.exists) {
        tx.update(accRef, { accountTypes: FieldValue.arrayUnion("professional"), updatedAt: FieldValue.serverTimestamp() });
      } else {
        tx.set(accRef, {
          uid: professionalId,
          email: data.email ?? "",
          displayName: nome,
          accountTypes: ["professional"],
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      return { status: 200, error: "" };
    });

    if (result.status !== 200) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true, slug });
  } catch (err) {
    return serverError("[onboarding]", err);
  }
}
