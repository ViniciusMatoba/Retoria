"use client";

import { useEffect, useState, useCallback } from "react";
import { doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { requestFcmToken, getCurrentFcmToken } from "@/lib/fcm";

export type PermissionState = "default" | "granted" | "denied" | "unsupported";

interface UsePushNotificationReturn {
  permission: PermissionState;
  isRegistered: boolean;
  isLoading: boolean;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
}

export function usePushNotification(userId: string | undefined): UsePushNotificationReturn {
  const [permission, setPermission] = useState<PermissionState>("default");
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Sincroniza estado inicial com o que o browser já tem
  useEffect(() => {
    if (typeof Notification === "undefined") {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as PermissionState);

    if (Notification.permission === "granted" && userId) {
      getCurrentFcmToken().then((token) => {
        if (token) {
          setCurrentToken(token);
          // Garante que o token está salvo no Firestore (renovação automática)
          setDoc(
            doc(db, "professionals", userId, "fcmTokens", token),
            { createdAt: serverTimestamp(), userAgent: navigator.userAgent.slice(0, 200) },
            { merge: true },
          ).catch(() => {});
        }
      });
    }
  }, [userId]);

  const enable = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const token = await requestFcmToken();
      if (!token) {
        setPermission(Notification.permission as PermissionState);
        return;
      }
      await setDoc(
        doc(db, "professionals", userId, "fcmTokens", token),
        { createdAt: serverTimestamp(), userAgent: navigator.userAgent.slice(0, 200) },
        { merge: true },
      );
      setCurrentToken(token);
      setPermission("granted");
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const disable = useCallback(async () => {
    if (!userId || !currentToken) return;
    setIsLoading(true);
    try {
      await deleteDoc(doc(db, "professionals", userId, "fcmTokens", currentToken));
      setCurrentToken(null);
      setPermission("default");
    } finally {
      setIsLoading(false);
    }
  }, [userId, currentToken]);

  return {
    permission,
    isRegistered: !!currentToken,
    isLoading,
    enable,
    disable,
  };
}
