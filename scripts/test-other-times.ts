import { DESIRED_HOURS, buildOtherTimesMessage } from "../src/lib/otherTimesMessage";

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
  console.log("=== INICIANDO TESTES DO PEDIDO DE OUTRAS OPÇÕES DE HORÁRIO ===");

  assert("horários de hora em hora, das 06:00 às 21:00", DESIRED_HOURS[0] === "06:00" && DESIRED_HOURS[DESIRED_HOURS.length - 1] === "21:00" && DESIRED_HOURS.length === 16);

  const ambos = buildOtherTimesMessage({ servicos: "Design", desiredDate: "2026-11-06", desiredTime: "14:00" });
  assert("com data e horário, os dois vão juntos no fim", ambos.endsWith("Data e horário que eu gostaria: 06/11/2026 às 14:00."), ambos);
  assert("serviço entra no texto padrão", ambos.includes("agendar Design"));

  const soData = buildOtherTimesMessage({ servicos: "Design", desiredDate: "2026-11-06", desiredTime: "" });
  assert("só a data", soData.endsWith("Data que eu gostaria: 06/11/2026."), soData);

  const soHora = buildOtherTimesMessage({ servicos: "Design", desiredDate: "", desiredTime: "09:00" });
  assert("só o horário", soHora.endsWith("Horário que eu gostaria: 09:00."), soHora);

  const nada = buildOtherTimesMessage({ servicos: "", desiredDate: "", desiredTime: "" });
  assert("sem data, horário nem serviço: texto padrão", nada.includes("agendar um horário") && !nada.includes("gostaria:"), nada);

  const proprio = buildOtherTimesMessage({
    template: "Oi! Quero {servico} no dia {data} às {horario}.",
    servicos: "Henna",
    desiredDate: "2026-12-01",
    desiredTime: "10:00",
  });
  assert("mensagem do profissional com {data} e {horario}", proprio === "Oi! Quero Henna no dia 01/12/2026 às 10:00.", proprio);

  const proprioSemHora = buildOtherTimesMessage({ template: "Oi! {servico} em {data}?", servicos: "Henna", desiredDate: "2026-12-01", desiredTime: "10:00" });
  assert("mensagem com {data} mas sem {horario}: horário vai no fim", proprioSemHora === "Oi! Henna em 01/12/2026? Horário que eu gostaria: 10:00.", proprioSemHora);

  const invalido = buildOtherTimesMessage({ servicos: "Design", desiredDate: "", desiredTime: "manhã" });
  assert("horário inválido é ignorado", !invalido.includes("manhã"), invalido);

  console.log(`\n=== RESULTADO: ${passed} passaram, ${failed} falharam ===`);
  if (failed > 0) process.exit(1);
}

main();
