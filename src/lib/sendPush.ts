import { dbAdmin } from "./firebaseAdmin";
import { getMessaging } from "firebase-admin/messaging";
import { getApp } from "firebase-admin/app";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

const ICON = "/dashboard/app-icon";
const DEFAULT_URL = "/dashboard/leads";

/**
 * Envia notificação push para todos os dispositivos registrados de um profissional.
 * Falha silenciosa — não bloqueia o fluxo principal de agendamento.
 * Devolve quantos aparelhos estão registrados e quantos receberam.
 * Em rotas, chamar dentro de after() (next/server): sem isso a função pode ser congelada antes do envio.
 */
export async function sendPushToProf(
  professionalId: string,
  payload: PushPayload,
): Promise<{ total: number; sent: number }> {
  if (!dbAdmin) return { total: 0, sent: 0 };

  try {
    const tokensSnap = await dbAdmin
      .collection("professionals")
      .doc(professionalId)
      .collection("fcmTokens")
      .get();

    if (tokensSnap.empty) return { total: 0, sent: 0 };

    const tokens = tokensSnap.docs.map((d: QueryDocumentSnapshot) => d.id);
    const messaging = getMessaging(getApp());

    const { responses } = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        url: payload.url ?? DEFAULT_URL,
      },
      webpush: {
        notification: {
          icon: ICON,
          badge: ICON,
          requireInteraction: false,
        },
        fcmOptions: {
          link: payload.url ?? DEFAULT_URL,
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
    return { total: tokens.length, sent: responses.filter((r: { success: boolean }) => r.success).length };
  } catch (err) {
    // Notificação falha silenciosamente — agendamento não é afetado
    console.error("[push]", (err as { code?: string; message?: string }).code ?? (err as Error).message);
    return { total: 0, sent: 0 };
  }
}
