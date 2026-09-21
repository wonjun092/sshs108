import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDatabase } from "@/lib/db";
import { EnglishQuizScore } from "@/models/EnglishQuizScore";

const BOOK = "wednesdayWars" as const;
const WEDNESDAY_WARS_TOTAL = 159;

export async function GET() {
  await connectDatabase();

  const scores = await EnglishQuizScore.find({ book: BOOK })
    .sort({ score: -1, achievedAt: 1 })
    .limit(100)
    .lean();

  const rankings = scores.map((entry, index) => {
    return {
      rank: index + 1,
      loginId: entry.loginId,
      score: entry.score,
      total: entry.total,
    };
  });

  return NextResponse.json({ rankings, total: WEDNESDAY_WARS_TOTAL });
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

  const score =
    typeof body === "object" && body !== null && "score" in body
      ? (body as { score?: unknown }).score
      : undefined;
  const total =
    typeof body === "object" && body !== null && "total" in body
      ? (body as { total?: unknown }).total
      : undefined;

  if (
    typeof score !== "number" ||
    typeof total !== "number" ||
    !Number.isInteger(score) ||
    !Number.isInteger(total) ||
    total !== WEDNESDAY_WARS_TOTAL ||
    score < 0 ||
    score > WEDNESDAY_WARS_TOTAL
  ) {
    return NextResponse.json(
      { error: "Wednesday Wars 전체 범위 기록만 저장할 수 있습니다." },
      { status: 400 },
    );
  }

  await connectDatabase();
  const existing = await EnglishQuizScore.findOne({
    userId: session.userId,
    book: BOOK,
  });

  let improved = false;
  if (!existing) {
    await EnglishQuizScore.create({
      userId: session.userId,
      loginId: session.loginId,
      book: BOOK,
      score,
      total,
      achievedAt: new Date(),
    });
    improved = true;
  } else if (score > existing.score) {
    existing.loginId = session.loginId;
    existing.score = score;
    existing.total = total;
    existing.achievedAt = new Date();
    await existing.save();
    improved = true;
  }

  return NextResponse.json({ recorded: true, improved });
}
