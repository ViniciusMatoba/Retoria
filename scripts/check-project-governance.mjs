import fs from "fs";
import path from "path";

const requiredFiles = [
  "PROJECT_STATUS.md",
  "AGENTS.md",
  "docs/README.md",
  "docs/PROJECT_CONTROL.md",
  "docs/ROADMAP.md",
  "docs/PILOT_RELEASE_CHECKLIST.md",
  "docs/PRODUCTION_RELEASE_CHECKLIST.md",
  "docs/ARCHITECTURE_DECISIONS.md",
  "docs/RISKS_AND_LIMITATIONS.md",
  "docs/RELEASE_GATES.md",
  "docs/TASK_CLOSEOUT_TEMPLATE.md"
];

const validStates = [
  "Não iniciado",
  "Planejado",
  "Em desenvolvimento",
  "Implementado",
  "Testado",
  "Homologado",
  "Liberado para piloto",
  "Liberado para produção",
  "Bloqueado",
  "Descontinuado"
];

let errors = [];

function checkGovernance() {
  console.log("=== INICIANDO VERIFICAÇÃO DE GOVERNANÇA DO PROJETO ===");

  // 1. Verificar existência dos arquivos obrigatórios
  for (const relPath of requiredFiles) {
    const fullPath = path.resolve(relPath);
    if (!fs.existsSync(fullPath)) {
      errors.push(`Arquivo obrigatório ausente: ${relPath}`);
    } else {
      console.log(`  ✓ Encontrado: ${relPath}`);
    }
  }

  // 2. Validar estados no controle do projeto
  const controlPath = path.resolve("docs/PROJECT_CONTROL.md");
  if (fs.existsSync(controlPath)) {
    const content = fs.readFileSync(controlPath, "utf-8");
    
    // Verificar se usa termos de status obsoletos
    const obsoleteStates = ["Concluído", "Em testes", "Aprovado"];
    for (const obs of obsoleteStates) {
      const regex = new RegExp(`\\|\\s*${obs}\\s*\\|`, "i");
      if (regex.test(content)) {
        errors.push(`docs/PROJECT_CONTROL.md usa estado obsoleto ou inválido na matriz de status: "${obs}"`);
      }
    }

    // 3. Regra de Evidência pós-deploy
    // Impedir que "Teste pós-deploy: não testado" (ou similar) coexista com Gate B: GO ou GO COM RESTRIÇÕES
    const hasNoDeployTest = /Teste pós-deploy:\s*não\s*testado/i.test(content) || /homologação pós-deploy:\s*não\s*testada/i.test(content);
    const hasGateBGo = /Gate\s*B[^:\n]*:\s*(GO|GO\s*COM\s*RESTRIÇÕES)/i.test(content);
    if (hasNoDeployTest && hasGateBGo) {
      errors.push("Regra de Consistência: 'Teste pós-deploy: NÃO TESTADO' não pode coexistir com 'Gate B: GO' ou 'Gate B: GO COM RESTRIÇÕES'!");
    }
  }

  // 4. Verificar se PROJECT_STATUS.md aponta para docs/PROJECT_CONTROL.md
  const statusPath = path.resolve("PROJECT_STATUS.md");
  if (fs.existsSync(statusPath)) {
    const content = fs.readFileSync(statusPath, "utf-8");
    if (!content.includes("docs/PROJECT_CONTROL.md")) {
      errors.push("PROJECT_STATUS.md deve conter link e apontar para docs/PROJECT_CONTROL.md como fonte principal.");
    }

    // Impedir inconsistência de Gate B no status resumido
    const hasNoDeployTestStatus = /homologação pós-deploy:\s*não\s*testada/i.test(content);
    const hasGateBGoStatus = /Gate\s*B[^:\n]*:\s*(GO|GO\s*COM\s*RESTRIÇÕES)/i.test(content);
    if (hasNoDeployTestStatus && hasGateBGoStatus) {
      errors.push("Regra de Consistência em PROJECT_STATUS.md: Gate B não pode estar ativo/GO se a homologação pós-deploy não foi testada.");
    }
  }

  // 5. Verificar RELEASE_GATES.md para inconsistência do Gate B
  const gatesPath = path.resolve("docs/RELEASE_GATES.md");
  if (fs.existsSync(gatesPath)) {
    const content = fs.readFileSync(gatesPath, "utf-8");
    const hasGateBGoGates = /Gate\s*B[^:\n]*:\s*(GO|GO\s*COM\s*RESTRIÇÕES)/i.test(content);
    const hasNoDeployTestGates = /Teste pós-deploy:\s*NÃO\s*TESTADO/i.test(content);
    if (hasNoDeployTestGates && hasGateBGoGates) {
      errors.push("Regra de Consistência em docs/RELEASE_GATES.md: Gate B está marcado como GO/GO COM RESTRIÇÕES mas o Teste pós-deploy consta como NÃO TESTADO.");
    }
  }

  console.log("=====================================================");
  if (errors.length > 0) {
    console.error("✗ Falhas de governança documental encontradas:");
    errors.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  } else {
    console.log("✓ Governança e documentação validadas com sucesso!");
    process.exit(0);
  }
}

checkGovernance();
