import {
  DEFAULT_HOUR_HEIGHT,
  MAX_HOUR_HEIGHT,
  MIN_HOUR_HEIGHT,
  anchoredScrollTop,
  clampHourHeight,
  detectSwipe,
  initialScrollMinutes,
  layoutOverlaps,
  minutesToOffset,
  pinchHourHeight,
} from "../src/lib/timeGrid";
import { mergeCustomerSuggestions } from "../src/lib/customerSuggestions";

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
  console.log("=== INICIANDO TESTES DA GRADE DE HORÁRIOS (PINÇA) ===");

  // 1. Limites do zoom
  assert("altura abaixo do mínimo é limitada", clampHourHeight(5) === MIN_HOUR_HEIGHT);
  assert("altura acima do máximo é limitada", clampHourHeight(9999) === MAX_HOUR_HEIGHT);
  assert("valor inválido volta ao padrão", clampHourHeight(NaN) === DEFAULT_HOUR_HEIGHT);

  // 2. Pinça
  assert("afastar os dedos aumenta as horas", pinchHourHeight(64, 100, 150) === 96, String(pinchHourHeight(64, 100, 150)));
  assert("aproximar os dedos espreme as horas", pinchHourHeight(64, 100, 50) === 32, String(pinchHourHeight(64, 100, 50)));
  assert("pinça respeita o mínimo", pinchHourHeight(64, 100, 1) === MIN_HOUR_HEIGHT);
  assert("distância inicial zero não quebra", pinchHourHeight(64, 0, 80) === 64);

  // 3. Rolagem ancorada: o horário sob os dedos continua no mesmo lugar
  const oldH = 64, newH = 128, scrollTop = 500, focusY = 200;
  const minuteUnderFinger = ((scrollTop + focusY) / oldH) * 60;
  const newScroll = anchoredScrollTop(scrollTop, focusY, oldH, newH);
  const minuteAfter = ((newScroll + focusY) / newH) * 60;
  assert("horário sob os dedos não se move ao ampliar", Math.abs(minuteUnderFinger - minuteAfter) < 1e-9, `${minuteUnderFinger} vs ${minuteAfter}`);
  assert("rolagem nunca fica negativa", anchoredScrollTop(0, 300, 128, 32) === 0);

  // 4. Posição dos blocos
  assert("08:30 com 64px/hora fica a 544px", minutesToOffset(8 * 60 + 30, 64) === 544);

  // 5. Sobreposição
  const layout = layoutOverlaps([
    { id: "a", start: 540, end: 600 },
    { id: "b", start: 570, end: 630 },
    { id: "c", start: 660, end: 690 },
  ]);
  assert("blocos sobrepostos dividem a largura em 2 colunas", layout.get("a")?.cols === 2 && layout.get("b")?.cols === 2);
  assert("blocos sobrepostos ficam em colunas diferentes", layout.get("a")?.col !== layout.get("b")?.col);
  assert("bloco isolado ocupa a largura toda", layout.get("c")?.cols === 1 && layout.get("c")?.col === 0);
  const touching = layoutOverlaps([
    { id: "x", start: 540, end: 570 },
    { id: "y", start: 570, end: 600 },
  ]);
  assert("blocos encostados (um termina, outro começa) não se dividem", touching.get("x")?.cols === 1 && touching.get("y")?.cols === 1);

  // 6. Rolagem inicial
  assert("hoje rola para perto da hora atual", initialScrollMinutes(480, 840) === 795);
  assert("outro dia rola para perto do primeiro bloco", initialScrollMinutes(480, null) === 435);
  assert("dia vazio abre perto das 07:00", initialScrollMinutes(null, null) === 375);

  // 7. Deslizar para o lado (dia/semana/mês seguinte ou anterior)
  assert("deslizar para a esquerda vai para o próximo", detectSwipe(-120, 10, 300) === "next");
  assert("deslizar para a direita volta", detectSwipe(120, -10, 300) === "prev");
  assert("movimento curto não troca de período", detectSwipe(-30, 0, 200) === null);
  assert("rolagem vertical não troca de período", detectSwipe(-80, 200, 300) === null);
  assert("arraste lento não troca de período", detectSwipe(-150, 0, 2000) === null);

  // 8. Preenchimento automático de clientes
  const suggestions = mergeCustomerSuggestions(
    [{ nome: "Ana Souza", telefone: "11988887777" }],
    [
      { nome: "Ana S.", telefone: "(11) 98888-7777" },
      { nome: "Bruno Lima", telefone: "11 97777-6666" },
      { nome: "", telefone: "11955554444" },
    ]
  );
  assert("cliente de agendamento manual antigo entra na lista", suggestions.some(s => s.nome === "Bruno Lima" && s.telefone === "11977776666"));
  assert("cadastro de clientes prevalece sobre o nome do agendamento", suggestions.find(s => s.telefone === "11988887777")?.nome === "Ana Souza");
  assert("telefone repetido aparece uma vez só", suggestions.filter(s => s.telefone === "11988887777").length === 1);
  assert("agendamento sem nome é ignorado", !suggestions.some(s => s.telefone === "11955554444"));

  console.log(`\n=== RESULTADO: ${passed} passaram, ${failed} falharam ===`);
  if (failed > 0) process.exit(1);
}

main();
