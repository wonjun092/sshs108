import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "sshs108_session";

export type SessionUser = {
  userId: string;
  loginId: string;
  role: "admin" | "teacher" | "student";
};

function sessionKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("AUTH_SECRET은 32자 이상이어야 합니다.");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT(user)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(sessionKey());
}

export async function readSessionToken(
  token: string,
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, sessionKey());
    if (
      typeof payload.userId !== "string" ||
      typeof payload.loginId !== "string" ||
      !["admin", "teacher", "student"].includes(String(payload.role))
    )
      return null;
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return token ? readSessionToken(token) : null;
}

export function canWriteBoard(
  role: SessionUser["role"],
  board: string,
): boolean {
  if (board === "notice") return role === "admin" || role === "teacher";
  if (board === "free" || board === "anonymous") return role !== "teacher";
  return true;
}
