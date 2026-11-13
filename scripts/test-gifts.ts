import {
  buildGiftClients,
  campaignForDate,
  clientKey,
  defaultGiftDay,
  giftDayRows,
  giftDays,
  summarizeGifts,
  validateCampaign,
  type GiftCampaign,
  type GiftDelivery,
  type GiftLead,
} from "../src/lib/gifts";

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, message?: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    if (message) console.error(`    Erro: ${message}`);
    failed++;
  }
}

function main() {
  console.log("=== INICIANDO TESTES DE BRINDES ===");

  // 1. Campanha
  const c = validateCampaign({ nome: "  Brinde  de dezembro ", inicio: "2026-12-01", fim: "2026-12-31" });
  assert("campanha válida; nome sem espaços sobrando", c.ok && c.data.nome === "Brinde de dezembro", JSON.stringify(c));
  assert("fim antes do início é recusado", !validateCampaign({ nome: "Brinde", inicio: "2026-12-10", fim: "2026-12-01" }).ok);
  assert("data inválida é recusada", !validateCampaign({ nome: "Brinde", inicio: "01/12/2026", fim: "2026-12-31" }).ok);
  assert("nome curto é recusado", !validateCampaign({ nome: "B", inicio: "2026-12-01", fim: "2026-12-31" }).ok);
  assert("período maior que 1 ano é recusado", !validateCampaign({ nome: "Brinde", inicio: "2026-01-01", fim: "2027-06-01" }).ok);
  assert("um dia só é aceito", validateCampaign({ nome: "Brinde", inicio: "2026-12-24", fim: "2026-12-24" }).ok);

  // 2. Chave da cliente
  assert("mesmo WhatsApp com e sem formatação e DDI", clientKey("(11) 98765-4321", "Ana") === "t_11987654321" && clientKey("5511987654321", "Outra") === "t_11987654321");
  assert("sem telefone usa o nome sem acento", clientKey("", "  Mária   José ") === "n_maria_jose");
  assert("chave nunca tem barra", !String(clientKey("", "Ana/Bia")).includes("/"));
  assert("sem telefone e sem nome não entra", clientKey("", "") === null);

  // 3. Lista de clientes
  const camp: GiftCampaign = { id: "c1", nome: "Brinde de dezembro", inicio: "2026-12-01", fim: "2026-12-31" };
  const lead = (id: string, extra: Partial<GiftLead>): GiftLead => ({ id, pid: "p1", status: "Agendado", servicoEscolhido: "Design", ...extra });
  const leads: GiftLead[] = [
    lead("l1", { nome: "Ana Silva", telefone: "11987654321", dataEscolhida: "2026-12-05", horarioInicio: "10:00" }),
    lead("l2", { nome: "Ana Silva", telefone: "(11) 98765-4321", dataEscolhida: "2026-12-20", horarioInicio: "15:00", status: "Novo" }),
    lead("l3", { nome: "Bia Souza", telefone: "11911112222", dataEscolhida: "2026-12-05", horarioInicio: "09:00", status: "Atendido" }),
    lead("l4", { nome: "Carla Dias", telefone: "11933334444", dataEscolhida: "2026-12-05", horarioInicio: "11:00", status: "Cancelado" }),
    lead("l5", { nome: "Duda Lima", telefone: "11955556666", dataEscolhida: "2026-11-30", horarioInicio: "11:00" }),
    lead("l6", { nome: "Eva Reis", telefone: "11977778888", dataEscolhida: "2027-01-02", horarioInicio: "11:00" }),
    lead("l7", { nome: "Fê Nunes", telefone: "11900001111", dataEscolhida: "2026-12-31", horarioInicio: "08:00", pid: "p2" }),
    lead("l8", { nome: "Gabi Faltou", telefone: "11922223333", dataEscolhida: "2026-12-06", horarioInicio: "08:00", status: "Não compareceu" }),
  ];
  const none = buildGiftClients(camp, leads, []);
  assert("cliente que vem 2 vezes aparece uma vez só", none.filter((x) => x.nome === "Ana Silva").length === 1);
  assert("os 2 agendamentos dela ficam juntos, em ordem", none.find((x) => x.key === "t_11987654321")?.appointments.map((a) => a.leadId).join() === "l1,l2");
  assert("cancelado, faltou e fora do período não entram", none.map((x) => x.nome).join() === "Ana Silva,Bia Souza,Fê Nunes", none.map((x) => x.nome).join());
  assert("primeiro e último dia do período entram", none.some((x) => x.nome === "Fê Nunes"));
  assert("resumo sem entregas", JSON.stringify(summarizeGifts(none)) === JSON.stringify({ total: 3, delivered: 0, pending: 3 }));

  const deliveries: GiftDelivery[] = [{ key: "t_11987654321", nome: "Ana Silva", leadId: "l1", data: "2026-12-05", entregueEm: 1 }];
  const some = buildGiftClients(camp, leads, deliveries);
  assert("entrega vale para todos os agendamentos da cliente", some.find((x) => x.key === "t_11987654321")?.delivery?.leadId === "l1");
  assert("resumo com 1 entrega", JSON.stringify(summarizeGifts(some)) === JSON.stringify({ total: 3, delivered: 1, pending: 2 }));
  const gone = buildGiftClients(camp, leads.filter((l) => !["l1", "l2"].includes(l.id)), deliveries);
  assert("quem recebeu continua na lista mesmo sem agendamento ativo", gone.some((x) => x.key === "t_11987654321" && x.appointments.length === 0 && !!x.delivery));

  // 4. Por dia
  const day5 = giftDayRows(some, "2026-12-05");
  assert("dia 05/12: duas clientes, por horário", day5.map((r) => r.client.nome).join() === "Bia Souza,Ana Silva", day5.map((r) => r.client.nome).join());
  assert("dia 05/12 é a 1ª de 2 vindas da Ana", day5[1].visit === 1 && day5[1].visits === 2);
  const day20 = giftDayRows(some, "2026-12-20");
  assert("dia 20/12: Ana aparece de novo, já com brinde entregue (2ª vinda)", day20.length === 1 && day20[0].visit === 2 && !!day20[0].client.delivery);
  const days = giftDays(some);
  assert("dias com atendimento e brindes que faltam", JSON.stringify(days) === JSON.stringify([
    { date: "2026-12-05", count: 2, pending: 1 },
    { date: "2026-12-20", count: 1, pending: 0 },
    { date: "2026-12-31", count: 1, pending: 1 },
  ]), JSON.stringify(days));
  assert("abre hoje se tiver atendimento", defaultGiftDay(days, "2026-12-20") === "2026-12-20");
  assert("sem atendimento hoje: próximo dia", defaultGiftDay(days, "2026-12-10") === "2026-12-20" && defaultGiftDay(days, "2026-11-13") === "2026-12-05");
  assert("depois do período: último dia; sem dias: nada", defaultGiftDay(days, "2027-01-05") === "2026-12-31" && defaultGiftDay([], "2026-12-01") === null);

  // 5. Selo nos agendamentos
  assert("agendamento de dezembro pertence à campanha", campaignForDate([camp], "2026-12-15")?.id === "c1");
  assert("agendamento de novembro não pertence", campaignForDate([camp], "2026-11-30") === null && campaignForDate([camp], undefined) === null);

  console.log(`\n=== RESULTADO: ${passed} passaram, ${failed} falharam ===`);
  if (failed > 0) process.exit(1);
}

main();
