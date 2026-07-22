import type { NextRequest } from "next/server";

export function getGoogleRedirectUri(request: NextRequest) {
  const configuredRedirect = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (configuredRedirect) {
    return new URL(configuredRedirect).toString();
  }

  const configuredOrigin = process.env.APP_URL?.trim();
  const origin = configuredOrigin || request.nextUrl.origin;
  return new URL("/api/google/callback", origin).toString();
}
