import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDatabase } from "@/lib/db";
import { EnglishQuizScore } from "@/models/EnglishQuizScore";
import {
  ENGLISH_QUIZ_GUEST_NAME_MAX,
  parseEnglishQuizGuestName,
  parseEnglishQuizRecord,
  WEDNESDAY_WARS_PART2_TOTAL,
  WEDNESDAY_WARS_RANKING_BOOK,
} from "@/lib/english-quiz";

const GUEST_COOKIE = "sshs108_english_guest";
const GUEST_USER_PREFIX = "guest:";
const GUEST_TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export async function GET() {
  await connectDatabase();

  const scores = await EnglishQuizScore.find({ book: WEDNESDAY_WARS_RANKING_BOOK })
    .sort({ score: -1, durationMs: 1, achievedAt: 1, _id: 1 })
    .limit(100)
    .lean();

  const rankings = scores.map((entry, index) => ({
    rank: index + 1,
    loginId: entry.loginId,
    score: entry.score,
    total: entry.total,
    durationMs: entry.durationMs,
    ...(entry.userId?.startsWith(GUEST_USER_PREFIX) ? { isGuest: true } : {}),
  }));

  return NextResponse.json({ rankings, total: WEDNESDAY_WARS_PART2_TOTAL });
}

export async function POST(request: Request) {
  const session = await getSession();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const record = parseEnglishQuizRecord(body);
  if (!record) {
    return NextResponse.json(
      { error: "Wednesday Wars Part 2 전체 193문제의 점수와 시간만 저장할 수 있습니다." },
      { status: 400 },
    );
  }
  const { score, total, durationMs } = record;

  let userId: string;
  let loginId: string;
  let newGuestToken: string | undefined;
  if (session) {
    userId = session.userId;
    loginId = session.loginId;
  } else {
    const providedName = body && typeof body === "object" && "guestName" in body ? body.guestName : undefined;
    if (providedName === undefined) {
      return NextResponse.json(
        { requiresNickname: true, error: "랭킹에 표시할 닉네임을 입력해 주세요." },
        { status: 401 },
      );
    }

    const guestName = parseEnglishQuizGuestName(providedName);
    if (!guestName) {
      return NextResponse.json(
        { error: `닉네임은 문자나 숫자를 포함해 2~${ENGLISH_QUIZ_GUEST_NAME_MAX}자로 입력해 주세요. 공백, 밑줄, 하이픈도 사용할 수 있습니다.` },
        { status: 400 },
      );
    }

    const origin = request.headers.get("origin");
    const fetchSite = request.headers.get("sec-fetch-site");
    // Next.js can normalize the request URL to an internal hostname. Use the browser's
    // same-origin signal when available and fall back to comparing origins otherwise.
    if (
      origin === "null" || fetchSite === "cross-site" || fetchSite === "same-site" ||
      (fetchSite !== "same-origin" && origin && origin !== new URL(request.url).origin)
    ) {
      return NextResponse.json({ error: "영어 단어 시험 화면에서 기록을 저장해 주세요." }, { status: 403 });
    }

    const previousToken = (await cookies()).get(GUEST_COOKIE)?.value;
    const guestToken = previousToken && GUEST_TOKEN.test(previousToken) ? previousToken : randomUUID();
    if (guestToken !== previousToken) newGuestToken = guestToken;
    userId = `${GUEST_USER_PREFIX}${guestToken}`;
    loginId = guestName;
  }

  await connectDatabase();
  const identity = { userId, book: WEDNESDAY_WARS_RANKING_BOOK } as const;
  const best = { loginId, score, total, durationMs, achievedAt: new Date() };
  let improved = false;
  try {
    const inserted = await EnglishQuizScore.updateOne(
      identity,
      { $setOnInsert: { ...identity, ...best } },
      { upsert: true },
    );
    improved = inserted.upsertedCount > 0;
  } catch (error) {
    // Another request may have inserted this user's first record concurrently.
    if (typeof error !== "object" || error === null || !("code" in error) || error.code !== 11000) throw error;
  }
  if (!improved) {
    const updated = await EnglishQuizScore.updateOne(
      { ...identity, $or: [{ score: { $lt: score } }, { score, durationMs: { $gt: durationMs } }] },
      { $set: best },
    );
    improved = updated.modifiedCount > 0;
  }

  const response = NextResponse.json({ recorded: true, improved });
  if (newGuestToken) {
    response.cookies.set(GUEST_COOKIE, newGuestToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/english-ranking",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}
