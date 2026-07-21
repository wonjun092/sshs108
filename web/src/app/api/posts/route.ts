import { NextRequest, NextResponse } from "next/server";
import { canWriteBoard, getSession } from "@/lib/auth";
import { connectDatabase } from "@/lib/db";
import { apiError } from "@/lib/http";
import { BOARD_TYPES, Post } from "@/models/Post";
import { postCreateSchema } from "@/validation/post";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const board = request.nextUrl.searchParams.get("board");
    if (!board || !BOARD_TYPES.includes(board as (typeof BOARD_TYPES)[number])) {
      return NextResponse.json({ error: "올바른 게시판을 선택해주세요." }, { status: 400 });
    }
    const boardType = board as (typeof BOARD_TYPES)[number];
    await connectDatabase();
    const now = new Date();
    const posts = await Post.find({
      board: boardType,
      ...(boardType === "notice" ? { $or: [{ scheduledAt: null }, { scheduledAt: { $lte: now } }] } : {}),
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return NextResponse.json({
      posts: posts.map((post) => ({
        ...post,
        authorLoginId: boardType === "anonymous" ? "익명" : post.authorLoginId,
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const input = postCreateSchema.parse(await request.json());
    if (!canWriteBoard(session.role, input.board)) {
      return NextResponse.json({ error: "이 게시판에 글을 작성할 권한이 없습니다." }, { status: 403 });
    }
    await connectDatabase();
    const post = await Post.create({
      ...input,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
      authorId: session.userId,
      authorLoginId: session.loginId,
    });
    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
