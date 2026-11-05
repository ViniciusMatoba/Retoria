import { getCustomerInsight } from "../src/lib/customerStats";

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
  console.log("=== INICIANDO TESTES DA SITUAÇÃO DOS CLIENTES ===");
  const today = "2026-11-04";

  const novo = getCustomerInsight([{ status: "Agendado", dataEscolhida: "2026-11-10", valorTotal: 100 }], today);
  assert("primeiro agendamento neste mês = novo", novo.isNewThisMonth);
  assert("com horário marcado = ativo", novo.isActive && novo.nextBooking === "2026-11-10");
  assert("nunca atendido não conta como sem retorno", !novo.isInactive && novo.daysSinceLastVisit === null);
  assert("agendado ainda não soma no gasto", novo.spent === 0);

  const sumido = getCustomerInsight(
    [
      { status: "Atendido", dataEscolhida: "2026-06-01", valorTotal: 80 },
      { status: "Atendido", dataEscolhida: "2026-08-20", valorTotal: 120 },
      { status: "Cancelado", dataEscolhida: "2026-10-01", valorTotal: 50 },
    ],
    today
  );
  assert("último atendimento", sumido.lastAttended === "2026-08-20");
  assert("dias desde a última visita", sumido.daysSinceLastVisit === 76, String(sumido.daysSinceLastVisit));
  assert("mais de 60 dias sem nada marcado = sem retorno", sumido.isInactive);
  assert("76 dias ainda está dentro dos 90 = ativo", sumido.isActive);
  assert("gasto soma só os atendidos", sumido.spent === 200);
  assert("cliente antigo não é novo no mês", !sumido.isNewThisMonth);

  const voltou = getCustomerInsight(
    [
      { status: "Atendido", dataEscolhida: "2026-01-10", valorTotal: 80 },
      { status: "Agendado", dataEscolhida: "2026-11-20", valorTotal: 80 },
    ],
    today
  );
  assert("sem visita há muito tempo, mas com horário marcado, não é sem retorno", !voltou.isInactive && voltou.isActive);

  const antigo = getCustomerInsight([{ status: "Atendido", dataEscolhida: "2026-03-01", valorTotal: 90 }], today);
  assert("mais de 90 dias sem visita = inativo e não ativo", antigo.isInactive && !antigo.isActive);

  const agendadoVencido = getCustomerInsight([{ status: "Agendado", dataEscolhida: "2026-11-01", valorTotal: 90 }], today);
  assert("agendado com data passada não é próximo agendamento", agendadoVencido.nextBooking === null);

  const vazio = getCustomerInsight([], today);
  assert("sem histórico: nada marcado", vazio.firstDate === null && !vazio.isActive && !vazio.isInactive && !vazio.isNewThisMonth);

  console.log(`\n=== RESULTADO: ${passed} passaram, ${failed} falharam ===`);
  if (failed > 0) process.exit(1);
}

main();
