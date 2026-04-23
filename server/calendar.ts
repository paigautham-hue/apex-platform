/**
 * calendar.ts — Google + Outlook OAuth + event fetching (Meridian pattern).
 *
 * Tokens persist to calendarTokens table; events cache to calendarEvents.
 * Triggers meeting prep cards via the rhythm engine.
 *
 * Env required:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
 *   OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET, OUTLOOK_REDIRECT_URI
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "./db";
import { calendarTokens, calendarEvents } from "../drizzle/schema";

type Provider = "GOOGLE" | "OUTLOOK";

const GOOGLE_SCOPES = ["openid", "email", "profile", "https://www.googleapis.com/auth/calendar.readonly"];
const OUTLOOK_SCOPES = ["openid", "profile", "offline_access", "Calendars.Read"];

export function getOAuthUrl(provider: Provider, state: string): string {
  if (provider === "GOOGLE") {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    if (!clientId || !redirectUri) throw new Error("Google OAuth not configured (GOOGLE_CLIENT_ID + GOOGLE_REDIRECT_URI required)");
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      scope: GOOGLE_SCOPES.join(" "),
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }
  const clientId = process.env.OUTLOOK_CLIENT_ID;
  const redirectUri = process.env.OUTLOOK_REDIRECT_URI;
  if (!clientId || !redirectUri) throw new Error("Outlook OAuth not configured");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: OUTLOOK_SCOPES.join(" "),
    state,
  });
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function exchangeCode(provider: Provider, code: string): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  email: string | null;
}> {
  if (provider === "GOOGLE") {
    const params = new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: process.env.GOOGLE_REDIRECT_URI ?? "",
      grant_type: "authorization_code",
    });
    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (!resp.ok) throw new Error(`Google token exchange failed: ${resp.status}`);
    const data = await resp.json();
    // Decode email from id_token if present
    let email: string | null = null;
    if (data.id_token) {
      try {
        const payload = JSON.parse(Buffer.from(data.id_token.split(".")[1], "base64url").toString());
        email = payload.email ?? null;
      } catch {}
    }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
      email,
    };
  }
  // Outlook
  const params = new URLSearchParams({
    code,
    client_id: process.env.OUTLOOK_CLIENT_ID ?? "",
    client_secret: process.env.OUTLOOK_CLIENT_SECRET ?? "",
    redirect_uri: process.env.OUTLOOK_REDIRECT_URI ?? "",
    grant_type: "authorization_code",
    scope: OUTLOOK_SCOPES.join(" "),
  });
  const resp = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!resp.ok) throw new Error(`Outlook token exchange failed: ${resp.status}`);
  const data = await resp.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
    email: null,
  };
}

export async function refreshTokenIfNeeded(provider: Provider, tokenRow: { accessToken: string; refreshToken: string | null; expiresAt: Date | null }): Promise<string> {
  if (!tokenRow.expiresAt || new Date(tokenRow.expiresAt) > new Date(Date.now() + 60_000)) {
    return tokenRow.accessToken;
  }
  if (!tokenRow.refreshToken) {
    throw new Error("Token expired and no refresh token");
  }
  if (provider === "GOOGLE") {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: tokenRow.refreshToken,
      grant_type: "refresh_token",
    });
    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (!resp.ok) throw new Error("Google token refresh failed");
    const data = await resp.json();
    return data.access_token;
  }
  const params = new URLSearchParams({
    client_id: process.env.OUTLOOK_CLIENT_ID ?? "",
    client_secret: process.env.OUTLOOK_CLIENT_SECRET ?? "",
    refresh_token: tokenRow.refreshToken,
    grant_type: "refresh_token",
    scope: OUTLOOK_SCOPES.join(" "),
  });
  const resp = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!resp.ok) throw new Error("Outlook token refresh failed");
  const data = await resp.json();
  return data.access_token;
}

export async function fetchUpcomingEvents(
  provider: Provider,
  accessToken: string,
  daysAhead = 14
): Promise<Array<{ externalId: string; title: string; description: string | null; startAt: Date; endAt: Date | null; attendees: Array<{ email: string; name?: string }> }>> {
  if (provider === "GOOGLE") {
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=100`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!resp.ok) throw new Error(`Google events fetch ${resp.status}`);
    const data = await resp.json();
    return (data.items ?? []).map((ev: any) => ({
      externalId: ev.id,
      title: ev.summary ?? "(no title)",
      description: ev.description ?? null,
      startAt: new Date(ev.start?.dateTime ?? ev.start?.date),
      endAt: ev.end?.dateTime ? new Date(ev.end.dateTime) : null,
      attendees: (ev.attendees ?? []).map((a: any) => ({ email: a.email, name: a.displayName })),
    }));
  }
  // Outlook
  const start = new Date().toISOString();
  const end = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();
  const url = `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${start}&endDateTime=${end}&$top=100`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!resp.ok) throw new Error(`Outlook events fetch ${resp.status}`);
  const data = await resp.json();
  return (data.value ?? []).map((ev: any) => ({
    externalId: ev.id,
    title: ev.subject ?? "(no title)",
    description: ev.bodyPreview ?? null,
    startAt: new Date(ev.start?.dateTime),
    endAt: ev.end?.dateTime ? new Date(ev.end.dateTime) : null,
    attendees: (ev.attendees ?? []).map((a: any) => ({ email: a.emailAddress?.address, name: a.emailAddress?.name })),
  }));
}

export async function syncCalendar(tenantId: number, userId: number, provider: Provider): Promise<{ synced: number }> {
  const db = await getDb();
  if (!db) return { synced: 0 };

  const tokenRows = await db
    .select()
    .from(calendarTokens)
    .where(and(eq(calendarTokens.tenantId, tenantId), eq(calendarTokens.userId, userId), eq(calendarTokens.provider, provider)))
    .limit(1);
  if (tokenRows.length === 0) throw new Error("No calendar connection — run OAuth first");
  const accessToken = await refreshTokenIfNeeded(provider, tokenRows[0]);

  const events = await fetchUpcomingEvents(provider, accessToken, 14);
  let synced = 0;
  for (const ev of events) {
    const existing = await db
      .select()
      .from(calendarEvents)
      .where(and(eq(calendarEvents.provider, provider), eq(calendarEvents.externalId, ev.externalId)))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(calendarEvents).values({
        tenantId,
        userId,
        provider,
        externalId: ev.externalId,
        title: ev.title,
        description: ev.description,
        startAt: ev.startAt,
        endAt: ev.endAt,
        attendees: ev.attendees,
      });
      synced++;
    } else {
      await db
        .update(calendarEvents)
        .set({
          title: ev.title,
          description: ev.description,
          startAt: ev.startAt,
          endAt: ev.endAt,
          attendees: ev.attendees,
          syncedAt: new Date(),
        })
        .where(eq(calendarEvents.id, existing[0].id));
    }
  }
  return { synced };
}
