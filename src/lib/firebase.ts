import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// During build/prerendering time, env vars are empty. We use dummy placeholders
// matching expected formats to prevent module initialization errors.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDummyApiKey_ForBuildPrerenderOnly",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "retoria-dummy.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "retoria-dummy",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "retoria-dummy.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:1234567890:web:1234567890abcdef",
};

// Check if Firebase is configured with real env variables
const isConfigured = !!(
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY && 
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== "your_firebase_api_key"
);

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Painel com cache local: agenda, leads e clientes aparecem na hora ao abrir e o Firestore só baixa o que mudou.
// A página pública (/p/...) fica sem cache: quem agenda precisa sempre dos horários livres do momento.
function createDb() {
  if (typeof window === "undefined" || window.location.pathname.startsWith("/p/")) return getFirestore(app);
  try {
    return initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch {
    return getFirestore(app); // já inicializado (recarga em desenvolvimento)
  }
}

const auth = getAuth(app);
const db = createDb();
const storage = getStorage(app);

export { app, auth, db, storage, isConfigured };
