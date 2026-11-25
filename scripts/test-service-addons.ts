import {
  addonsFor, applyAddonChoice, hasMainService, isAddon, mainServices,
  removeMainService, sanitizeAddonIds, selectedAddonsOf,
} from "../src/lib/serviceAddons";

let passed = 0;
let failed = 0;
function assert(label: string, cond: boolean, detail?: unknown) {
  if (cond) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.error(`  ✗ ${label}`, detail ?? ""); }
}
const ids = (list: { id: string }[]) => list.map((s) => s.id).join(",");

const services = [
  { id: "mao", ativo: true, adicionaisIds: ["franc", "cromo", "remo"] },
  { id: "pe", ativo: true, adicionaisIds: ["franc"] },
  { id: "gel", ativo: true, adicionaisIds: [] },
  { id: "franc", ativo: true, adicional: true },
  { id: "cromo", ativo: true, adicional: true },
  { id: "remo", ativo: false, adicional: true },
];
const [mao, pe, gel, franc, cromo] = services;

console.log("=== ADICIONAIS DE SERVIÇO ===");

assert("isAddon reconhece adicional", isAddon(franc) && !isAddon(mao));
assert("lista principal sem adicionais", ids(mainServices(services)) === "mao,pe,gel");
assert("adicionais oferecidos ignoram inativos", ids(addonsFor(mao, services)) === "franc,cromo");
assert("serviço sem adicionais não abre janela", addonsFor(gel, services).length === 0);
assert("adicional não oferece adicionais", addonsFor({ ...franc, adicionaisIds: ["cromo"] }, services).length === 0);
assert("id de serviço principal na lista não vira adicional", addonsFor({ id: "x", adicionaisIds: ["pe"] }, services).length === 0);

let sel = applyAddonChoice([], mao, ["franc"], services);
assert("escolha inclui principal e adicional", ids(sel) === "mao,franc", ids(sel));
sel = applyAddonChoice(sel, mao, ["cromo"], services);
assert("trocar escolha tira o desmarcado e põe o novo", ids(sel) === "mao,cromo", ids(sel));
sel = applyAddonChoice(sel, mao, [], services);
assert("sem adicionais deixa só o principal", ids(sel) === "mao", ids(sel));
sel = applyAddonChoice([], mao, ["franc", "franc", "pe", "remo"], services);
assert("ignora repetido, principal e inativo na escolha", ids(sel) === "mao,franc", ids(sel));

sel = applyAddonChoice(applyAddonChoice([], mao, ["franc", "cromo"], services), pe, ["franc"], services);
assert("adicional compartilhado não duplica", ids(sel) === "mao,franc,cromo,pe", ids(sel));
assert("adicionais do principal escolhidos", ids(selectedAddonsOf(pe, sel, services)) === "franc");

let rem = removeMainService(sel, "mao", services);
assert("tirar principal mantém adicional ainda oferecido por outro", ids(rem) === "franc,pe", ids(rem));
rem = removeMainService(rem, "pe", services);
assert("tirar último principal leva os adicionais junto", rem.length === 0, ids(rem));

assert("só adicionais não é agendamento válido", !hasMainService([franc, cromo]));
assert("principal + adicional é válido", hasMainService([mao, franc]));
assert("serviços antigos (sem campo) contam como principal", hasMainService([{ id: "velho" }]));

assert("sanitize: não-lista vira vazio", sanitizeAddonIds("x", "a").length === 0);
assert("sanitize: tira repetidos, vazios e o próprio id", sanitizeAddonIds(["b", "b", "", "a", 3, "c"], "a").join(",") === "b,c");
assert("sanitize: limite de itens", sanitizeAddonIds(Array.from({ length: 30 }, (_, i) => `s${i}`), "a").length === 20);

console.log(`\nResultados: ${passed}/${passed + failed} aprovados, ${failed} reprovados`);
if (failed > 0) process.exit(1);
void gel; void cromo;
