import { HydratedDocument, isValidObjectId } from "mongoose";
import { NextResponse } from "next/server";
import { getSession, SessionUser } from "@/lib/auth";
import { connectDatabase } from "@/lib/db";
import { apiError } from "@/lib/http";
import { Post, PostDocument } from "@/models/Post";
import { postUpdateSchema } from "@/validation/post";

type Context = { params: Promise<{ id: string }> };

type EditableResult =
  | { error: NextResponse }
  | { post: HydratedDocument<PostDocument>; session: SessionUser };

async function editablePost(id: string): Promise<EditableResult> {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }) };
  if (!isValidObjectId(id)) return { error: NextResponse.json({ error: "잘못된 게시글 ID입니다." }, { status: 400 }) };
  await connectDatabase();
  const post = await Post.findById(id);
  if (!post) return { error: NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 }) };
  const owner = post.authorId.toString() === session.userId;
  const privileged = session.role === "admin" || (post.board === "notice" && session.role === "teacher");
  if (!owner && !privileged) return { error: NextResponse.json({ error: "권한이 없습니다." }, { status: 403 }) };
  return { post, session };
}

export async function GET(_: Request, context: Context): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const { id } = await context.params;
    if (!isValidObjectId(id)) return NextResponse.json({ error: "잘못된 게시글 ID입니다." }, { status: 400 });
    await connectDatabase();
    const post = await Post.findByIdAndUpdate(id, { $inc: { views: 1 } }, { new: true }).lean();
    if (!post) return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({
      post: {
        ...post,
        authorLoginId: post.board === "anonymous" ? "익명" : post.authorLoginId,
        canDelete: post.authorId.toString() === session.userId || session.role === "admin" || (post.board === "notice" && session.role === "teacher"),
        canEdit: !post.board.startsWith("lost-") && (post.authorId.toString() === session.userId || session.role === "admin" || (post.board === "notice" && session.role === "teacher")),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, context: Context): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const result = await editablePost(id);
    if ("error" in result) return result.error;
    const input = postUpdateSchema.parse(await request.json());
    Object.assign(result.post, {
      ...input,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : result.post.scheduledAt,
    });
    await result.post.save();
    return NextResponse.json({ post: result.post });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_: Request, context: Context): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const result = await editablePost(id);
    if ("error" in result) return result.error;
    await result.post.deleteOne();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
