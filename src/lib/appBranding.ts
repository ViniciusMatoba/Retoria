import { dbAdmin } from "@/lib/firebaseAdmin";

export interface AppBranding {
  name: string;
  iconUrl: string;
  themeColor: string;
  backgroundColor: string;
}

// Nome, ícone e cores do app instalável de um profissional (somente servidor).
export async function getAppBranding(slug: string): Promise<AppBranding | null> {
  if (!dbAdmin || !slug) return null;
  const snap = await dbAdmin.collection("professionals").where("slugPublico", "==", slug).limit(1).get();
  if (snap.empty) return null;
  const d = snap.docs[0].data();
  const name = String(d.appName || d.nomeNegocio || d.nome || "Retoria").trim().slice(0, 30);
  return {
    name,
    iconUrl: typeof d.appIconUrl === "string" ? d.appIconUrl : "",
    themeColor: d.themeConfig?.primaryColor || d.corPrincipal || "#6366f1",
    backgroundColor: d.themeConfig?.backgroundColor || "#ffffff",
  };
}
