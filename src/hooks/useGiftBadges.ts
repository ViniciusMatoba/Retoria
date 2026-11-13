"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { User } from "firebase/auth";
import { campaignForDate, clientKey, isGiftEligible, type GiftCampaign } from "@/lib/gifts";

// Situação dos brindes para o selo nos agendamentos (Horários, Leads e Lembretes).
// Um único carregamento por sessão do painel, compartilhado entre todos os selos da tela.

export type DeliveredInfo = { entregueEm: number; data: string | null };
export type BadgeCampaign = GiftCampaign & { delivered: Record<string, DeliveredInfo> };

export interface BadgeLead {
  id: string;
  pid: string;
  nome?: string;
  telefone?: string;
  dataEscolhida?: string;
  status?: string;
}

type Store = { uid: string | null; campaigns: BadgeCampaign[] | null; loading: boolean };
let store: Store = { uid: null, campaigns: null, loading: false };
const listeners = new Set<() => void>();
const setStore = (next: Store) => { store = next; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const getSnapshot = () => store;

const call = async (user: User, path: string, init?: RequestInit) => {
  const token = await user.getIdToken();
  const res = await fetch(`/api/professionals/${user.uid}/gifts${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
};

const load = async (user: User) => {
  setStore({ uid: user.uid, campaigns: store.uid === user.uid ? store.campaigns : null, loading: true });
  try {
    const r = await call(user, "");
    setStore({ uid: user.uid, campaigns: r.ok ? r.data.campaigns : [], loading: false });
  } catch {
    setStore({ uid: user.uid, campaigns: [], loading: false }); // sem brindes: os selos só não aparecem
  }
};

const setDelivered = (campaignId: string, key: string, info: DeliveredInfo) =>
  setStore({
    ...store,
    campaigns: (store.campaigns ?? []).map((c) => (c.id === campaignId ? { ...c, delivered: { ...c.delivered, [key]: info } } : c)),
  });

export function useGiftBadges(user: User | null | undefined) {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (user && store.uid !== user.uid && !store.loading) load(user);
  }, [user]);

  // Brinde que vale para este agendamento, e se a cliente já recebeu.
  const statusOf = useCallback((lead: BadgeLead) => {
    if (!snap.campaigns || !isGiftEligible(lead)) return null;
    const campaign = campaignForDate(snap.campaigns, lead.dataEscolhida);
    const key = clientKey(lead.telefone, lead.nome);
    if (!campaign || !key) return null;
    return { campaign, key, delivered: campaign.delivered[key] ?? null };
  }, [snap.campaigns]);

  const deliver = useCallback(async (lead: BadgeLead): Promise<string | null> => {
    const status = statusOf(lead);
    if (!user || !status) return "Brinde não encontrado.";
    try {
      const r = await call(user, `/${status.campaign.id}/deliveries`, { method: "POST", body: JSON.stringify({ leadId: lead.id, pid: lead.pid }) });
      // 409 = já tinha recebido (outro aparelho ou outro agendamento): mostra a entrega que já existe
      if ((r.ok || r.status === 409) && r.data.delivery) setDelivered(status.campaign.id, status.key, r.data.delivery);
      return r.ok ? null : r.data.error || "Não foi possível registrar o brinde.";
    } catch {
      return "Não foi possível registrar o brinde.";
    }
  }, [user, statusOf]);

  return { statusOf, deliver };
}

// Depois de mexer na tela Brindes (criar, editar, desfazer), os selos recarregam na próxima tela.
export const invalidateGiftBadges = () => setStore({ uid: null, campaigns: null, loading: false });
