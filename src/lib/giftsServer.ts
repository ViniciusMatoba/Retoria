import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { dbAdmin } from "@/lib/firebaseAdmin";
import type { GiftCampaign, GiftDelivery, GiftLead } from "@/lib/gifts";

// Leitura dos brindes no servidor (Admin SDK). Regras em lib/gifts.

export const campaignsCol = (professionalId: string) =>
  dbAdmin.collection("professionals").doc(professionalId).collection("giftCampaigns");

// O profissional e, se for dono, os membros ativos da equipe (os agendamentos ficam em cada um).
export async function giftProfessionalIds(professionalId: string): Promise<string[]> {
  const members = await dbAdmin
    .collection("professionals")
    .where("parentProfessionalId", "==", professionalId)
    .where("role", "==", "team_member")
    .where("professionalStatus", "==", "active")
    .get();
  return [professionalId, ...members.docs.map((d: QueryDocumentSnapshot) => d.id)];
}

export const toCampaign = (d: QueryDocumentSnapshot): GiftCampaign => {
  const x = d.data();
  return { id: d.id, nome: x.nome, inicio: x.inicio, fim: x.fim };
};

export async function readDeliveries(professionalId: string, campaignId: string): Promise<GiftDelivery[]> {
  const snap = await campaignsCol(professionalId).doc(campaignId).collection("deliveries").get();
  return snap.docs.map((d: QueryDocumentSnapshot) => {
    const x = d.data();
    return { key: d.id, nome: x.nome ?? "", leadId: x.leadId ?? null, data: x.data ?? null, entregueEm: x.entregueEm ?? 0 };
  });
}

export async function readCampaignLeads(professionalId: string, campaign: GiftCampaign): Promise<GiftLead[]> {
  const ids = await giftProfessionalIds(professionalId);
  const snaps = await Promise.all(
    ids.map((id) =>
      dbAdmin.collection("professionals").doc(id).collection("leads")
        .where("dataEscolhida", ">=", campaign.inicio)
        .where("dataEscolhida", "<=", campaign.fim)
        .get()
    )
  );
  return snaps.flatMap((s, i) =>
    s.docs.map((d: QueryDocumentSnapshot) => {
      const x = d.data();
      return {
        id: d.id,
        pid: ids[i],
        nome: x.nome,
        telefone: x.telefone,
        status: x.status,
        dataEscolhida: x.dataEscolhida,
        horarioInicio: x.horarioInicio,
        horarioEscolhido: x.horarioEscolhido,
        servicoEscolhido: x.servicoEscolhido,
      } as GiftLead;
    })
  );
}
