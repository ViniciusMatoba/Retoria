// Custos e materiais (/dashboard/custos) e o lucro no Faturamento. Funções puras, testadas em scripts/test-costs.ts.
//
// Itens (professionals/{id}/materials): o que se compra sempre, com o preço atual (pode mudar).
// Lançamentos (professionals/{id}/expenses): cada compra ou conta paga, com data; entra no mês da data.
// Gravação só pelas rotas do servidor (Admin SDK), como `customers`; não há regra do Firestore para o navegador.

export const COST_CATEGORIES = [
  { key: "materiais", label: "Materiais" },
  { key: "higiene", label: "Higiene e limpeza" },
  { key: "contas", label: "Contas (energia, água...)" },
  { key: "outros", label: "Outros" },
] as const;

export type CostCategory = (typeof COST_CATEGORIES)[number]["key"];

export const categoryLabel = (key: string) => COST_CATEGORIES.find((c) => c.key === key)?.label ?? "Outros";

export interface Material {
  id: string;
  nome: string;
  categoria: CostCategory;
  unidade: string;
  preco: number;
  fixo: boolean; // conta/gasto que se repete todo mês (energia, água, aluguel)
}

export interface Expense {
  id: string;
  materialId: string | null;
  nome: string;
  categoria: CostCategory;
  data: string; // YYYY-MM-DD
  quantidade: number;
  valorUnitario: number;
  total: number;
  observacao: string;
}

export const round2 = (v: number) => Math.round(v * 100) / 100;
const MAX_VALUE = 1_000_000;

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const str = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");
const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v.replace(",", ".")) : NaN);
const isCategory = (v: unknown): v is CostCategory => COST_CATEGORIES.some((c) => c.key === v);

export const validateMaterial = (body: unknown): Result<Omit<Material, "id">> => {
  const b = (body ?? {}) as Record<string, unknown>;
  const nome = str(b.nome);
  if (nome.length < 2 || nome.length > 60) return { ok: false, error: "O nome do item deve ter entre 2 e 60 caracteres." };
  if (!isCategory(b.categoria)) return { ok: false, error: "Escolha a categoria do item." };
  const unidade = str(b.unidade) || "un";
  if (unidade.length > 20) return { ok: false, error: "Unidade muito longa." };
  const preco = num(b.preco);
  if (!Number.isFinite(preco) || preco < 0 || preco > MAX_VALUE) return { ok: false, error: "Informe um preço válido." };
  return { ok: true, data: { nome, categoria: b.categoria, unidade, preco: round2(preco), fixo: b.fixo === true } };
};

export const validateExpense = (body: unknown): Result<Omit<Expense, "id">> => {
  const b = (body ?? {}) as Record<string, unknown>;
  const nome = str(b.nome);
  if (nome.length < 2 || nome.length > 60) return { ok: false, error: "Informe o item ou a descrição do gasto." };
  if (!isCategory(b.categoria)) return { ok: false, error: "Escolha a categoria do gasto." };
  const data = str(b.data);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return { ok: false, error: "Informe a data do gasto." };
  const quantidade = num(b.quantidade ?? 1);
  if (!Number.isFinite(quantidade) || quantidade <= 0 || quantidade > 10_000) return { ok: false, error: "Informe uma quantidade válida." };
  const valorUnitario = num(b.valorUnitario);
  if (!Number.isFinite(valorUnitario) || valorUnitario < 0 || valorUnitario > MAX_VALUE) return { ok: false, error: "Informe um valor válido." };
  const observacao = str(b.observacao);
  if (observacao.length > 300) return { ok: false, error: "Observação muito longa." };
  const materialId = typeof b.materialId === "string" && b.materialId.length > 0 && b.materialId.length <= 100 ? b.materialId : null;
  return {
    ok: true,
    data: {
      materialId,
      nome,
      categoria: b.categoria,
      data,
      quantidade: round2(quantidade),
      valorUnitario: round2(valorUnitario),
      total: round2(quantidade * valorUnitario),
      observacao,
    },
  };
};

export interface CostSummary {
  total: number;
  count: number;
  prevTotal: number;
  deltaPct: number | null;
  byCategory: { label: string; value: number; count: number; share: number }[];
}

const inRange = (d: string, start: string, end: string) => d >= start && d <= end;

// Custos do período (pela data do lançamento) e do período anterior, para comparar.
export const summarizeCosts = (
  expenses: Pick<Expense, "data" | "total" | "categoria">[],
  range: { start: string; end: string; prevStart: string; prevEnd: string }
): CostSummary => {
  const current = expenses.filter((e) => inRange(e.data, range.start, range.end));
  const total = round2(current.reduce((s, e) => s + e.total, 0));
  const prevTotal = round2(expenses.filter((e) => inRange(e.data, range.prevStart, range.prevEnd)).reduce((s, e) => s + e.total, 0));
  const byCat = new Map<string, { value: number; count: number }>();
  current.forEach((e) => {
    const label = categoryLabel(e.categoria);
    const cur = byCat.get(label) ?? { value: 0, count: 0 };
    cur.value = round2(cur.value + e.total);
    cur.count += 1;
    byCat.set(label, cur);
  });
  return {
    total,
    count: current.length,
    prevTotal,
    deltaPct: prevTotal > 0 ? (total - prevTotal) / prevTotal : null,
    byCategory: [...byCat.entries()]
      .map(([label, v]) => ({ label, ...v, share: total > 0 ? v.value / total : 0 }))
      .sort((a, b) => b.value - a.value),
  };
};

// Lucro = faturamento realizado − custos. Margem só quando houve faturamento.
export const profitOf = (realized: number, costs: number) => {
  const lucro = round2(realized - costs);
  return { lucro, margem: realized > 0 ? lucro / realized : null };
};

// Itens marcados como fixos que ainda não têm lançamento no mês (para o botão "Lançar contas fixas").
export const pendingFixedItems = (materials: Material[], monthExpenses: Pick<Expense, "materialId">[]) => {
  const launched = new Set(monthExpenses.map((e) => e.materialId).filter(Boolean));
  return materials.filter((m) => m.fixo && !launched.has(m.id));
};
