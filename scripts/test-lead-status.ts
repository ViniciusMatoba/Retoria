import {
  feeAfterStatusChange,
  hasStarted,
  noShowFeeMessage,
  occupiesTime,
  pendingFeeOf,
  readNoShowFeeSettings,
  shouldAskToRelease,
  showsInAgenda,
  type NoShowFee,
} from "../src/lib/leadStatus";

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

const sp = (date: string, time: string) => Date.parse(`${date}T${time}:00-03:00`);

function main() {
  console.log("=== INICIANDO TESTES DE STATUS E TAXA ===");
  const lead = (status: string, extra = {}) => ({ status, dataEscolhida: "2026-11-25", horarioInicio: "14:00", ...extra });
  const before = sp("2026-11-25", "10:00");
  const after = sp("2026-11-25", "15:00");

  // 1. Agenda
  assert("horário começou às 14:00", hasStarted(lead("Agendado"), sp("2026-11-25", "14:00")) && !hasStarted(lead("Agendado"), sp("2026-11-25", "13:59")));
  assert("ativo aparece sempre", showsInAgenda(lead("Agendado"), before) && showsInAgenda(lead("Troca de serviço"), after));
  assert("cancelado de horário que já passou continua na agenda", showsInAgenda(lead("Cancelado"), after));
  assert("cancelado futuro com horário liberado some", !showsInAgenda(lead("Cancelado"), before));
  assert("cancelado futuro mantido aparece", showsInAgenda(lead("Cancelado", { manterNaAgenda: true }), before));
  assert("não compareceu passado aparece", showsInAgenda(lead("Não compareceu"), after));
  assert("liberado não segura o horário; mantido segura", !occupiesTime(lead("Perdido")) && occupiesTime(lead("Perdido", { manterNaAgenda: true })));
  assert("troca de serviço segura o horário", occupiesTime(lead("Troca de serviço")));

  // 2. Perguntar se libera
  assert("cancelar antes do horário: pergunta", shouldAskToRelease(lead("Agendado"), "Cancelado", before));
  assert("cancelar depois do horário: não pergunta", !shouldAskToRelease(lead("Agendado"), "Cancelado", after));
  assert("marcar atendido: não pergunta", !shouldAskToRelease(lead("Agendado"), "Atendido", before));
  assert("de cancelado para perdido: não pergunta de novo", !shouldAskToRelease(lead("Cancelado"), "Perdido", before));

  // 3. Taxa
  const s = readNoShowFeeSettings(undefined);
  assert("padrão: taxa ligada de R$ 30", s.ativo && s.valor === 30);
  assert("valor configurado e desligada", readNoShowFeeSettings({ ativo: false, valor: 45.5 }).valor === 45.5 && !readNoShowFeeSettings({ ativo: false }).ativo);
  assert("valor inválido volta ao padrão", readNoShowFeeSettings({ valor: -5 }).valor === 30);
  assert("chave Pix lida sem espaços; sem chave fica vazia", readNoShowFeeSettings({ chavePix: "  7c12041c-0c67-4534-b473-dc02e7afa431 " }).chavePix === "7c12041c-0c67-4534-b473-dc02e7afa431" && s.chavePix === "");
  const f1 = feeAfterStatusChange("Agendado", "Não compareceu", null, s, 100);
  assert("não compareceu cria taxa pendente", f1?.status === "pendente" && f1.valor === 30 && f1.criadaEm === 100, JSON.stringify(f1));
  assert("perdido também cria taxa", feeAfterStatusChange("Agendado", "Perdido", null, s, 1)?.status === "pendente");
  assert("cancelado não cria taxa", feeAfterStatusChange("Agendado", "Cancelado", null, s, 1) === undefined);
  assert("taxa desligada: não cria", feeAfterStatusChange("Agendado", "Perdido", null, { ativo: false, valor: 30, chavePix: "" }, 1) === undefined);
  const pend: NoShowFee = { valor: 30, status: "pendente", criadaEm: 1 };
  assert("voltou para atendido (marcou errado): remove a taxa pendente", feeAfterStatusChange("Não compareceu", "Atendido", pend, s, 2) === null);
  assert("taxa já paga não é removida", feeAfterStatusChange("Não compareceu", "Atendido", { ...pend, status: "paga" }, s, 2) === undefined);
  assert("de perdido para não compareceu: não duplica", feeAfterStatusChange("Perdido", "Não compareceu", pend, s, 2) === undefined);

  // 4. Taxa pendente da cliente
  const p = pendingFeeOf([
    { id: "a", nome: "Ana", taxaNaoComparecimento: { valor: 30, status: "paga", criadaEm: 1 } },
    { id: "b", nome: "Ana", dataEscolhida: "2026-11-20", taxaNaoComparecimento: { valor: 30, status: "pendente", criadaEm: 5 } },
    { id: "c", nome: "Ana", taxaNaoComparecimento: { valor: 40, status: "pendente", criadaEm: 9 } },
    { id: "d", nome: "Ana" },
  ]);
  assert("pega a taxa pendente mais antiga", p?.leadId === "b" && p.valor === 30, JSON.stringify(p));
  assert("sem pendência: nada", pendingFeeOf([{ id: "x", taxaNaoComparecimento: { valor: 30, status: "dispensada", criadaEm: 1 } }]) === null);

  // 5. Texto
  const msg = noShowFeeMessage("Maria Silva", 30);
  assert("aviso com primeiro nome e valor", msg.startsWith("Olá Maria! No último agendamento") && msg.includes("R$") && msg.includes("30,00") && msg.endsWith("preferência."), msg);

  console.log(`\n=== RESULTADO: ${passed} passaram, ${failed} falharam ===`);
  if (failed > 0) process.exit(1);
}

main();
