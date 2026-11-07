import { repriceLead, type ServicePrice } from "../src/lib/repricing";

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
  console.log("=== INICIANDO TESTES DA ATUALIZAÇÃO DE VALORES ===");
  const services = new Map<string, ServicePrice>([
    ["design", { nome: "Design", preco: 120 }],
    ["henna", { nome: "Henna", preco: 60 }],
    ["sempreco", { nome: "Avaliação", preco: null }],
  ]);

  const antigo = repriceLead({ servicos: [{ id: "design", nome: "Design", preco: 100 }], valorTotal: 100 }, services);
  assert("preço antigo vira o preço atual", antigo?.valorTotal === 120 && antigo.changed, JSON.stringify(antigo));
  assert("item do serviço recebe o preço atual", antigo?.servicos[0].preco === 120);

  const combo = repriceLead({ servicos: [{ id: "design", preco: 100 }, { id: "henna", preco: 50 }], valorTotal: 150 }, services);
  assert("combo soma os preços atuais", combo?.valorTotal === 180, JSON.stringify(combo));

  const igual = repriceLead({ servicos: [{ id: "design", preco: 120 }], valorTotal: 120 }, services);
  assert("já no preço atual: não muda", igual?.changed === false);

  const apagado = repriceLead({ servicos: [{ id: "removido", nome: "Antigo", preco: 80 }, { id: "henna", preco: 50 }], valorTotal: 130 }, services);
  assert("serviço apagado mantém o preço do agendamento", apagado?.valorTotal === 140 && apagado.servicos[0].preco === 80, JSON.stringify(apagado));

  const semPreco = repriceLead({ servicos: [{ id: "sempreco", preco: 30 }], valorTotal: 30 }, services);
  assert("serviço atual sem preço mantém o preço do agendamento", semPreco?.valorTotal === 30 && semPreco.changed === false);

  const manual = repriceLead({ serviceId: "henna", servicoEscolhido: "Henna", valorTotal: 40 }, services);
  assert("agendamento manual antigo (só serviceId) recebe a lista de serviços", manual?.valorTotal === 60 && manual.servicos[0].id === "henna" && manual.changed, JSON.stringify(manual));

  const semValor = repriceLead({ serviceId: "design" }, services);
  assert("agendamento sem valor recebe o preço atual", semValor?.valorTotal === 120 && semValor.changed);

  const desconhecido = repriceLead({ serviceId: "nao-existe", valorTotal: 10 }, services);
  assert("sem serviço conhecido: não calcula", desconhecido === null);

  const vazio = repriceLead({ servicos: [], valorTotal: 10 }, services);
  assert("lista de serviços vazia: não calcula", vazio === null);

  const centavos = repriceLead({ servicos: [{ id: "x", preco: 0.1 }, { id: "y", preco: 0.2 }], valorTotal: 0.3 }, new Map());
  assert("arredonda centavos (0,1 + 0,2 = 0,30 sem mudança falsa)", centavos?.valorTotal === 0.3 && centavos.changed === false, JSON.stringify(centavos));

  console.log(`\n=== RESULTADO: ${passed} passaram, ${failed} falharam ===`);
  if (failed > 0) process.exit(1);
}

main();
