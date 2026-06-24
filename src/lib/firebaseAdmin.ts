import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

let serviceAccount: any = null;

if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  try {
    let rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
    // Remove potential leading/trailing single or double quotes
    if (
      (rawKey.startsWith('"') && rawKey.endsWith('"')) ||
      (rawKey.startsWith("'") && rawKey.endsWith("'"))
    ) {
      rawKey = rawKey.slice(1, -1).trim();
    }
    
    // Parse JSON
    serviceAccount = JSON.parse(rawKey);
  } catch (err) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY environment variable:", err);
  }
} else if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
  serviceAccount = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "retoria-app",
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
  };
}

// Normalize private key newlines
if (serviceAccount) {
  if (typeof serviceAccount.private_key === "string") {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  } else if (typeof serviceAccount.privateKey === "string") {
    serviceAccount.privateKey = serviceAccount.privateKey.replace(/\\n/g, "\n");
  }
}

let dbAdmin: any = null;
let authAdmin: any = null;

try {
  const isEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;

  // Only initialize if we have credentials or are in local emulator mode.
  // This prevents production serverless functions from hanging on metadata server requests when credentials are missing.
  if (serviceAccount || isEmulator) {
    const app = getApps().length === 0
      ? initializeApp(
          serviceAccount
            ? { credential: cert(serviceAccount) }
            : { projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "retoria-app" }
        )
      : getApp();

    dbAdmin = getFirestore(app);
    authAdmin = getAuth(app);
  } else {
    console.error("Firebase Admin SDK credentials are missing! dbAdmin is set to null.");
  }
} catch (err) {
  console.error("Firebase Admin SDK initialization failed:", err);
}

export { dbAdmin, authAdmin };
