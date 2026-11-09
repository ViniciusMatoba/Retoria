import { splitAppointments, type AppointmentSource } from "../src/lib/customerAppointments";

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
  assert("resposta só traz data, horário, serviço e situação", [...keys].sort().join(",") === "data,horario,servico,situacao", [...keys].join(","));
  const json = JSON.stringify({ upcoming, past });
  assert("nome, telefone, valor e observação nunca saem", !/Ana|11988887777|120|alergia/.test(json), json);

  const muitos = Array.from({ length: 30 }, (_, i) => ({ status: "Atendido", dataEscolhida: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`, horarioInicio: "10:00" }));
  assert("limita a 20 itens", splitAppointments(muitos, today).past.length === 20);

  console.log(`\n=== RESULTADO: ${passed} passaram, ${failed} falharam ===`);
  if (failed > 0) process.exit(1);
}

main();
