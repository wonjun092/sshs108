import { NextRequest, NextResponse } from "next/server";
import { googleCookieName, signGoogleSession } from "@/lib/google";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code"); const state = request.nextUrl.searchParams.get("state");
  if (!code || !state || state !== request.cookies.get("sshs108_google_state")?.value) return NextResponse.json({ error: "Google 로그인 검증에 실패했습니다." }, { status: 400 });
  const redirectUri = `${request.nextUrl.origin}/api/google/callback`;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID ?? "", client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "", redirect_uri: redirectUri, grant_type: "authorization_code" }) });
  if (!tokenResponse.ok) return NextResponse.json({ error: "Google 토큰을 발급받지 못했습니다." }, { status: 502 });
  const token = await tokenResponse.json() as { access_token: string; refresh_token?: string; expires_in: number };
  const signed = await signGoogleSession({ accessToken: token.access_token, refreshToken: token.refresh_token, expiresAt: Date.now() + token.expires_in * 1000 });
  const response = NextResponse.redirect(new URL("/outing", request.url)); response.cookies.set(googleCookieName(), signed, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30, path: "/" }); response.cookies.delete("sshs108_google_state"); return response;
}
