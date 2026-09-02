import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getGoogleRedirectUri } from "@/lib/google-oauth";

export async function GET(request: NextRequest) {
  if (!(await getSession()))
    return NextResponse.redirect(new URL("/login", request.url));
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      {
        error:
          "Vercel Preview 환경에 Google OAuth 환경변수가 설정되지 않았습니다.",
      },
      { status: 503 },
    );
  }

  let redirectUri: string;
  try {
    redirectUri = getGoogleRedirectUri(request);
  } catch {
    return NextResponse.json(
      { error: "GOOGLE_REDIRECT_URI 또는 APP_URL이 올바른 URL이 아닙니다." },
      { status: 503 },
    );
  }

  const state = crypto.randomUUID();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/spreadsheets",
    access_type: "offline",
    prompt: "consent",
    state,
  }).toString();
  const response = NextResponse.redirect(url);
  response.cookies.set("sshs108_google_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
