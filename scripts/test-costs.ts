import { pendingFixedItems, profitOf, summarizeCosts, validateExpense, validateMaterial, type Material } from "../src/lib/costs";

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
  console.log("=== INICIANDO TESTES DE CUSTOS E MATERIAIS ===");

  // 1. Itens
  const luva = validateMaterial({ nome: "  Luvas   nitrílicas ", categoria: "materiais", unidade: "caixa", preco: "39,90" });
  assert("item válido; preço com vírgula vira número", luva.ok && luva.data.preco === 39.9 && luva.data.nome === "Luvas nitrílicas", JSON.stringify(luva));
  assert("item sem unidade fica 'un'", (validateMaterial({ nome: "Henna", categoria: "materiais", preco: 20 }) as { ok: true; data: { unidade: string } }).data.unidade === "un");
  assert("conta fixa marcada", (validateMaterial({ nome: "Energia", categoria: "contas", preco: 180, fixo: true }) as { ok: true; data: { fixo: boolean } }).data.fixo === true);
  assert("categoria inválida é recusada", !validateMaterial({ nome: "X item", categoria: "carro", preco: 1 }).ok);
  assert("preço negativo é recusado", !validateMaterial({ nome: "Item", categoria: "outros", preco: -1 }).ok);
  assert("nome curto é recusado", !validateMaterial({ nome: "A", categoria: "outros", preco: 1 }).ok);

  // 2. Lançamentos
  const compra = validateExpense({ nome: "Luvas", categoria: "materiais", data: "2026-11-05", quantidade: 3, valorUnitario: 39.9, materialId: "m1" });
  assert("total = quantidade × valor", compra.ok && compra.data.total === 119.7, JSON.stringify(compra));
  assert("guarda o item de origem", compra.ok && compra.data.materialId === "m1");
  const avulso = validateExpense({ nome: "Conserto secador", categoria: "outros", data: "2026-11-06", valorUnitario: "150" });
  assert("gasto avulso: quantidade padrão 1, sem item", avulso.ok && avulso.data.quantidade === 1 && avulso.data.total === 150 && avulso.data.materialId === null, JSON.stringify(avulso));
  assert("sem data é recusado", !validateExpense({ nome: "Água", categoria: "contas", valorUnitario: 90 }).ok);
  assert("quantidade zero é recusada", !validateExpense({ nome: "Água", categoria: "contas", data: "2026-11-01", quantidade: 0, valorUnitario: 90 }).ok);
  assert("arredonda centavos", (validateExpense({ nome: "Papel", categoria: "higiene", data: "2026-11-01", quantidade: 3, valorUnitario: 0.1 }) as { ok: true; data: { total: number } }).data.total === 0.3);

  // 3. Resumo do mês
  const expenses = [
    { data: "2026-11-02", total: 119.7, categoria: "materiais" as const },
    { data: "2026-11-10", total: 180, categoria: "contas" as const },
    { data: "2026-11-30", total: 20.3, categoria: "higiene" as const },
    { data: "2026-10-15", total: 200, categoria: "contas" as const },
    { data: "2026-12-01", total: 999, categoria: "outros" as const },
  ];
  const s = summarizeCosts(expenses, { start: "2026-11-01", end: "2026-11-30", prevStart: "2026-10-01", prevEnd: "2026-10-31" });
  assert("total do mês só com lançamentos de novembro", s.total === 320 && s.count === 3, JSON.stringify(s));
  assert("mês anterior para comparar", s.prevTotal === 200 && Math.abs((s.deltaPct as number) - 0.6) < 1e-9);
  assert("categoria com maior gasto primeiro", s.byCategory[0].label === "Contas (energia, água...)" && s.byCategory[0].value === 180);
  assert("participação da categoria", Math.abs(s.byCategory[0].share - 180 / 320) < 1e-9);
  const vazio = summarizeCosts([], { start: "2026-11-01", end: "2026-11-30", prevStart: "2026-10-01", prevEnd: "2026-10-31" });
  assert("sem lançamentos: zero e sem porcentagem", vazio.total === 0 && vazio.deltaPct === null && vazio.byCategory.length === 0);

  // 4. Lucro
  const p = profitOf(1000, 320);
  assert("lucro = faturamento − custos", p.lucro === 680 && Math.abs((p.margem as number) - 0.68) < 1e-9);
  assert("prejuízo fica negativo", profitOf(100, 250).lucro === -150);
  assert("sem faturamento não há margem", profitOf(0, 50).margem === null);

  // 5. Contas fixas pendentes
  const mats: Material[] = [
    { id: "e", nome: "Energia", categoria: "contas", unidade: "conta", preco: 180, fixo: true },
    { id: "a", nome: "Água", categoria: "contas", unidade: "conta", preco: 90, fixo: true },
    { id: "l", nome: "Luvas", categoria: "materiais", unidade: "caixa", preco: 39.9, fixo: false },
  ];
  const pend = pendingFixedItems(mats, [{ materialId: "e" }, { materialId: null }]);
  assert("só fixos ainda não lançados no mês", pend.length === 1 && pend[0].id === "a", JSON.stringify(pend));

  console.log(`\n=== RESULTADO: ${passed} passaram, ${failed} falharam ===`);
  if (failed > 0) process.exit(1);
}

main();
