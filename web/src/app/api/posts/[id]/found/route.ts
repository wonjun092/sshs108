import { isValidObjectId } from "mongoose";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDatabase } from "@/lib/db";
import { apiError } from "@/lib/http";
import { Post } from "@/models/Post";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(_: Request, context: Context): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const { id } = await context.params;
    if (!isValidObjectId(id)) return NextResponse.json({ error: "잘못된 게시글 ID입니다." }, { status: 400 });

    await connectDatabase();
    const post = await Post.findById(id);
    if (!post) return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
    if (!post.board.startsWith("lost-")) return NextResponse.json({ error: "분실물 게시글에서만 사용할 수 있습니다." }, { status: 400 });
    if (post.authorId.toString() !== session.userId && session.role !== "admin") return NextResponse.json({ error: "처리 권한이 없습니다." }, { status: 403 });

    post.found = true;
    await post.save();
    return NextResponse.json({ post });
  } catch (error) {
    return apiError(error);
  }
}
