"use client";

import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { app } from "./firebase";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "";

/**
 * Solicita permissão de notificação e retorna o FCM token do dispositivo.
 * Retorna null se o browser não suportar ou o usuário recusar.
 */
export async function requestFcmToken(): Promise<string | null> {
  try {
    const supported = await isSupported();
    if (!supported) return null;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const messaging = getMessaging(app);
    // Sem chave própria configurada, o SDK usa a chave padrão do Firebase
    const token = await getToken(messaging, { vapidKey: VAPID_KEY || undefined });
    return token ?? null;
  } catch (err) {
    console.error("[push] não foi possível registrar o aparelho:", err);
    return null;
  }
}

/**
 * Retorna o FCM token atual sem pedir permissão.
 * Útil para verificar se o dispositivo já está registrado.
 */
export async function getCurrentFcmToken(): Promise<string | null> {
  try {
    const supported = await isSupported();
    if (!supported || Notification.permission !== "granted") return null;

    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    return token ?? null;
  } catch {
    return null;
  }
}
