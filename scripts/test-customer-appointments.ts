import { canCustomerChange, splitAppointments, type AppointmentSource } from "../src/lib/customerAppointments";

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
  console.log("=== INICIANDO TESTES DA CONSULTA DE AGENDAMENTOS ===");
  const today = "2026-11-09";
  const leads = [
    { status: "Agendado", dataEscolhida: "2026-11-20", horarioInicio: "10:00", servicoEscolhido: "Design", nome: "Ana", telefone: "11988887777", valorTotal: 120, observacao: "alergia" },
    { status: "Novo", dataEscolhida: "2026-11-09", horarioEscolhido: "15:00", servicos: [{ nome: "Design" }, { nome: "Henna" }] },
    { status: "Atendido", dataEscolhida: "2026-10-01", horarioInicio: "09:00", servicoEscolhido: "Henna" },
    { status: "Agendado", dataEscolhida: "2026-11-02", horarioInicio: "11:00", servicoEscolhido: "Brow" },
    { status: "Atendido", dataEscolhida: "2026-11-05", horarioInicio: "16:00" },
    { status: "Cancelado", dataEscolhida: "2026-11-25", horarioInicio: "10:00", servicoEscolhido: "X" },
    { status: "Perdido", dataEscolhida: "2026-10-25", horarioInicio: "10:00", servicoEscolhido: "Y" },
    { status: "Agendado", horarioInicio: "10:00", servicoEscolhido: "Sem data" },
  ] as AppointmentSource[];

  const { upcoming, past } = splitAppointments(leads, today);
  assert("próximos: só ativos de hoje em diante", upcoming.length === 2, JSON.stringify(upcoming));
  assert("próximos: do mais perto ao mais longe", upcoming[0].data === today && upcoming[1].data === "2026-11-20");
  assert("agendado aparece como Confirmado", upcoming[1].situacao === "Confirmado");
  assert("novo aparece como Aguardando confirmação", upcoming[0].situacao === "Aguardando confirmação");
  assert("combo junta os serviços", upcoming[0].servico === "Design + Henna", upcoming[0].servico);
  assert("usa horarioEscolhido quando não há horarioInicio", upcoming[0].horario === "15:00");
  assert("anteriores: do mais recente ao mais antigo", past.map((p) => p.data).join(",") === "2026-11-05,2026-11-02,2026-10-01", past.map((p) => p.data).join(","));
  assert("atendido aparece como Realizado", past[0].situacao === "Realizado");
  assert("agendado com data passada não diz Realizado", past[1].situacao === "Data passada");
  assert("sem nome de serviço usa texto padrão", past[0].servico === "Serviço");
  assert("cancelados e perdidos não aparecem", ![...upcoming, ...past].some((a) => a.servico === "X" || a.servico === "Y"));
  assert("sem data não aparece", ![...upcoming, ...past].some((a) => a.servico === "Sem data"));

  const keys = new Set([...upcoming, ...past].flatMap((a) => Object.keys(a)));
  assert("resposta só traz data, horário, serviço, situação e o necessário para alterar", [...keys].sort().join(",") === "data,horario,podeAlterar,servico,servicoIds,situacao", [...keys].join(","));
  const json = JSON.stringify({ upcoming, past });
  assert("nome, telefone, valor e observação nunca saem", !/Ana|11988887777|120|alergia/.test(json), json);

  const muitos = Array.from({ length: 30 }, (_, i) => ({ status: "Atendido", dataEscolhida: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`, horarioInicio: "10:00" }));
  assert("limita a 20 itens", splitAppointments(muitos, today).past.length === 20);

  // Cancelar / remarcar pela cliente: só com 12 h ou mais de antecedência
  const sp = (date: string, time: string) => Date.parse(`${date}T${time}:00-03:00`);
  const ag = (extra: Partial<AppointmentSource> = {}): AppointmentSource => ({ id: "L1", pid: "P1", status: "Agendado", dataEscolhida: "2026-11-12", horarioInicio: "14:00", servicos: [{ id: "s1", nome: "Design" }, { id: "s2", nome: "Henna" }], ...extra });
  assert("faltando 12 h exatas: pode alterar", canCustomerChange(ag(), sp("2026-11-12", "02:00")).ok);
  assert("faltando 11h59: não pode", !canCustomerChange(ag(), sp("2026-11-12", "02:01")).ok);
  assert("véspera à tarde: pode", canCustomerChange(ag(), sp("2026-11-11", "15:00")).ok);
  assert("horário já passou: não pode", !canCustomerChange(ag(), sp("2026-11-12", "15:00")).ok);
  assert("aguardando confirmação (Novo) também pode", canCustomerChange(ag({ status: "Novo" }), sp("2026-11-10", "10:00")).ok);
  const naoAtivo = canCustomerChange(ag({ status: "Atendido" }), sp("2026-11-10", "10:00"));
  assert("atendido ou cancelado: não pode", !naoAtivo.ok && naoAtivo.reason === "status" && !canCustomerChange(ag({ status: "Cancelado" }), sp("2026-11-10", "10:00")).ok);
  assert("sem horário: não pode", !canCustomerChange(ag({ horarioInicio: undefined }), sp("2026-11-10", "10:00")).ok);

  const r1 = splitAppointments([ag()], "2026-11-10", sp("2026-11-10", "10:00")).upcoming[0];
  assert("próximo traz id, profissional, serviços e podeAlterar", r1.id === "L1" && r1.pid === "P1" && r1.servicoIds.join() === "s1,s2" && r1.podeAlterar === true, JSON.stringify(r1));
  const r2 = splitAppointments([ag()], "2026-11-12", sp("2026-11-12", "08:00")).upcoming[0];
  assert("menos de 12 h: aparece, mas sem poder alterar", r2.podeAlterar === false);
  const r3 = splitAppointments([ag({ status: "Atendido", servicos: undefined, serviceId: "s9" })], "2026-11-20").past[0];
  assert("anterior traz serviços para agendar de novo (formato antigo) e não traz id", r3.servicoIds.join() === "s9" && r3.id === undefined && r3.pid === "P1", JSON.stringify(r3));

  console.log(`\n=== RESULTADO: ${passed} passaram, ${failed} falharam ===`);
  if (failed > 0) process.exit(1);
}

main();
