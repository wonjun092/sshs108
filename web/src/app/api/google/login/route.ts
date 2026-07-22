import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (!(await getSession())) return NextResponse.redirect(new URL("/login", request.url));
  const clientId = process.env.GOOGLE_CLIENT_ID; if (!clientId) return NextResponse.json({ error: "GOOGLE_CLIENT_ID가 설정되지 않았습니다." }, { status: 503 });
  const state = crypto.randomUUID(); const redirectUri = `${request.nextUrl.origin}/api/google/callback`;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth"); url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: "https://www.googleapis.com/auth/spreadsheets", access_type: "offline", prompt: "consent", state }).toString();
  const response = NextResponse.redirect(url); response.cookies.set("sshs108_google_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" }); return response;
}
