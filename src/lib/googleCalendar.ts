import { dbAdmin } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { intervalsFromIsoRange, type BusyByDate } from "@/lib/availability";

// Import dinâmico para evitar crash de ESM/CJS no bundle do Vercel
async function getGoogleApis() {
  const { google } = await import("googleapis");
  return google;
}

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`;

export async function createOAuthClient() {
  const google = await getGoogleApis();
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

export async function getAuthUrl(professionalUid: string) {
  const oauth2Client = await createOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar.events"],
    state: professionalUid,
  });
}

function isInvalidGrant(err: any): boolean {
  return err?.response?.data?.error === "invalid_grant" || String(err?.message ?? "").includes("invalid_grant");
}

// Token revogado/expirado: marca a integração como desconectada para o painel pedir reconexão.
export async function markNeedsReconnect(professionalUid: string) {
  await dbAdmin
    .collection("professionals").doc(professionalUid)
    .collection("integrations").doc("google")
    .set({ connected: false, needsReconnect: true, disconnectedAt: FieldValue.serverTimestamp() }, { merge: true });
}

export interface GoogleTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  connected: boolean;
  connectedAt: any;
}

export async function saveTokens(professionalUid: string, tokens: any) {
  await dbAdmin
    .collection("professionals")
    .doc(professionalUid)
    .collection("integrations")
    .doc("google")
    .set({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date ?? null,
      connected: true,
      connectedAt: FieldValue.serverTimestamp(),
    });
}

export async function getTokens(professionalUid: string): Promise<GoogleTokens | null> {
  const snap = await dbAdmin
    .collection("professionals")
    .doc(professionalUid)
    .collection("integrations")
    .doc("google")
    .get();
  if (!snap.exists || !snap.data()?.connected) return null;
  return snap.data() as GoogleTokens;
}

export async function disconnectGoogle(professionalUid: string) {
  await dbAdmin
    .collection("professionals")
    .doc(professionalUid)
    .collection("integrations")
    .doc("google")
    .set({ connected: false }, { merge: true });
}

export interface CalendarEventParams {
  summary: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  attendeeEmail?: string;
  timezone?: string;
  // Evento provisório (reserva ainda não confirmada pelo profissional)
  tentative?: boolean;
}

export async function deleteCalendarEvent(
  professionalUid: string,
  calendarEventId: string
): Promise<void> {
  const tokens = await getTokens(professionalUid);
  if (!tokens?.refresh_token) return;

  const google = await getGoogleApis();
  const oauth2Client = await createOAuthClient();
  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  try {
    await calendar.events.delete({ calendarId: "primary", eventId: calendarEventId });
  } catch (err: any) {
    if (isInvalidGrant(err)) { await markNeedsReconnect(professionalUid); return; }
    if (err?.code !== 410) throw err;
  }
}

export async function createCalendarEvent(
  professionalUid: string,
  params: CalendarEventParams
): Promise<string | null> {
  const tokens = await getTokens(professionalUid);
  if (!tokens?.refresh_token) return null;

  const google = await getGoogleApis();
  const oauth2Client = await createOAuthClient();
  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  });

  oauth2Client.on("tokens", async (newTokens) => {
    if (newTokens.access_token) {
      await dbAdmin
        .collection("professionals").doc(professionalUid)
        .collection("integrations").doc("google")
        .set({ access_token: newTokens.access_token, expiry_date: newTokens.expiry_date ?? null }, { merge: true });
    }
  });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  const tz = params.timezone ?? "America/Sao_Paulo";

  const event: any = {
    summary: params.summary,
    description: params.description,
    start: { dateTime: `${params.date}T${params.startTime}:00`, timeZone: tz },
    end:   { dateTime: `${params.date}T${params.endTime}:00`,   timeZone: tz },
    status: params.tentative ? "tentative" : "confirmed",
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email",  minutes: 60 },
        { method: "popup",  minutes: 15 },
      ],
    },
  };

  if (params.attendeeEmail) {
    event.attendees = [{ email: params.attendeeEmail }];
  }

  try {
    const res = await calendar.events.insert({ calendarId: "primary", requestBody: event });
    return res.data.id ?? null;
  } catch (err: any) {
    if (isInvalidGrant(err)) { await markNeedsReconnect(professionalUid); return null; }
    throw err;
  }
}

// ─── Horários ocupados no Google Agenda ──────────────────────────────────────
// Falha aberta: qualquer erro devolve null e o app segue sem bloquear nada.
const busyCache = new Map<string, { at: number; data: BusyByDate }>();
const BUSY_CACHE_MS = 60_000;

export async function getBusyIntervals(
  professionalUid: string,
  startDate: string,
  endDate: string
): Promise<BusyByDate | null> {
  const cacheKey = `${professionalUid}|${startDate}|${endDate}`;
  const cached = busyCache.get(cacheKey);
  if (cached && Date.now() - cached.at < BUSY_CACHE_MS) return cached.data;

  try {
    const tokens = await getTokens(professionalUid);
    if (!tokens?.refresh_token) return null;

    const google = await getGoogleApis();
    const oauth2Client = await createOAuthClient();
    oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
    });
    oauth2Client.on("tokens", async (newTokens) => {
      if (newTokens.access_token) {
        await dbAdmin
          .collection("professionals").doc(professionalUid)
          .collection("integrations").doc("google")
          .set({ access_token: newTokens.access_token, expiry_date: newTokens.expiry_date ?? null }, { merge: true });
      }
    });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    const busy: BusyByDate = {};
    let pageToken: string | undefined;

    for (let page = 0; page < 5; page++) {
      const res: any = await calendar.events.list({
        calendarId: "primary",
        timeMin: `${startDate}T00:00:00-03:00`,
        timeMax: `${endDate}T23:59:59-03:00`,
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 2500,
        pageToken,
      });

      for (const ev of res.data.items ?? []) {
        if (ev.status === "cancelled") continue;
        if (ev.transparency === "transparent") continue; // marcado como "livre"
        if (!ev.start?.dateTime || !ev.end?.dateTime) continue; // eventos de dia inteiro não bloqueiam
        const me = (ev.attendees ?? []).find((a: any) => a.self);
        if (me?.responseStatus === "declined") continue;

        for (const iv of intervalsFromIsoRange(ev.start.dateTime, ev.end.dateTime)) {
          (busy[iv.date] ||= []).push({ start: iv.start, end: iv.end });
        }
      }

      pageToken = res.data.nextPageToken ?? undefined;
      if (!pageToken) break;
    }

    busyCache.set(cacheKey, { at: Date.now(), data: busy });
    return busy;
  } catch (err: any) {
    if (isInvalidGrant(err)) await markNeedsReconnect(professionalUid).catch(() => {});
    console.error("[google-busy]", err?.code ?? err?.message);
    return null;
  }
}

// ─── Sincronização de eventos de agendamentos ────────────────────────────────
async function getCalendarClient(professionalUid: string) {
  const tokens = await getTokens(professionalUid);
  if (!tokens?.refresh_token) return null;

  const google = await getGoogleApis();
  const oauth2Client = await createOAuthClient();
  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  });
  oauth2Client.on("tokens", async (newTokens) => {
    if (newTokens.access_token) {
      await dbAdmin
        .collection("professionals").doc(professionalUid)
        .collection("integrations").doc("google")
        .set({ access_token: newTokens.access_token, expiry_date: newTokens.expiry_date ?? null }, { merge: true });
    }
  });
  return google.calendar({ version: "v3", auth: oauth2Client });
}

export type CalendarEventState = "active" | "cancelled" | "missing" | "unknown";

// Estado de um evento que o Retoria criou: apagado/cancelado no Google => "missing"/"cancelled".
export async function getCalendarEventState(
  professionalUid: string,
  calendarEventId: string
): Promise<CalendarEventState> {
  try {
    const calendar = await getCalendarClient(professionalUid);
    if (!calendar) return "unknown";
    const res = await calendar.events.get({ calendarId: "primary", eventId: calendarEventId });
    return res.data.status === "cancelled" ? "cancelled" : "active";
  } catch (err: any) {
    if (isInvalidGrant(err)) { await markNeedsReconnect(professionalUid).catch(() => {}); return "unknown"; }
    if (err?.code === 404 || err?.code === 410) return "missing";
    return "unknown";
  }
}

// Atualiza título/horário/status de um evento existente. "missing" = evento não existe mais no Google.
export async function updateCalendarEvent(
  professionalUid: string,
  calendarEventId: string,
  params: CalendarEventParams
): Promise<"ok" | "missing" | "error"> {
  try {
    const calendar = await getCalendarClient(professionalUid);
    if (!calendar) return "error";

    // Não ressuscitar evento apagado pelo profissional
    const current = await calendar.events.get({ calendarId: "primary", eventId: calendarEventId });
    if (current.data.status === "cancelled") return "missing";

    const tz = params.timezone ?? "America/Sao_Paulo";
    await calendar.events.patch({
      calendarId: "primary",
      eventId: calendarEventId,
      requestBody: {
        summary: params.summary,
        description: params.description,
        start: { dateTime: `${params.date}T${params.startTime}:00`, timeZone: tz },
        end: { dateTime: `${params.date}T${params.endTime}:00`, timeZone: tz },
        status: params.tentative ? "tentative" : "confirmed",
      },
    });
    return "ok";
  } catch (err: any) {
    if (isInvalidGrant(err)) { await markNeedsReconnect(professionalUid).catch(() => {}); return "error"; }
    if (err?.code === 404 || err?.code === 410) return "missing";
    console.error("[google-update]", err?.code ?? err?.message);
    return "error";
  }
}
