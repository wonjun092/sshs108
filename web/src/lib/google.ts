import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";

const GOOGLE_COOKIE = "sshs108_google";
export type GoogleSession = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
};
function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("AUTH_SECRET이 필요합니다.");
  return new TextEncoder().encode(secret);
}
export async function signGoogleSession(value: GoogleSession) {
  return new SignJWT(value)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(key());
}
export async function getGoogleSession(): Promise<GoogleSession | null> {
  const token = (await cookies()).get(GOOGLE_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return payload as unknown as GoogleSession;
  } catch {
    return null;
  }
}
export function googleCookieName() {
  return GOOGLE_COOKIE;
}
export async function getGoogleAccessToken() {
  const session = await getGoogleSession();
  if (!session) return null;
  if (session.expiresAt > Date.now() + 30_000) return session.accessToken;
  if (!session.refreshToken) return null;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: session.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}
export async function readSheetRows() {
  const token = await getGoogleAccessToken();
  if (!token) throw new Error("학교 Google 로그인이 필요합니다.");
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!spreadsheetId)
    throw new Error("GOOGLE_SPREADSHEET_ID가 설정되지 않았습니다.");
  const range = encodeURIComponent("학생 신청!A3:H");
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  if (!response.ok)
    throw new Error("Google Sheets 현황을 불러오지 못했습니다.");
  const data = (await response.json()) as { values?: string[][] };
  return data.values ?? [];
}
export async function updateSheet(
  studentId: string,
  period: string,
  location: string,
) {
  const token = await getGoogleAccessToken();
  if (!token) throw new Error("학교 Google 로그인이 필요합니다.");
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!spreadsheetId)
    throw new Error("GOOGLE_SPREADSHEET_ID가 설정되지 않았습니다.");
  const columnRange = encodeURIComponent("학생 신청!A:A");
  const lookup = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${columnRange}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  if (!lookup.ok)
    throw new Error("Google Sheets에서 학번을 확인하지 못했습니다.");
  const values =
    ((await lookup.json()) as { values?: string[][] }).values ?? [];
  const index = values.findIndex(
    (row) => String(row[0] ?? "").trim() === studentId.trim(),
  );
  if (index < 0) throw new Error("Google Sheets에서 학번을 찾을 수 없습니다.");
  const cell = `${period.includes("1교시") ? "C" : "F"}${index + 1}`;
  const range = encodeURIComponent(`학생 신청!${cell}`);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [[location]] }),
    },
  );
  if (!response.ok)
    throw new Error("Google Sheets에 이석 신청을 반영하지 못했습니다.");
}
