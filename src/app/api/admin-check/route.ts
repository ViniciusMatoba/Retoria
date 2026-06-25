import { NextResponse } from "next/server";

export async function GET() {
  // Importa dinamicamente para não crashar se o módulo tiver problemas
  let dbStatus = "not_imported";
  let initError = "";
  try {
    const { dbAdmin } = await import("@/lib/firebaseAdmin");
    dbStatus = dbAdmin ? "ok" : "null_no_credentials";
  } catch (e: any) {
    dbStatus = "import_error";
    initError = e?.message ?? String(e);
  }

  const hasServiceAccountKey = !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const hasPrivateKey = !!process.env.FIREBASE_PRIVATE_KEY;
  const hasClientEmail = !!process.env.FIREBASE_CLIENT_EMAIL;
  const hasProjectId = !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  // Testa se o JSON da service account parseia corretamente (sem expor o valor)
  let jsonParseStatus = "not_tested";
  if (hasServiceAccountKey) {
    try {
      let raw = (process.env.FIREBASE_SERVICE_ACCOUNT_KEY ?? "").trim();
      if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
        raw = raw.slice(1, -1).trim();
      }
      const parsed = JSON.parse(raw);
      const hasRequiredFields =
        typeof parsed.private_key === "string" &&
        typeof parsed.client_email === "string" &&
        typeof parsed.project_id === "string";
      jsonParseStatus = hasRequiredFields ? "valid_json_with_required_fields" : "valid_json_but_missing_fields";
    } catch (e: any) {
      jsonParseStatus = `parse_error: ${e?.message}`;
    }
  }

  return NextResponse.json({
    dbAdmin: dbStatus,
    initError: initError || undefined,
    envVars: {
      FIREBASE_SERVICE_ACCOUNT_KEY: hasServiceAccountKey,
      FIREBASE_PRIVATE_KEY: hasPrivateKey,
      FIREBASE_CLIENT_EMAIL: hasClientEmail,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: hasProjectId,
    },
    serviceAccountJson: jsonParseStatus,
  });
}
