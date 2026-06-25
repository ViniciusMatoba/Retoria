export type PlanId = "individual" | "professional" | "enterprise";
export type LicenseStatus = "trial" | "active" | "grace" | "suspended" | "cancelled";

export interface PlanConfig {
  id: PlanId;
  label: string;
  maxMembers: number; // 0 = só o dono, -1 = ilimitado
  trialDays: number;
  graceDays: number;
}

export const PLANS: Record<PlanId, PlanConfig> = {
  individual: {
    id: "individual",
    label: "Individual",
    maxMembers: 0,
    trialDays: 7,
    graceDays: 3,
  },
  professional: {
    id: "professional",
    label: "Profissional",
    maxMembers: 5,
    trialDays: 7,
    graceDays: 3,
  },
  enterprise: {
    id: "enterprise",
    label: "Empresa",
    maxMembers: 15,
    trialDays: 7,
    graceDays: 3,
  },
};

export interface License {
  uid: string;
  plan: PlanId;
  status: LicenseStatus;
  maxMembers: number;
  trialEndsAt: any; // Firestore Timestamp
  currentPeriodEnd: any; // Firestore Timestamp
  graceDays: number;
  createdAt: any;
  updatedAt: any;
  activatedAt?: any;
  suspendedAt?: any;
  sourceToken?: string; // token que gerou essa licença
}

export interface LicenseToken {
  token: string;
  plan: PlanId;
  contractDays: number; // duração do contrato em dias (também = validade do link)
  trialDays: number;
  createdByAdminUid: string;
  createdAt: any;
  expiresAt: any; // link expira em contractDays dias
  usedAt: any | null;
  usedByUid: string | null;
  label?: string; // ex: "João Barbeiro - 30 dias"
}
