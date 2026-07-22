import { isValidObjectId } from "mongoose";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDatabase } from "@/lib/db";
import { apiError } from "@/lib/http";
import { Post } from "@/models/Post";
import { commentCreateSchema } from "@/validation/post";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const { id } = await context.params;
    if (!isValidObjectId(id)) return NextResponse.json({ error: "잘못된 게시글 ID입니다." }, { status: 400 });
    const input = commentCreateSchema.parse(await request.json());
    await connectDatabase();
    const post = await Post.findById(id);
    if (!post) return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
    post.comments.push({
      authorId: session.userId,
      writer: post.board === "anonymous" ? "익명" : session.loginId,
      content: input.content,
    });
    await post.save();
    return NextResponse.json({ comments: post.comments }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
