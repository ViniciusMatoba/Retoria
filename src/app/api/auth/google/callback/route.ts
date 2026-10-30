import { NextRequest, NextResponse } from "next/server";
import { createOAuthClient, saveTokens } from "@/lib/googleCalendar";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get("code");
  const state = searchParams.get("state"); // professionalUid
  const error = searchParams.get("error");

  if (error || !code || !state) {
    const reason = error ?? "missing_code";
    return NextResponse.redirect(`${APP_URL}/dashboard/slots?google_error=${reason}`);
  }

  try {
    const oauth2Client = await createOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    await saveTokens(state, tokens);
    return NextResponse.redirect(`${APP_URL}/dashboard/slots?google_connected=1`);
  } catch (err: any) {
    console.error("[google/callback]", err);
    return NextResponse.redirect(`${APP_URL}/dashboard/slots?google_error=token_exchange`);
  }
}
