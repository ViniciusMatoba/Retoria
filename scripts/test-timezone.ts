import { addDaysSaoPaulo, getSaoPauloToday, getStartOfWeekSaoPaulo, isPastDateTimeSaoPaulo } from "../src/lib/timezone";
import { getSaoPauloNowMinutes } from "../src/lib/timeGrid";

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

// Congela o relógio em um instante UTC para simular o horário em que o painel estava errando
const RealDate = Date;
function withNow(isoUtc: string, fn: () => void) {
  const fixed = new RealDate(isoUtc).getTime();
  class FakeDate extends RealDate {
    constructor(...args: ConstructorParameters<typeof Date> | []) {
      if (args.length === 0) super(fixed);
      else super(...(args as ConstructorParameters<typeof Date>));
    }
    static now() { return fixed; }
  }
  (globalThis as { Date: DateConstructor }).Date = FakeDate as DateConstructor;
  try { fn(); } finally { (globalThis as { Date: DateConstructor }).Date = RealDate; }
}

function main() {
  console.log("=== INICIANDO TESTES DO HORÁRIO DE BRASÍLIA ===");

  // 23:30 de 05/11 em Brasília = 02:30 de 06/11 em UTC
  withNow("2026-11-06T02:30:00Z", () => {
    assert("UTC já virou o dia (era o erro antigo)", new Date().toISOString().slice(0, 10) === "2026-11-06");
    assert("hoje em Brasília continua 05/11", getSaoPauloToday() === "2026-11-05", getSaoPauloToday());
    assert("hora de Brasília: 23:30", getSaoPauloNowMinutes() === 23 * 60 + 30, String(getSaoPauloNowMinutes()));
    assert("mês de Brasília continua novembro", getSaoPauloToday().slice(0, 7) === "2026-11");
    assert("início da semana (domingo) 01/11", getStartOfWeekSaoPaulo(getSaoPauloToday()) === "2026-11-01");
    assert("23:00 de hoje já passou", isPastDateTimeSaoPaulo("2026-11-05", "23:00"));
    assert("23:45 de hoje ainda não passou", !isPastDateTimeSaoPaulo("2026-11-05", "23:45"));
  });

  // Virada de mês: 21:30 de 30/11 em Brasília = 00:30 de 01/12 em UTC
  withNow("2026-12-01T00:30:00Z", () => {
    assert("na virada do mês, Brasília ainda está em 30/11", getSaoPauloToday() === "2026-11-30", getSaoPauloToday());
    assert("mês de Brasília ainda é novembro", getSaoPauloToday().slice(0, 7) === "2026-11");
  });

  // Meio do dia: Brasília e UTC no mesmo dia
  withNow("2026-11-06T15:00:00Z", () => {
    assert("12:00 em Brasília", getSaoPauloToday() === "2026-11-06" && getSaoPauloNowMinutes() === 12 * 60);
  });

  assert("somar dias atravessa o mês", addDaysSaoPaulo("2026-11-30", 1) === "2026-12-01");
  assert("somar dias atravessa o ano", addDaysSaoPaulo("2026-12-31", 1) === "2027-01-01");

  console.log(`\n=== RESULTADO: ${passed} passaram, ${failed} falharam ===`);
  if (failed > 0) process.exit(1);
}

main();
