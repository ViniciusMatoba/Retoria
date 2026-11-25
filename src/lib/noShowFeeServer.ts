import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { dbAdmin } from "@/lib/firebaseAdmin";
import { pendingFeeOf, type FeeLead } from "@/lib/leadStatus";

// Taxa de não comparecimento pendente da cliente (pelo telefone) com este profissional. Só no servidor.
export async function findPendingFee(professionalId: string, phoneDigits: string) {
  const snap = await dbAdmin
    .collection("professionals").doc(professionalId)
    .collection("leads")
    .where("telefone", "==", phoneDigits)
    .get();
  return pendingFeeOf(
    snap.docs.map((d: QueryDocumentSnapshot) => {
      const x = d.data();
      return { id: d.id, nome: x.nome, dataEscolhida: x.dataEscolhida, taxaNaoComparecimento: x.taxaNaoComparecimento ?? null } as FeeLead;
    })
  );
}
