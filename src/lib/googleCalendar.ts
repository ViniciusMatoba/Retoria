import { google } from "googleapis";
import { dbAdmin } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`;

export function createOAuthClient() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

export function getAuthUrl(professionalUid: string) {
  const oauth2Client = createOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar.events"],
    state: professionalUid,
  });
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
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:MM
  endTime: string;    // HH:MM
  attendeeEmail?: string;
  timezone?: string;
}

export async function createCalendarEvent(
  professionalUid: string,
  params: CalendarEventParams
): Promise<string | null> {
  const tokens = await getTokens(professionalUid);
  if (!tokens?.refresh_token) return null;

  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  });

  // Atualiza access_token se renovado automaticamente
  oauth2Client.on("tokens", async (newTokens) => {
    if (newTokens.access_token) {
      await dbAdmin
        .collection("professionals")
        .doc(professionalUid)
        .collection("integrations")
        .doc("google")
        .set(
          {
            access_token: newTokens.access_token,
            expiry_date: newTokens.expiry_date ?? null,
          },
          { merge: true }
        );
    }
  });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  const tz = params.timezone ?? "America/Sao_Paulo";

  const event: any = {
    summary: params.summary,
    description: params.description,
    start: { dateTime: `${params.date}T${params.startTime}:00`, timeZone: tz },
    end:   { dateTime: `${params.date}T${params.endTime}:00`,   timeZone: tz },
    status: "tentative",
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup",  minutes: 60 },
        { method: "popup",  minutes: 15 },
      ],
    },
  };

  if (params.attendeeEmail) {
    event.attendees = [{ email: params.attendeeEmail }];
  }

  const res = await calendar.events.insert({ calendarId: "primary", requestBody: event });
  return res.data.id ?? null;
}
