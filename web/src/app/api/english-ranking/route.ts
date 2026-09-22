import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDatabase } from "@/lib/db";
import { EnglishQuizScore } from "@/models/EnglishQuizScore";
import { parseEnglishQuizRecord, WEDNESDAY_WARS_TOTAL } from "@/lib/english-quiz";

const BOOK = "wednesdayWars" as const;

export async function GET() {
  await connectDatabase();

  const [scores, speedrunScores] = await Promise.all([
    EnglishQuizScore.find({ book: BOOK })
      .sort({ score: -1, achievedAt: 1 })
      .limit(100)
      .lean(),
    EnglishQuizScore.find({
      book: BOOK,
      score: WEDNESDAY_WARS_TOTAL,
      total: WEDNESDAY_WARS_TOTAL,
      speedrunDurationMs: { $gt: 0 },
    })
      .sort({ speedrunDurationMs: 1, speedrunAchievedAt: 1, _id: 1 })
      .limit(100)
      .lean(),
  ]);

  const rankings = scores.map((entry, index) => {
    return {
      rank: index + 1,
      loginId: entry.loginId,
      score: entry.score,
      total: entry.total,
    };
  });

  const speedruns = speedrunScores.map((entry, index) => ({
    rank: index + 1,
    loginId: entry.loginId,
    durationMs: entry.speedrunDurationMs,
  }));

  return NextResponse.json({ rankings, speedruns, total: WEDNESDAY_WARS_TOTAL });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "로그인한 사용자만 기록을 저장할 수 있습니다." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const record = parseEnglishQuizRecord(body);
  if (!record) {
    return NextResponse.json(
      { error: "Wednesday Wars 전체 범위의 유효한 점수와 시간만 저장할 수 있습니다." },
      { status: 400 },
    );
  }
  const { score, total, durationMs } = record;

  await connectDatabase();
  const identity = { userId: session.userId, book: BOOK };
  let improved = false;
  try {
    const inserted = await EnglishQuizScore.updateOne(
      identity,
      { $setOnInsert: { ...identity, loginId: session.loginId, score, total, achievedAt: new Date() } },
      { upsert: true },
    );
    improved = inserted.upsertedCount > 0;
  } catch (error) {
    // Another request may have inserted this user's first record concurrently.
    if (typeof error !== "object" || error === null || !("code" in error) || error.code !== 11000) throw error;
  }
  if (!improved) {
    const updated = await EnglishQuizScore.updateOne(
      { ...identity, score: { $lt: score } },
      { $set: { loginId: session.loginId, score, total, achievedAt: new Date() } },
    );
    improved = updated.modifiedCount > 0;
  }

  const speedrunEligible = score === WEDNESDAY_WARS_TOTAL && durationMs !== undefined;
  let speedrunImproved = false;
  if (speedrunEligible) {
    // Only replace a missing or slower personal best, including concurrent finishes.
    const updated = await EnglishQuizScore.updateOne(
      {
        userId: session.userId,
        book: BOOK,
        $or: [
          { speedrunDurationMs: { $exists: false } },
          { speedrunDurationMs: null },
          { speedrunDurationMs: { $gt: durationMs } },
        ],
      },
      { $set: { speedrunDurationMs: durationMs, speedrunAchievedAt: new Date() } },
    );
    speedrunImproved = updated.modifiedCount > 0;
  }

  return NextResponse.json({ recorded: true, improved, speedrunEligible, speedrunImproved });
}
