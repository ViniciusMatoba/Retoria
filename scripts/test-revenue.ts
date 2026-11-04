import { allocateByService, getPeriod, shiftOf, summarizeRevenue, type RevenueLead } from "../src/lib/revenue";

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

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

function main() {
  console.log("=== INICIANDO TESTES DO FATURAMENTO ===");
  const today = "2026-11-04"; // quarta-feira

  // 1. Períodos
  const mes = getPeriod("mes", 0, today);
  assert("mês atual vai de 01 a 30/11", mes.start === "2026-11-01" && mes.end === "2026-11-30", `${mes.start} ${mes.end}`);
  assert("mês tem 30 barras (dias)", mes.buckets.length === 30);
  assert("mês anterior é outubro inteiro", mes.prevStart === "2026-10-01" && mes.prevEnd === "2026-10-31");
  assert("rótulo do mês", mes.label === "Novembro de 2026", mes.label);
  const mesAnt = getPeriod("mes", -11, today);
  assert("voltar 11 meses cai em dezembro do ano anterior", mesAnt.start === "2025-12-01" && mesAnt.end === "2025-12-31", mesAnt.start);
  const fev = getPeriod("mes", 3, today);
  assert("fevereiro de 2027 tem 28 dias", fev.end === "2027-02-28" && fev.buckets.length === 28, fev.end);
  const semana = getPeriod("semana", 0, today);
  assert("semana começa no domingo 01/11", semana.start === "2026-11-01" && semana.end === "2026-11-07", `${semana.start} ${semana.end}`);
  assert("semana anterior", semana.prevStart === "2026-10-25" && semana.prevEnd === "2026-10-31");
  const dia = getPeriod("dia", -1, today);
  assert("dia anterior é terça 03/11", dia.start === "2026-11-03" && dia.label === "Ter, 03/11/2026", dia.label);
  const ano = getPeriod("ano", 0, today);
  assert("ano tem 12 barras", ano.buckets.length === 12 && ano.start === "2026-01-01" && ano.end === "2026-12-31");

  // 2. Divisão por serviço
  const combo = allocateByService({ id: "x", valorTotal: 150, servicos: [{ nome: "Design", preco: 100 }, { nome: "Henna", preco: 50 }] });
  assert("combo divide proporcional ao preço", combo.length === 2 && near(combo[0].value, 100) && near(combo[1].value, 50), JSON.stringify(combo));
  const semPreco = allocateByService({ id: "y", valorTotal: 90, servicos: [{ nome: "A" }, { nome: "B" }, { nome: "C" }] });
  assert("serviços sem preço dividem em partes iguais", semPreco.every((s) => near(s.value, 30)));
  const legado = allocateByService({ id: "z", valorTotal: 80, servicoEscolhido: "Corte" });
  assert("agendamento antigo usa servicoEscolhido", legado.length === 1 && legado[0].name === "Corte" && legado[0].value === 80);

  // 3. Turnos
  assert("09:00 é manhã", shiftOf("09:00") === "Manhã");
  assert("12:00 é tarde", shiftOf("12:00") === "Tarde");
  assert("18:30 é noite", shiftOf("18:30") === "Noite");
  assert("horário inválido não tem turno", shiftOf("") === null);

  // 4. Resumo do mês
  const leads: RevenueLead[] = [
    { id: "1", nome: "Ana", telefone: "(11) 98888-7777", status: "Atendido", dataEscolhida: "2026-11-02", horarioInicio: "09:00", valorTotal: 100, servicoEscolhido: "Design", origem: "whatsapp" },
    { id: "2", nome: "Ana", telefone: "11988887777", status: "Atendido", dataEscolhida: "2026-11-03", horarioInicio: "14:00", valorTotal: 150, servicos: [{ nome: "Design", preco: 100 }, { nome: "Henna", preco: 50 }], origem: "web-slug" },
    { id: "3", nome: "Bia", telefone: "11977776666", status: "Atendido", dataEscolhida: "2026-11-03", horarioInicio: "19:00", valorTotal: 50, servicoEscolhido: "Henna" },
    { id: "4", nome: "Caio", telefone: "11966665555", status: "Agendado", dataEscolhida: "2026-11-10", horarioInicio: "10:00", valorTotal: 200, servicoEscolhido: "Design" },
    { id: "5", nome: "Duda", telefone: "11955554444", status: "Agendado", dataEscolhida: "2026-11-01", horarioInicio: "10:00", valorTotal: 70, servicoEscolhido: "Design" },
    { id: "6", nome: "Eva", telefone: "11944443333", status: "Cancelado", dataEscolhida: "2026-11-05", valorTotal: 120 },
    { id: "7", nome: "Bia", telefone: "11977776666", status: "Atendido", dataEscolhida: "2026-10-15", horarioInicio: "10:00", valorTotal: 200 },
    { id: "8", nome: "Fora", telefone: "11933332222", status: "Atendido", dataEscolhida: "2026-12-01", valorTotal: 999 },
  ];
  const s = summarizeRevenue(leads, mes, today);
  assert("realizado do mês soma só os atendidos de novembro", s.realized === 300 && s.realizedCount === 3, `${s.realized} ${s.realizedCount}`);
  assert("ticket médio", s.avgTicket === 100);
  assert("previsto: agendado de hoje em diante", s.predicted === 200 && s.predictedCount === 1);
  assert("a confirmar: agendado com data passada", s.overdue === 70 && s.overdueCount === 1);
  assert("perdido: cancelados", s.lost === 120 && s.lostCount === 1);
  assert("taxa de cancelamento sobre todos do período", near(s.cancelRate, 1 / 6), String(s.cancelRate));
  assert("comparação com outubro (+50%)", s.prevRealized === 200 && near(s.deltaPct as number, 0.5), `${s.prevRealized} ${s.deltaPct}`);
  assert("clientes únicos pelo telefone (com e sem máscara)", s.uniqueClients === 2, String(s.uniqueClients));
  assert("cliente novo: Ana (Bia já tinha vindo em outubro)", s.newClients === 1, String(s.newClients));
  const design = s.byService.find((b) => b.label === "Design");
  const henna = s.byService.find((b) => b.label === "Henna");
  assert("Design: 100 + 100 do combo", design?.value === 200, JSON.stringify(design));
  assert("Henna: 50 do combo + 50 avulsa", henna?.value === 100, JSON.stringify(henna));
  assert("serviço mais faturado vem primeiro", s.byService[0].label === "Design");
  assert("participação do serviço no total", near(design!.share, 2 / 3));
  const terca = s.byWeekday.find((b) => b.label === "Ter");
  assert("dia da semana: terça somou 200", terca?.value === 200 && terca.count === 2, JSON.stringify(terca));
  assert("dias da semana na ordem Dom..Sáb", s.byWeekday.map((b) => b.label).join(",") === "Dom,Seg,Ter,Qua,Qui,Sex,Sáb");
  assert("turnos", s.byShift.map((b) => `${b.label}:${b.value}`).join(",") === "Manhã:100,Tarde:150,Noite:50", s.byShift.map((b) => `${b.label}:${b.value}`).join(","));
  assert("origem sem valor vira Não informado", s.byOrigin.some((b) => b.label === "Não informado" && b.value === 50));
  assert("origem com rótulo amigável", s.byOrigin.some((b) => b.label === "Página pública" && b.value === 150));
  assert("top clientes: Ana primeiro com 250", s.topClients[0].nome === "Ana" && s.topClients[0].value === 250 && s.topClients[0].count === 2);
  const b03 = s.buckets.find((b) => b.key === "2026-11-03");
  const b10 = s.buckets.find((b) => b.key === "2026-11-10");
  assert("barra do dia 03: realizado 200", b03?.realized === 200 && b03.count === 2, JSON.stringify(b03));
  assert("barra do dia 10: previsto 200", b10?.predicted === 200 && b10.realized === 0);

  // 5. Sem faturamento anterior não inventa porcentagem
  const vazio = summarizeRevenue([{ id: "a", status: "Atendido", dataEscolhida: "2026-11-02", valorTotal: 10 }], mes, today);
  assert("sem mês anterior: variação nula", vazio.deltaPct === null);

  // 6. Dia: barras por hora, faixa 07h–20h ampliada se preciso
  const diaHoje = getPeriod("dia", 0, today);
  const sd = summarizeRevenue(
    [
      { id: "h1", status: "Atendido", dataEscolhida: today, horarioInicio: "06:30", valorTotal: 40 },
      { id: "h2", status: "Agendado", dataEscolhida: today, horarioInicio: "15:00", valorTotal: 60 },
    ],
    diaHoje,
    today
  );
  assert("dia começa às 06h quando há atendimento cedo", sd.buckets[0].key === "06" && sd.buckets[sd.buckets.length - 1].key === "20", `${sd.buckets[0].key}-${sd.buckets[sd.buckets.length - 1].key}`);
  assert("hora 15h tem previsto 60", sd.buckets.find((b) => b.key === "15")?.predicted === 60);

  console.log(`\n=== RESULTADO: ${passed} passaram, ${failed} falharam ===`);
  if (failed > 0) process.exit(1);
}

main();
