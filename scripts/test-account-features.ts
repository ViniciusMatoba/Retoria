import { ACCOUNTS, hasFeature } from "../src/lib/accountFeatures";

let passed = 0;
let failed = 0;
const assert = (label: string, ok: boolean) => { if (ok) { console.log(`  ✓ ${label}`); passed++; } else { console.error(`  ✗ ${label}`); failed++; } };

console.log("=== INICIANDO TESTES DE NOVIDADES POR CONTA ===");
assert("serviços adicionais ligados na Natália", hasFeature(ACCOUNTS.natalia, "servicosAdicionais"));
assert("serviços adicionais desligados em outra conta (Michele)", !hasFeature("outra-conta-qualquer", "servicosAdicionais"));
assert("visual app ligado na Michele", hasFeature(ACCOUNTS.michele, "visualApp"));
assert("visual app desligado na Natália", !hasFeature(ACCOUNTS.natalia, "visualApp"));
assert("serviços adicionais desligados na Michele", !hasFeature(ACCOUNTS.michele, "servicosAdicionais"));
assert("sem conta: desligado", !hasFeature(undefined, "servicosAdicionais") && !hasFeature("", "servicosAdicionais"));
console.log(`\n=== RESULTADO: ${passed} passaram, ${failed} falharam ===`);
if (failed > 0) process.exit(1);
