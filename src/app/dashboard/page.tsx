import { redirect } from "next/navigation";

// A tela inicial do painel é Horários; Leads / Contatos fica em /dashboard/leads.
export default function DashboardIndex() {
  redirect("/dashboard/slots");
}
