/**
 * Firebase Security Rules test suite.
 *
 * Execução:
 *   npm run test:rules
 *   (inicia o emulador automaticamente via firebase emulators:exec)
 *
 * Requer Firebase CLI instalado:
 *   npm install -g firebase-tools
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { setDoc, getDoc, updateDoc, deleteDoc, doc, collection } from "firebase/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// ─── IDs de teste ─────────────────────────────────────────────────────────────

const PROF_UID   = "prof-abc123";
const OTHER_PROF = "prof-xyz999";
const CUST_UID   = "cust-def456";
const OTHER_CUST = "cust-ghi789";
const LEAD_ID    = "lead-001";
const SERVICE_ID = "svc-001";

// ─── helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function test(label, fn) {
  try {
    await fn();
    console.log(`  ✓ ${label}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${label}`);
    console.error(`    ${err.message?.split("\n")[0]}`);
    failed++;
  }
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  const firestoreRules = readFileSync(resolve(root, "firestore.rules"), "utf8");
  const storageRules   = readFileSync(resolve(root, "storage.rules"), "utf8");

  const testEnv = await initializeTestEnvironment({
    projectId: "agendazap-test",
    firestore: { rules: firestoreRules, host: "127.0.0.1", port: 8080 },
    storage:   { rules: storageRules,   host: "127.0.0.1", port: 9199 },
  });

  // Pré-popula dados base para os testes
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const fs = ctx.firestore();
    // Profissional existente
    await setDoc(doc(fs, "professionals", PROF_UID), { nome: "Prof A", slugPublico: "prof-a" });
    // Serviço
    await setDoc(doc(fs, "professionals", PROF_UID, "services", SERVICE_ID), { nome: "Corte", ativo: true });
    // Lead principal
    await setDoc(doc(fs, "professionals", PROF_UID, "leads", LEAD_ID), {
      professionalId: PROF_UID, customerUid: CUST_UID, status: "Novo", nome: "João"
    });
    // Customer account
    await setDoc(doc(fs, "customerAccounts", CUST_UID), {
      uid: CUST_UID, name: "João", email: "joao@test.com", createdAt: new Date(), updatedAt: new Date()
    });
    // Booking index
    await setDoc(doc(fs, "customerAccounts", CUST_UID, "bookings", LEAD_ID), {
      bookingId: LEAD_ID, professionalId: PROF_UID, status: "Novo",
      date: "2026-07-01", startTime: "10:00", endTime: "11:00"
    });
    // Account doc
    await setDoc(doc(fs, "accounts", PROF_UID), {
      uid: PROF_UID, email: "prof@test.com", displayName: "Prof", accountTypes: ["professional"],
      createdAt: new Date(), updatedAt: new Date()
    });
    await setDoc(doc(fs, "accounts", CUST_UID), {
      uid: CUST_UID, email: "joao@test.com", displayName: "João", accountTypes: ["customer"],
      createdAt: new Date(), updatedAt: new Date()
    });
    // Relationship (customers subcollection)
    await setDoc(doc(fs, "professionals", PROF_UID, "customers", CUST_UID), {
      customerUid: CUST_UID, lastBookingDate: "2026-07-01"
    });
  });

  // ── accounts ──────────────────────────────────────────────────────────────
  console.log("\naccounts");

  await test("owner lê o próprio account", async () => {
    const ctx = testEnv.authenticatedContext(PROF_UID);
    await assertSucceeds(getDoc(doc(ctx.firestore(), "accounts", PROF_UID)));
  });

  await test("owner não lê account de outro", async () => {
    const ctx = testEnv.authenticatedContext(CUST_UID);
    await assertFails(getDoc(doc(ctx.firestore(), "accounts", PROF_UID)));
  });

  await test("visitante não lê accounts", async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertFails(getDoc(doc(ctx.firestore(), "accounts", PROF_UID)));
  });

  await test("owner atualiza displayName e accountTypes", async () => {
    const ctx = testEnv.authenticatedContext(PROF_UID);
    await assertSucceeds(
      updateDoc(doc(ctx.firestore(), "accounts", PROF_UID), {
        displayName: "Novo Nome", accountTypes: ["professional"], updatedAt: new Date()
      })
    );
  });

  await test("owner não altera uid em accounts", async () => {
    const ctx = testEnv.authenticatedContext(PROF_UID);
    await assertFails(
      updateDoc(doc(ctx.firestore(), "accounts", PROF_UID), { uid: "outro-uid", updatedAt: new Date() })
    );
  });

  await test("owner não altera email em accounts", async () => {
    const ctx = testEnv.authenticatedContext(PROF_UID);
    await assertFails(
      updateDoc(doc(ctx.firestore(), "accounts", PROF_UID), { email: "hacker@evil.com", updatedAt: new Date() })
    );
  });

  // ── customerAccounts ──────────────────────────────────────────────────────
  console.log("\ncustomerAccounts");

  await test("cliente lê o próprio customerAccount", async () => {
    const ctx = testEnv.authenticatedContext(CUST_UID);
    await assertSucceeds(getDoc(doc(ctx.firestore(), "customerAccounts", CUST_UID)));
  });

  await test("cliente não lê customerAccount de outro", async () => {
    const ctx = testEnv.authenticatedContext(PROF_UID);
    await assertFails(getDoc(doc(ctx.firestore(), "customerAccounts", CUST_UID)));
  });

  await test("visitante não lê customerAccounts", async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertFails(getDoc(doc(ctx.firestore(), "customerAccounts", CUST_UID)));
  });

  await test("cliente atualiza name e phone", async () => {
    const ctx = testEnv.authenticatedContext(CUST_UID);
    await assertSucceeds(
      updateDoc(doc(ctx.firestore(), "customerAccounts", CUST_UID), {
        name: "João Atualizado", phone: "11999999999", updatedAt: new Date()
      })
    );
  });

  await test("cliente não altera uid em customerAccounts", async () => {
    const ctx = testEnv.authenticatedContext(CUST_UID);
    await assertFails(
      updateDoc(doc(ctx.firestore(), "customerAccounts", CUST_UID), { uid: "outro-uid", updatedAt: new Date() })
    );
  });

  await test("cliente não altera email em customerAccounts", async () => {
    const ctx = testEnv.authenticatedContext(CUST_UID);
    await assertFails(
      updateDoc(doc(ctx.firestore(), "customerAccounts", CUST_UID), { email: "hacked@evil.com", updatedAt: new Date() })
    );
  });

  await test("cliente não altera createdAt em customerAccounts", async () => {
    const ctx = testEnv.authenticatedContext(CUST_UID);
    await assertFails(
      updateDoc(doc(ctx.firestore(), "customerAccounts", CUST_UID), { createdAt: new Date(0), updatedAt: new Date() })
    );
  });

  await test("cliente não adiciona campos administrativos em customerAccounts", async () => {
    const ctx = testEnv.authenticatedContext(CUST_UID);
    await assertFails(
      updateDoc(doc(ctx.firestore(), "customerAccounts", CUST_UID), { plan: "premium", updatedAt: new Date() })
    );
  });

  await test("cliente cria próprio customerAccount com campos permitidos", async () => {
    const ctx = testEnv.authenticatedContext("new-cust-999");
    await assertSucceeds(
      setDoc(doc(ctx.firestore(), "customerAccounts", "new-cust-999"), {
        uid: "new-cust-999", name: "Novo", email: "novo@test.com",
        createdAt: new Date(), updatedAt: new Date()
      })
    );
  });

  await test("cliente não cria customerAccount com uid incorreto", async () => {
    const ctx = testEnv.authenticatedContext(CUST_UID);
    await assertFails(
      setDoc(doc(ctx.firestore(), "customerAccounts", CUST_UID), {
        uid: "uid-errado", name: "Teste", email: "t@t.com",
        createdAt: new Date(), updatedAt: new Date()
      })
    );
  });

  // ── customerAccounts/{uid}/bookings ───────────────────────────────────────
  console.log("\ncustomerAccounts/{uid}/bookings");

  await test("cliente lê o próprio índice de agendamentos", async () => {
    const ctx = testEnv.authenticatedContext(CUST_UID);
    await assertSucceeds(
      getDoc(doc(ctx.firestore(), "customerAccounts", CUST_UID, "bookings", LEAD_ID))
    );
  });

  await test("cliente não lê índice de agendamentos de outro", async () => {
    const ctx = testEnv.authenticatedContext(OTHER_CUST);
    await assertFails(
      getDoc(doc(ctx.firestore(), "customerAccounts", CUST_UID, "bookings", LEAD_ID))
    );
  });

  await test("visitante não lê bookings", async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertFails(
      getDoc(doc(ctx.firestore(), "customerAccounts", CUST_UID, "bookings", LEAD_ID))
    );
  });

  await test("cliente não cria no próprio índice (write: if false)", async () => {
    const ctx = testEnv.authenticatedContext(CUST_UID);
    await assertFails(
      setDoc(doc(ctx.firestore(), "customerAccounts", CUST_UID, "bookings", "new-booking"), {
        bookingId: "new-booking", status: "Novo"
      })
    );
  });

  await test("cliente não atualiza próprio índice (write: if false)", async () => {
    const ctx = testEnv.authenticatedContext(CUST_UID);
    await assertFails(
      updateDoc(doc(ctx.firestore(), "customerAccounts", CUST_UID, "bookings", LEAD_ID), {
        status: "Cancelado"
      })
    );
  });

  await test("cliente não exclui do próprio índice (write: if false)", async () => {
    const ctx = testEnv.authenticatedContext(CUST_UID);
    await assertFails(
      deleteDoc(doc(ctx.firestore(), "customerAccounts", CUST_UID, "bookings", LEAD_ID))
    );
  });

  await test("profissional não acessa bookings de cliente sem autorização", async () => {
    const ctx = testEnv.authenticatedContext(PROF_UID);
    await assertFails(
      getDoc(doc(ctx.firestore(), "customerAccounts", CUST_UID, "bookings", LEAD_ID))
    );
  });

  // ── professionals/{profId}/customers ─────────────────────────────────────
  console.log("\nprofessionals/{profId}/customers");

  await test("profissional lê clientes do próprio espaço", async () => {
    const ctx = testEnv.authenticatedContext(PROF_UID);
    await assertSucceeds(
      getDoc(doc(ctx.firestore(), "professionals", PROF_UID, "customers", CUST_UID))
    );
  });

  await test("profissional não lê clientes de outro profissional", async () => {
    const ctx = testEnv.authenticatedContext(OTHER_PROF);
    await assertFails(
      getDoc(doc(ctx.firestore(), "professionals", PROF_UID, "customers", CUST_UID))
    );
  });

  await test("cliente final não lista clientes de profissional", async () => {
    const ctx = testEnv.authenticatedContext(CUST_UID);
    await assertFails(
      getDoc(doc(ctx.firestore(), "professionals", PROF_UID, "customers", CUST_UID))
    );
  });

  await test("visitante não lê customers", async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertFails(
      getDoc(doc(ctx.firestore(), "professionals", PROF_UID, "customers", CUST_UID))
    );
  });

  await test("profissional não escreve diretamente em customers (Admin SDK only)", async () => {
    const ctx = testEnv.authenticatedContext(PROF_UID);
    await assertFails(
      setDoc(doc(ctx.firestore(), "professionals", PROF_UID, "customers", "new-cust"), {
        customerUid: "new-cust"
      })
    );
  });

  await test("cliente não escreve diretamente em customers", async () => {
    const ctx = testEnv.authenticatedContext(CUST_UID);
    await assertFails(
      setDoc(doc(ctx.firestore(), "professionals", PROF_UID, "customers", CUST_UID), {
        customerUid: CUST_UID
      })
    );
  });

  // ── professionals/{profId}/usage ──────────────────────────────────────────
  console.log("\nprofessionals/{profId}/usage");

  await test("profissional lê suas próprias métricas", async () => {
    // Pré-preenche via bypass
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "professionals", PROF_UID, "usage", "2026-06"), { bookings: 5 });
    });
    const ctx = testEnv.authenticatedContext(PROF_UID);
    await assertSucceeds(
      getDoc(doc(ctx.firestore(), "professionals", PROF_UID, "usage", "2026-06"))
    );
  });

  await test("profissional não lê métricas de outro", async () => {
    const ctx = testEnv.authenticatedContext(OTHER_PROF);
    await assertFails(
      getDoc(doc(ctx.firestore(), "professionals", PROF_UID, "usage", "2026-06"))
    );
  });

  await test("cliente não lê usage de profissional", async () => {
    const ctx = testEnv.authenticatedContext(CUST_UID);
    await assertFails(
      getDoc(doc(ctx.firestore(), "professionals", PROF_UID, "usage", "2026-06"))
    );
  });

  await test("visitante não lê usage", async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertFails(
      getDoc(doc(ctx.firestore(), "professionals", PROF_UID, "usage", "2026-06"))
    );
  });

  await test("profissional não escreve diretamente em usage (Admin SDK only)", async () => {
    const ctx = testEnv.authenticatedContext(PROF_UID);
    await assertFails(
      setDoc(doc(ctx.firestore(), "professionals", PROF_UID, "usage", "2026-07"), { bookings: 1 })
    );
  });

  await test("cliente não escreve em usage", async () => {
    const ctx = testEnv.authenticatedContext(CUST_UID);
    await assertFails(
      setDoc(doc(ctx.firestore(), "professionals", PROF_UID, "usage", "2026-07"), { bookings: 1 })
    );
  });

  // ── professionals/{profId}/leads ──────────────────────────────────────────
  console.log("\nprofessionals/{profId}/leads");

  await test("profissional altera lead próprio", async () => {
    const ctx = testEnv.authenticatedContext(PROF_UID);
    await assertSucceeds(
      updateDoc(doc(ctx.firestore(), "professionals", PROF_UID, "leads", LEAD_ID), {
        status: "Agendado", updatedAt: new Date()
      })
    );
  });

  await test("profissional não altera lead de outro", async () => {
    const ctx = testEnv.authenticatedContext(OTHER_PROF);
    await assertFails(
      updateDoc(doc(ctx.firestore(), "professionals", PROF_UID, "leads", LEAD_ID), {
        status: "Agendado"
      })
    );
  });

  await test("cliente não altera status de lead", async () => {
    const ctx = testEnv.authenticatedContext(CUST_UID);
    await assertFails(
      updateDoc(doc(ctx.firestore(), "professionals", PROF_UID, "leads", LEAD_ID), {
        status: "Cancelado"
      })
    );
  });

  await test("visitante não lê leads privados", async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertFails(
      getDoc(doc(ctx.firestore(), "professionals", PROF_UID, "leads", LEAD_ID))
    );
  });

  // ── professionals (público) ───────────────────────────────────────────────
  console.log("\nprofessionals (coleção pública)");

  // SEC-004: leitura pública bloqueada — visitantes usam /api/p/[slug] (DTO via Admin SDK)
  await test("visitante não lê professionals diretamente (SEC-004)", async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertFails(
      getDoc(doc(ctx.firestore(), "professionals", PROF_UID))
    );
  });

  await test("proprietário escreve no próprio documento", async () => {
    const ctx = testEnv.authenticatedContext(PROF_UID);
    await assertSucceeds(
      updateDoc(doc(ctx.firestore(), "professionals", PROF_UID), { descricaoCurta: "Teste" })
    );
  });

  await test("outro usuário não escreve no documento profissional", async () => {
    const ctx = testEnv.authenticatedContext(OTHER_PROF);
    await assertFails(
      updateDoc(doc(ctx.firestore(), "professionals", PROF_UID), { nome: "Hacked" })
    );
  });

  await test("visitante não escreve em professionals", async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertFails(
      setDoc(doc(ctx.firestore(), "professionals", "novo-prof"), { nome: "Invasor" })
    );
  });

  // ── Storage Rules ──────────────────────────────────────────────────────────
  console.log("\nStorage Rules");

  // Upload antes de testar read — emulador lança object-not-found se o objeto não existe
  await test("proprietário envia logo JPEG válido (<2MB)", async () => {
    const ctx = testEnv.authenticatedContext(PROF_UID);
    await assertSucceeds(
      ctx.storage().ref(`logos/${PROF_UID}/logo`).put(new Uint8Array(1024 * 100), { contentType: "image/jpeg" })
    );
  });

  await test("público pode ler logo", async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertSucceeds(ctx.storage().ref(`logos/${PROF_UID}/logo`).getDownloadURL());
  });

  await test("proprietário não envia logo SVG", async () => {
    const ctx = testEnv.authenticatedContext(PROF_UID);
    await assertFails(
      ctx.storage().ref(`logos/${PROF_UID}/logo`).put(new Uint8Array(1024), { contentType: "image/svg+xml" })
    );
  });

  await test("proprietário não envia logo >2MB", async () => {
    const ctx = testEnv.authenticatedContext(PROF_UID);
    await assertFails(
      ctx.storage().ref(`logos/${PROF_UID}/logo`).put(
        new Uint8Array(2 * 1024 * 1024 + 1), { contentType: "image/png" }
      )
    );
  });

  await test("outro usuário não envia logo", async () => {
    const ctx = testEnv.authenticatedContext(OTHER_PROF);
    await assertFails(
      ctx.storage().ref(`logos/${PROF_UID}/logo`).put(new Uint8Array(1024), { contentType: "image/png" })
    );
  });

  await test("não autenticado não envia logo", async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertFails(
      ctx.storage().ref(`logos/${PROF_UID}/logo`).put(new Uint8Array(1024), { contentType: "image/png" })
    );
  });

  await test("proprietário envia cover de serviço (WebP, <2MB)", async () => {
    const ctx = testEnv.authenticatedContext(PROF_UID);
    await assertSucceeds(
      ctx.storage().ref(`services/${PROF_UID}/${SERVICE_ID}/cover`).put(
        new Uint8Array(1024 * 500), { contentType: "image/webp" }
      )
    );
  });

  await test("proprietário não envia cover >2MB", async () => {
    const ctx = testEnv.authenticatedContext(PROF_UID);
    await assertFails(
      ctx.storage().ref(`services/${PROF_UID}/${SERVICE_ID}/cover`).put(
        new Uint8Array(2 * 1024 * 1024 + 1), { contentType: "image/png" }
      )
    );
  });

  await test("proprietário envia background (PNG, <3MB)", async () => {
    const ctx = testEnv.authenticatedContext(PROF_UID);
    await assertSucceeds(
      ctx.storage().ref(`backgrounds/${PROF_UID}/main`).put(
        new Uint8Array(2 * 1024 * 1024), { contentType: "image/png" }
      )
    );
  });

  await test("proprietário não envia background >3MB", async () => {
    const ctx = testEnv.authenticatedContext(PROF_UID);
    await assertFails(
      ctx.storage().ref(`backgrounds/${PROF_UID}/main`).put(
        new Uint8Array(3 * 1024 * 1024 + 1), { contentType: "image/png" }
      )
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TESTES DE SEGURANÇA — SEC-*
  // ═══════════════════════════════════════════════════════════════════════════

  // ── SEC-001/002: endpoints de diagnóstico não têm regras Firestore ────────
  // (cobertos por testes de API separados — não aplicável aqui)

  // ── SEC-004: campos sensíveis expostos em professionals ───────────────────
  console.log("\n[SEC-004] professionals — campos sensíveis acessíveis anonimamente");

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "professionals", PROF_UID), {
      nome: "Prof A",
      slugPublico: "prof-a",
      email: "prof@secret.com",
      telefoneWhatsapp: "11999999999",
      plan: "professional",
      professionalStatus: "active",
      trialEndsAt: new Date(),
    });
  });

  await test("SEC-004 corrigido: visitante não lê professionals via client SDK", async () => {
    const ctx = testEnv.unauthenticatedContext();
    // Após SEC-004: allow read: if isAuth() — visitantes bloqueados.
    // Dados públicos servidos via /api/p/[slug] com DTO filtrado (Admin SDK).
    await assertFails(getDoc(doc(ctx.firestore(), "professionals", PROF_UID)));
  });

  await test("SEC-004: usuário autenticado pode ler professionals", async () => {
    const ctx = testEnv.authenticatedContext(OTHER_PROF);
    await assertSucceeds(getDoc(doc(ctx.firestore(), "professionals", PROF_UID)));
  });

  // ── SEC-005: slots sem bookingId; slotBookings privado ────────────────────
  console.log("\n[SEC-005] availableSlots — bookingId removido; slotBookings privado");

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    // Slot sem bookingId/ocupacaoTipo (correto após SEC-005)
    await setDoc(doc(ctx.firestore(), "professionals", PROF_UID, "availableSlots", "slot-001"), {
      data: "2026-07-01", horario: "10:00", disponivel: false,
    });
    // Índice privado no slotBookings
    await setDoc(doc(ctx.firestore(), "professionals", PROF_UID, "slotBookings", LEAD_ID), {
      slotIds: ["slot-001"], updatedAt: new Date(),
    });
  });

  await test("SEC-005 corrigido: slot não contém bookingId nem ocupacaoTipo", async () => {
    const ctx = testEnv.unauthenticatedContext();
    const snap = await assertSucceeds(
      getDoc(doc(ctx.firestore(), "professionals", PROF_UID, "availableSlots", "slot-001"))
    );
    const data = snap.data() ?? {};
    if ("bookingId" in data || "ocupacaoTipo" in data) {
      throw new Error("slot ainda expõe bookingId ou ocupacaoTipo");
    }
  });

  await test("SEC-005: visitante não lê slotBookings (índice privado)", async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertFails(
      getDoc(doc(ctx.firestore(), "professionals", PROF_UID, "slotBookings", LEAD_ID))
    );
  });

  await test("SEC-005: profissional dono pode ler slotBookings", async () => {
    const ctx = testEnv.authenticatedContext(PROF_UID);
    await assertSucceeds(
      getDoc(doc(ctx.firestore(), "professionals", PROF_UID, "slotBookings", LEAD_ID))
    );
  });

  // ── SEC-007: isolamento de leads entre profissionais ──────────────────────
  console.log("\n[SEC-007] leads — isolamento entre profissionais");

  await test("profissional não lê leads de outro profissional", async () => {
    const ctx = testEnv.authenticatedContext(OTHER_PROF);
    await assertFails(
      getDoc(doc(ctx.firestore(), "professionals", PROF_UID, "leads", LEAD_ID))
    );
  });

  await test("cliente não lê leads de profissional", async () => {
    const ctx = testEnv.authenticatedContext(CUST_UID);
    await assertFails(
      getDoc(doc(ctx.firestore(), "professionals", PROF_UID, "leads", LEAD_ID))
    );
  });

  // ── SEC-015: accessRequests — validação de plano nas regras ──────────────
  console.log("\n[SEC-015] accessRequests — validação de plano");

  await test("visitante cria accessRequest com plano válido", async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertSucceeds(
      setDoc(doc(ctx.firestore(), "accessRequests", "req-valid"), {
        nome: "Teste", email: "t@t.com",
        plano: "professional", status: "pending",
        createdAt: new Date(),
      })
    );
  });

  await test("visitante não cria accessRequest com plano inválido", async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertFails(
      setDoc(doc(ctx.firestore(), "accessRequests", "req-invalid"), {
        nome: "Hacker", email: "h@h.com",
        plano: "admin", status: "pending",
        createdAt: new Date(),
      })
    );
  });

  await test("visitante não cria accessRequest com status diferente de pending", async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertFails(
      setDoc(doc(ctx.firestore(), "accessRequests", "req-status"), {
        nome: "Hacker", email: "h@h.com",
        plano: "professional", status: "attended",
        createdAt: new Date(),
      })
    );
  });

  await test("ninguém atualiza accessRequest via client SDK", async () => {
    const ctx = testEnv.authenticatedContext(PROF_UID);
    await testEnv.withSecurityRulesDisabled(async (ctx2) => {
      await setDoc(doc(ctx2.firestore(), "accessRequests", "req-update-test"), {
        nome: "X", email: "x@x.com", plano: "professional",
        status: "pending", createdAt: new Date(),
      });
    });
    await assertFails(
      updateDoc(doc(ctx.firestore(), "accessRequests", "req-update-test"), { status: "attended" })
    );
  });

  // ── SEC (licenças protegidas) ─────────────────────────────────────────────
  console.log("\n[SEC] licenses / licenseTokens / teamInvites — Admin SDK only");

  await test("ninguém lê licenses via client SDK", async () => {
    const ctx = testEnv.authenticatedContext(PROF_UID);
    await assertFails(
      getDoc(doc(ctx.firestore(), "licenses", PROF_UID))
    );
  });

  await test("ninguém lê licenseTokens via client SDK", async () => {
    const ctx = testEnv.authenticatedContext(PROF_UID);
    await assertFails(
      getDoc(doc(ctx.firestore(), "licenseTokens", "some-token"))
    );
  });

  await test("ninguém lê teamInvites via client SDK", async () => {
    const ctx = testEnv.authenticatedContext(PROF_UID);
    await assertFails(
      getDoc(doc(ctx.firestore(), "teamInvites", "some-invite"))
    );
  });

  await test("ninguém escreve em licenseTokens via client SDK", async () => {
    const ctx = testEnv.authenticatedContext(PROF_UID);
    await assertFails(
      setDoc(doc(ctx.firestore(), "licenseTokens", "forged-token"), { plan: "enterprise" })
    );
  });

  // ── SEC: professionals — campos de licença imutáveis pelo cliente ─────────
  console.log("\n[SEC] professionals — campos de licença/status bloqueados");

  await test("profissional não altera professionalStatus via client SDK (active → trial)", async () => {
    // O documento tem professionalStatus:"active" (criado pelo bloco SEC-004 acima).
    // O ataque real é tentar MUDAR o valor — não setar o mesmo valor existente.
    // A regra usa diff(), que só detecta mudança quando o valor é diferente.
    const ctx = testEnv.authenticatedContext(PROF_UID);
    await assertFails(
      updateDoc(doc(ctx.firestore(), "professionals", PROF_UID), {
        professionalStatus: "trial",
      })
    );
  });

  await test("profissional não altera plan via client SDK", async () => {
    const ctx = testEnv.authenticatedContext(PROF_UID);
    await assertFails(
      updateDoc(doc(ctx.firestore(), "professionals", PROF_UID), {
        plan: "enterprise",
      })
    );
  });

  await test("profissional não altera trialEndsAt via client SDK", async () => {
    const ctx = testEnv.authenticatedContext(PROF_UID);
    await assertFails(
      updateDoc(doc(ctx.firestore(), "professionals", PROF_UID), {
        trialEndsAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
      })
    );
  });

  await test("profissional não altera id/userId/createdAt via client SDK", async () => {
    const ctx = testEnv.authenticatedContext(PROF_UID);
    await assertFails(
      updateDoc(doc(ctx.firestore(), "professionals", PROF_UID), {
        id: "outro-uid",
      })
    );
  });

  // ── SEC-017: accountTypes — cliente não escalona privilégio ──────────────
  console.log("\n[SEC-017] accounts — escalação de privilégio via accountTypes");

  await test("cliente pode atualizar displayName e accountTypes no próprio account", async () => {
    const ctx = testEnv.authenticatedContext(CUST_UID);
    await assertSucceeds(
      updateDoc(doc(ctx.firestore(), "accounts", CUST_UID), {
        displayName: "João Updated",
        accountTypes: ["customer", "professional"],
        updatedAt: new Date(),
      })
    );
    // Nota: Esta operação sucede pois a regra atual permite alterar accountTypes.
    // SEC-017 documenta que isso deve ser revisado — accountTypes não é controle de acesso real.
  });

  await test("cliente não altera uid no próprio account", async () => {
    const ctx = testEnv.authenticatedContext(CUST_UID);
    await assertFails(
      updateDoc(doc(ctx.firestore(), "accounts", CUST_UID), {
        uid: "escalated-uid",
        updatedAt: new Date(),
      })
    );
  });

  // ── SEC: cruzamento entre clientes ───────────────────────────────────────
  console.log("\n[SEC] isolamento entre clientes");

  await test("cliente A não lê dados de cliente B", async () => {
    const ctx = testEnv.authenticatedContext(OTHER_CUST);
    await assertFails(
      getDoc(doc(ctx.firestore(), "customerAccounts", CUST_UID))
    );
  });

  await test("cliente não acessa bookings de outro cliente", async () => {
    const ctx = testEnv.authenticatedContext(OTHER_CUST);
    await assertFails(
      getDoc(doc(ctx.firestore(), "customerAccounts", CUST_UID, "bookings", LEAD_ID))
    );
  });

  // ── Resultados ─────────────────────────────────────────────────────────────
  await testEnv.cleanup();

  const total = passed + failed;
  console.log(`\n${"─".repeat(50)}`);
  console.log(`Resultados: ${passed}/${total} aprovados, ${failed} reprovados`);

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
