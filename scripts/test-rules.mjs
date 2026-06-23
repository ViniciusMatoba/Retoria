/**
 * Firebase Security Rules test suite.
 * Requires Firebase Local Emulator running (started automatically).
 *
 * Usage: node scripts/test-rules.mjs
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const OWNER_UID = "prof-abc123";
const OTHER_UID = "prof-xyz999";
const PROF_ID = OWNER_UID;
const SERVICE_ID = "svc-001";

// ─── helpers ────────────────────────────────────────────────────────────────

function makeMockFile({ size, contentType }) {
  return {
    size,
    contentType,
  };
}

let passed = 0;
let failed = 0;

async function test(label, fn) {
  try {
    await fn();
    console.log(`  ✓ ${label}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${label}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  const firestoreRules = readFileSync(resolve(root, "firestore.rules"), "utf8");
  const storageRules = readFileSync(resolve(root, "storage.rules"), "utf8");

  const testEnv = await initializeTestEnvironment({
    projectId: "agendazap-test",
    firestore: {
      rules: firestoreRules,
      host: "127.0.0.1",
      port: 8080,
    },
    storage: {
      rules: storageRules,
      host: "127.0.0.1",
      port: 9199,
    },
  });

  // ── Firestore Rules ────────────────────────────────────────────────────────
  console.log("\nFirestore Rules");

  await test("public can read professionals", async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertSucceeds(
      ctx.firestore().collection("professionals").doc(PROF_ID).get()
    );
  });

  await test("owner can write their professional doc", async () => {
    const ctx = testEnv.authenticatedContext(OWNER_UID);
    await assertSucceeds(
      ctx
        .firestore()
        .collection("professionals")
        .doc(PROF_ID)
        .set({ name: "Test" })
    );
  });

  await test("other user cannot write professional doc", async () => {
    const ctx = testEnv.authenticatedContext(OTHER_UID);
    await assertFails(
      ctx
        .firestore()
        .collection("professionals")
        .doc(PROF_ID)
        .set({ name: "Hacked" })
    );
  });

  await test("unauthenticated cannot write professional doc", async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertFails(
      ctx
        .firestore()
        .collection("professionals")
        .doc(PROF_ID)
        .set({ name: "Hacked" })
    );
  });

  await test("owner can write services subcollection", async () => {
    const ctx = testEnv.authenticatedContext(OWNER_UID);
    await assertSucceeds(
      ctx
        .firestore()
        .collection("professionals")
        .doc(PROF_ID)
        .collection("services")
        .doc(SERVICE_ID)
        .set({ title: "Corte" })
    );
  });

  await test("other user cannot write services subcollection", async () => {
    const ctx = testEnv.authenticatedContext(OTHER_UID);
    await assertFails(
      ctx
        .firestore()
        .collection("professionals")
        .doc(PROF_ID)
        .collection("services")
        .doc(SERVICE_ID)
        .set({ title: "Hacked" })
    );
  });

  await test("owner can read/write leads", async () => {
    const ctx = testEnv.authenticatedContext(OWNER_UID);
    await assertSucceeds(
      ctx
        .firestore()
        .collection("professionals")
        .doc(PROF_ID)
        .collection("leads")
        .doc("lead-001")
        .set({ phone: "99999" })
    );
  });

  await test("public cannot read leads", async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertFails(
      ctx
        .firestore()
        .collection("professionals")
        .doc(PROF_ID)
        .collection("leads")
        .doc("lead-001")
        .get()
    );
  });

  // ── Storage Rules ──────────────────────────────────────────────────────────
  console.log("\nStorage Rules");

  await test("public can read logo", async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertSucceeds(
      ctx.storage().ref(`logos/${PROF_ID}/logo`).getDownloadURL()
    );
  });

  await test("owner can upload valid logo (JPEG, <2MB)", async () => {
    const ctx = testEnv.authenticatedContext(OWNER_UID);
    await assertSucceeds(
      ctx
        .storage()
        .ref(`logos/${PROF_ID}/logo`)
        .put(
          new Uint8Array(1024 * 100), // 100KB
          { contentType: "image/jpeg" }
        )
    );
  });

  await test("owner cannot upload SVG logo", async () => {
    const ctx = testEnv.authenticatedContext(OWNER_UID);
    await assertFails(
      ctx
        .storage()
        .ref(`logos/${PROF_ID}/logo`)
        .put(new Uint8Array(1024), { contentType: "image/svg+xml" })
    );
  });

  await test("owner cannot upload logo >2MB", async () => {
    const ctx = testEnv.authenticatedContext(OWNER_UID);
    await assertFails(
      ctx
        .storage()
        .ref(`logos/${PROF_ID}/logo`)
        .put(
          new Uint8Array(2 * 1024 * 1024 + 1),
          { contentType: "image/png" }
        )
    );
  });

  await test("other user cannot upload logo", async () => {
    const ctx = testEnv.authenticatedContext(OTHER_UID);
    await assertFails(
      ctx
        .storage()
        .ref(`logos/${PROF_ID}/logo`)
        .put(new Uint8Array(1024), { contentType: "image/png" })
    );
  });

  await test("unauthenticated cannot upload logo", async () => {
    const ctx = testEnv.unauthenticatedContext();
    await assertFails(
      ctx
        .storage()
        .ref(`logos/${PROF_ID}/logo`)
        .put(new Uint8Array(1024), { contentType: "image/png" })
    );
  });

  await test("owner can upload valid service cover (WebP, <2MB)", async () => {
    const ctx = testEnv.authenticatedContext(OWNER_UID);
    await assertSucceeds(
      ctx
        .storage()
        .ref(`services/${PROF_ID}/${SERVICE_ID}/cover`)
        .put(new Uint8Array(1024 * 500), { contentType: "image/webp" })
    );
  });

  await test("owner cannot upload service cover >2MB", async () => {
    const ctx = testEnv.authenticatedContext(OWNER_UID);
    await assertFails(
      ctx
        .storage()
        .ref(`services/${PROF_ID}/${SERVICE_ID}/cover`)
        .put(
          new Uint8Array(2 * 1024 * 1024 + 1),
          { contentType: "image/png" }
        )
    );
  });

  await test("other user cannot upload service cover", async () => {
    const ctx = testEnv.authenticatedContext(OTHER_UID);
    await assertFails(
      ctx
        .storage()
        .ref(`services/${PROF_ID}/${SERVICE_ID}/cover`)
        .put(new Uint8Array(1024), { contentType: "image/jpeg" })
    );
  });

  await test("owner can upload valid background (PNG, <3MB)", async () => {
    const ctx = testEnv.authenticatedContext(OWNER_UID);
    await assertSucceeds(
      ctx
        .storage()
        .ref(`backgrounds/${PROF_ID}/main`)
        .put(new Uint8Array(2 * 1024 * 1024), { contentType: "image/png" })
    );
  });

  await test("owner cannot upload background >3MB", async () => {
    const ctx = testEnv.authenticatedContext(OWNER_UID);
    await assertFails(
      ctx
        .storage()
        .ref(`backgrounds/${PROF_ID}/main`)
        .put(
          new Uint8Array(3 * 1024 * 1024 + 1),
          { contentType: "image/png" }
        )
    );
  });

  await test("other user cannot upload background", async () => {
    const ctx = testEnv.authenticatedContext(OTHER_UID);
    await assertFails(
      ctx
        .storage()
        .ref(`backgrounds/${PROF_ID}/main`)
        .put(new Uint8Array(1024), { contentType: "image/jpeg" })
    );
  });

  // ── Results ────────────────────────────────────────────────────────────────
  await testEnv.cleanup();

  console.log(`\n${"─".repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
