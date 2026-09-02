import { NextRequest, NextResponse } from "next/server";
import { googleCookieName, signGoogleSession } from "@/lib/google";
import { getGoogleRedirectUri } from "@/lib/google-oauth";

function outingError(request: NextRequest, reason: string) {
  const url = new URL("/outing", request.url);
  url.searchParams.set("google_error", reason);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const oauthError = request.nextUrl.searchParams.get("error");
  if (oauthError) return outingError(request, oauthError);

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (
    !code ||
    !state ||
    state !== request.cookies.get("sshs108_google_state")?.value
  )
    return outingError(request, "invalid_state");

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return outingError(request, "missing_config");

  let redirectUri: string;
  try {
    redirectUri = getGoogleRedirectUri(request);
  } catch {
    return outingError(request, "invalid_redirect_uri");
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResponse.ok) {
    const details = (await tokenResponse.json().catch(() => ({}))) as {
      error?: string;
      error_description?: string;
    };
    console.error("Google OAuth token exchange failed", {
      status: tokenResponse.status,
      error: details.error,
      description: details.error_description,
      redirectUri,
    });
    return outingError(request, details.error || "token_exchange_failed");
  }
  const token = (await tokenResponse.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  const signed = await signGoogleSession({
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + token.expires_in * 1000,
  });
  const response = NextResponse.redirect(new URL("/outing", request.url));
  response.cookies.set(googleCookieName(), signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  response.cookies.delete("sshs108_google_state");
  return response;
}
