import { validateCustomerEdit } from "../src/lib/customerEdit";

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
  console.log("=== INICIANDO TESTES DA EDIÇÃO DE CADASTRO DE CLIENTE ===");

  const ok = validateCustomerEdit({ telefoneAtual: "(11) 98888-7777", nome: "  Ana   Souza ", telefone: "11 97777-6666" });
  assert("dados válidos são aceitos", ok.ok === true, JSON.stringify(ok));
  if (ok.ok) {
    assert("telefone atual fica só com dígitos", ok.telefoneAtual === "11988887777");
    assert("telefone novo fica só com dígitos", ok.telefone === "11977776666");
    assert("nome sem espaços sobrando", ok.nome === "Ana Souza", ok.nome);
  }

  assert("nome curto é recusado", validateCustomerEdit({ telefoneAtual: "11988887777", nome: "A", telefone: "11988887777" }).ok === false);
  assert("nome com mais de 80 caracteres é recusado", validateCustomerEdit({ telefoneAtual: "11988887777", nome: "A".repeat(81), telefone: "11988887777" }).ok === false);
  assert("telefone sem DDD é recusado", validateCustomerEdit({ telefoneAtual: "11988887777", nome: "Ana", telefone: "98888777" }).ok === false);
  assert("sem telefone atual é recusado", validateCustomerEdit({ nome: "Ana", telefone: "11988887777" }).ok === false);
  assert("corpo vazio é recusado", validateCustomerEdit(null).ok === false);
  assert("tipos errados são recusados", validateCustomerEdit({ telefoneAtual: 11988887777, nome: 123, telefone: true }).ok === false);

  console.log(`\n=== RESULTADO: ${passed} passaram, ${failed} falharam ===`);
  if (failed > 0) process.exit(1);
}

main();
