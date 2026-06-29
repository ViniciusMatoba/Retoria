import { dbAdmin } from "./firebaseAdmin";
import { getMessaging } from "firebase-admin/messaging";
import { getApp } from "firebase-admin/app";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/**
 * Envia notificação push para todos os dispositivos registrados de um profissional.
 * Falha silenciosa — não bloqueia o fluxo principal de agendamento.
 */
export async function sendPushToProf(
  professionalId: string,
  payload: PushPayload,
): Promise<void> {
  if (!dbAdmin) return;

  try {
    const tokensSnap = await dbAdmin
      .collection("professionals")
      .doc(professionalId)
      .collection("fcmTokens")
      .get();

    if (tokensSnap.empty) return;

    const tokens = tokensSnap.docs.map((d: QueryDocumentSnapshot) => d.id);
    const messaging = getMessaging(getApp());

    const { responses } = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        url: payload.url ?? "/dashboard",
      },
      webpush: {
        notification: {
          icon: "/icon-192.png",
          requireInteraction: false,
        },
        fcmOptions: {
          link: payload.url ?? "/dashboard",
        },
      },
    });

    // Remove tokens inválidos (expirados ou revogados)
    const invalidTokenDocs = tokensSnap.docs.filter(
      (_: QueryDocumentSnapshot, i: number) =>
        !responses[i].success &&
        (responses[i].error?.code === "messaging/registration-token-not-registered" ||
          responses[i].error?.code === "messaging/invalid-registration-token"),
    );

    if (invalidTokenDocs.length > 0) {
      const batch = dbAdmin.batch();
      invalidTokenDocs.forEach((d: QueryDocumentSnapshot) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch {
    // Notificação falha silenciosamente — agendamento não é afetado
  }
}
