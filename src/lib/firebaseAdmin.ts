import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  : null;

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
