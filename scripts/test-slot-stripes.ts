import { hexToRgba, getSlotDayStripeStyles } from "../src/lib/slotDayStripes";

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
  console.log("=== INICIANDO TESTES DAS FAIXAS DATA/HORÁRIO ===");

  // 1. Conversão de cor
  assert("hex de 6 dígitos vira rgba", hexToRgba("#7a2e3b", 0.16) === "rgba(122,46,59,0.16)", String(hexToRgba("#7a2e3b", 0.16)));
  assert("hex de 3 dígitos é expandido", hexToRgba("#fff", 0.5) === "rgba(255,255,255,0.5)", String(hexToRgba("#fff", 0.5)));
  assert("hex sem # é aceito", hexToRgba("000000", 1) === "rgba(0,0,0,1)", String(hexToRgba("000000", 1)));
  assert("cor inválida retorna null", hexToRgba("vermelho", 0.5) === null);

  // 2. Faixas alternadas
  const stripes = getSlotDayStripeStyles("#7a2e3b");
  assert("linha da data usa tom da cor principal", stripes.dateRow.backgroundColor === "rgba(122,46,59,0.16)", String(stripes.dateRow.backgroundColor));
  assert("linha dos horários usa fundo neutro", stripes.slotsRow.backgroundColor === "rgba(128,128,128,0.06)", String(stripes.slotsRow.backgroundColor));
  assert("data e horário têm cores diferentes", stripes.dateRow.backgroundColor !== stripes.slotsRow.backgroundColor);

  const fallback = getSlotDayStripeStyles("cor-invalida");
  assert("cor principal inválida cai num cinza para a linha da data", fallback.dateRow.backgroundColor === "rgba(128,128,128,0.16)", String(fallback.dateRow.backgroundColor));
  assert("fallback ainda diferencia data de horário", fallback.dateRow.backgroundColor !== fallback.slotsRow.backgroundColor);

  console.log(`\n=== RESULTADO: ${passed} passaram, ${failed} falharam ===`);
  if (failed > 0) process.exit(1);
}

main();
