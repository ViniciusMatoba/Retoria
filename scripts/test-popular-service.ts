import { mostRequestedService, type PopularLead } from "../src/lib/popularService";

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

const l = (ids: string[], extra: Partial<PopularLead> = {}): PopularLead => ({ status: "Atendido", dataEscolhida: "2026-11-10", servicos: ids.map((id) => ({ id })), ...extra });

function main() {
  console.log("=== INICIANDO TESTES DO SERVIÇO MAIS PEDIDO ===");
  const since = "2026-08-27";

  assert("o mais agendado ganha", mostRequestedService([l(["a"]), l(["a"]), l(["a"]), l(["b"]), l(["b"])], since) === "a");
  assert("menos de 3 agendamentos: sem selo", mostRequestedService([l(["a"]), l(["a"]), l(["b"])], since) === null);
  assert("empate: sem selo", mostRequestedService([l(["a"]), l(["a"]), l(["a"]), l(["b"]), l(["b"]), l(["b"])], since) === null);
  assert("cancelados, perdidos e faltas não contam", mostRequestedService([l(["a"]), l(["a"]), l(["a"], { status: "Cancelado" }), l(["b"]), l(["b"]), l(["b"])], since) === "b");
  assert("fora dos 90 dias não conta", mostRequestedService([l(["a"], { dataEscolhida: "2026-05-01" }), l(["a"], { dataEscolhida: "2026-05-02" }), l(["b"]), l(["b"]), l(["b"]), l(["a"])], since) === "b");
  assert("vários serviços no mesmo agendamento contam para cada um", mostRequestedService([l(["a", "b"]), l(["a", "b"]), l(["a"]), l(["b", "c"])], since) === null && mostRequestedService([l(["a", "b"]), l(["a"]), l(["a"])], since) === "a");
  assert("formato antigo (serviceId) conta", mostRequestedService([{ status: "Agendado", dataEscolhida: "2026-11-01", serviceId: "x" }, { status: "Novo", dataEscolhida: "2026-11-02", serviceId: "x" }, { status: "Atendido", dataEscolhida: "2026-11-03", serviceId: "x" }], since) === "x");
  assert("serviço repetido no mesmo agendamento conta uma vez", mostRequestedService([l(["a", "a", "a"])], since) === null);
  assert("sem agendamentos: sem selo", mostRequestedService([], since) === null);

  console.log(`\n=== RESULTADO: ${passed} passaram, ${failed} falharam ===`);
  if (failed > 0) process.exit(1);
}

main();
