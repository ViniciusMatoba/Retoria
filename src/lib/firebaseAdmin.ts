import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

let serviceAccount = null;

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
    
    // Fix double-escaped newlines in private key
    if (serviceAccount && typeof serviceAccount.private_key === "string") {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
    }
  } catch (err) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY environment variable:", err);
  }
}

const app = getApps().length === 0
  ? initializeApp(
      serviceAccount
        ? { credential: cert(serviceAccount) }
        : { projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "retoria-app" }
    )
  : getApp();

const dbAdmin = getFirestore(app);
const authAdmin = getAuth(app);

export { dbAdmin, authAdmin };
